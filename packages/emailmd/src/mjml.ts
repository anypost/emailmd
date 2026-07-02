import mjml2html from 'mjml';
import type { Segment } from './segmenter.js';
import type { Theme } from './theme.js';
import type { RenderWarning } from './warnings.js';
import { escapeHtml, escapeAttrValue, isCssColor, isCssLength, isSafeUrl } from './sanitize.js';

/**
 * Overridable output strings, for localization.
 */
export interface RenderStrings {
  /**
   * Sentence shown under a button rendered with `fallback`. Supports the
   * placeholders `{text}` (button label) and `{url}` (a clickable copy of the
   * button link). May contain HTML entities.
   */
  buttonFallback?: string;
}

const DEFAULT_BUTTON_FALLBACK =
  'If you&#x2019;re having trouble clicking the &ldquo;{text}&rdquo; button, copy and paste this URL into your browser: {url}';

export interface WrapperMeta {
  /** Preheader text from frontmatter, shown in the inbox preview pane. */
  preheader?: string;
  /** The full frontmatter map, for wrappers that need more than the preheader. */
  frontmatter?: Record<string, unknown>;
  /** Overridable output strings (see {@link RenderStrings}). */
  strings?: RenderStrings;
  /** When provided, non-fatal content issues are pushed here during segment rendering. */
  warnings?: RenderWarning[];
}

export type WrapperFn = (segments: Segment[], theme: Theme, meta?: WrapperMeta) => string;

/** Context threaded through segment rendering: strings overrides and a warnings collector. */
export interface SegmentContext {
  strings?: RenderStrings;
  warnings?: RenderWarning[];
}

function warn(ctx: SegmentContext | undefined, message: string): void {
  ctx?.warnings?.push({ stage: 'content', message });
}

/** Validate a user-supplied color; fall back (with a warning) when it is not a plausible CSS color. */
function resolveColor(value: string | undefined, fallback: string, ctx: SegmentContext | undefined, label: string): string {
  if (!value) return fallback;
  if (isCssColor(value)) return value;
  warn(ctx, `Invalid color "${value}" for ${label} — using default.`);
  return fallback;
}

const ALIGN_VALUES = new Set(['left', 'center', 'right']);

function resolveAlign(value: string | undefined, fallback: string, ctx: SegmentContext | undefined, label: string): string {
  if (!value) return fallback;
  if (ALIGN_VALUES.has(value)) return value;
  warn(ctx, `Invalid alignment "${value}" for ${label} — using "${fallback}".`);
  return fallback;
}

function resolveLength(value: string | undefined, fallback: string, ctx: SegmentContext | undefined, label: string): string {
  if (!value) return fallback;
  if (isCssLength(value)) return value;
  warn(ctx, `Invalid length "${value}" for ${label} — using default.`);
  return fallback;
}

export function buildHead(theme: Theme, preheader?: string): string {
  return `<mj-head>
    <mj-attributes>
      <mj-all font-family="${theme.fontFamily}" />
      <mj-text font-size="${theme.fontSize}" line-height="${theme.lineHeight}" color="${theme.bodyColor}" />
    </mj-attributes>
    <mj-style>
      h1 { font-size: 32px; font-weight: 700; color: ${theme.headingColor}; margin: 0 0 12px 0; }
      h2 { font-size: 24px; font-weight: 700; color: ${theme.headingColor}; margin: 0 0 10px 0; }
      h3 { font-size: 20px; font-weight: 600; color: ${theme.headingColor}; margin: 0 0 8px 0; }
      a { color: ${theme.brandColor}; }
      blockquote { border-left: 3px solid ${theme.brandColor}; padding-left: 16px; margin: 0; }
      blockquote blockquote { border-left-color: ${theme.cardColor}; }
      code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: ${theme.cardColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
      pre { background-color: ${theme.cardColor}; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 0; }
      pre code { background-color: transparent; padding: 0; border-radius: 0; font-size: inherit; }
      ul, ol { margin: 0 0 8px 0; padding-left: 24px; }
      li { margin-bottom: 4px; }
      .task-list-item { list-style-type: none; margin-left: -24px; }
      ul ul, ol ol, ul ol, ol ul { margin-top: 4px; margin-bottom: 0; }
      mark { background-color: ${theme.brandColor}33; padding: 2px 4px; border-radius: 2px; }
      dl { margin: 0 0 8px 0; }
      dt { font-weight: 700; margin-top: 8px; }
      dd { margin: 2px 0 0 24px; }
      img { vertical-align: middle; }
    </mj-style>
    ${preheader ? `<mj-preview>${escapeHtml(preheader)}</mj-preview>` : ''}
  </mj-head>`;
}

function processInlineImages(html: string): string {
  return html.replace(/<img\s[^>]*?\b(?:valign|float|border-radius)="[^"]*"[^>]*?\/?>/g, (tag) => {
    const styles: string[] = [];

    // Extract and remove valign
    const valignMatch = tag.match(/\bvalign="([^"]*)"/);
    if (valignMatch) {
      styles.push(`vertical-align: ${valignMatch[1]}`);
      tag = tag.replace(/\s*\bvalign="[^"]*"/, '');
    }

    // Extract and remove float
    const floatMatch = tag.match(/\bfloat="([^"]*)"/);
    if (floatMatch) {
      const dir = floatMatch[1];
      styles.push(`float: ${dir}`);
      styles.push(dir === 'right' ? 'margin: 0 0 8px 12px' : 'margin: 0 12px 8px 0');
      tag = tag.replace(/\s*\bfloat="[^"]*"/, '');
    }

    // Extract and remove border-radius
    const borderRadiusMatch = tag.match(/\bborder-radius="([^"]*)"/);
    if (borderRadiusMatch) {
      styles.push(`border-radius: ${borderRadiusMatch[1]}`);
      tag = tag.replace(/\s*\bborder-radius="[^"]*"/, '');
    }

    if (styles.length === 0) return tag;

    // Merge into existing style or add new one
    if (/\bstyle="/.test(tag)) {
      return tag.replace(/style="([^"]*)"/, (_: string, existing: string) =>
        `style="${existing}; ${styles.join('; ')}"`,
      );
    }
    return tag.replace(/<img\s/, `<img style="${styles.join('; ')}" `);
  });
}

function renderTextSegment(content: string, theme: Theme): string {
  return `<mj-section background-color="${theme.contentColor}" padding="0 32px">
      <mj-column>
        <mj-text>${processInlineImages(content)}</mj-text>
      </mj-column>
    </mj-section>`;
}

function resolvePadding(value: string | undefined): string {
  if (value === 'compact') return '12px 16px';
  if (value === 'spacious') return '32px 40px';
  return '20px 24px';
}

function renderEmbeddedButtons(buttons: Array<Record<string, string>>, theme: Theme, ctx?: SegmentContext): string {
  return buttons.map(attrs => {
    const { bgColor, textColor, border } = resolveButtonColors(attrs, theme, ctx);
    const isFullWidth = attrs.width === 'full';
    const widthAttr = isFullWidth ? ' width="100%"' : '';
    const borderRadius = resolveLength(attrs['border-radius'], theme.borderRadius, ctx, 'button border-radius');
    return `<mj-button background-color="${bgColor}" color="${textColor}" font-size="16px" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>`;
  }).join('\n        ');
}

function renderCalloutSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const align = resolveAlign(segment.attrs?.align, 'left', ctx, 'callout align');
  const bgColor = resolveColor(segment.attrs?.bg, theme.cardColor, ctx, 'callout bg');
  const textColor = resolveColor(segment.attrs?.color, theme.bodyColor, ctx, 'callout color');
  const padding = resolvePadding(segment.attrs?.padding);
  const borderRadius = resolveLength(segment.attrs?.['border-radius'], theme.borderRadius, ctx, 'callout border-radius');
  // padding="0" overrides mj-text's built-in 10px 25px default, so the card
  // column's padding preset is the full effective inset.
  const textMjml = segment.content
    ? `<mj-text align="${align}" padding="0" font-size="${theme.fontSize}" color="${textColor}" line-height="${theme.lineHeight}">${processInlineImages(segment.content)}</mj-text>`
    : '';
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column background-color="${bgColor}" border-radius="${borderRadius}" padding="${padding}">
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderCenteredSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const textColor = resolveColor(segment.attrs?.color, theme.bodyColor, ctx, 'centered color');
  const textMjml = segment.content
    ? `<mj-text align="center" font-size="${theme.fontSize}" color="${textColor}">${processInlineImages(segment.content)}</mj-text>`
    : '';
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderHighlightSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const align = resolveAlign(segment.attrs?.align, 'left', ctx, 'highlight align');
  const bgColor = resolveColor(segment.attrs?.bg, theme.brandColor, ctx, 'highlight bg');
  const textColor = resolveColor(segment.attrs?.color, theme.buttonTextColor, ctx, 'highlight color');
  const padding = resolvePadding(segment.attrs?.padding);
  const borderRadius = resolveLength(segment.attrs?.['border-radius'], theme.borderRadius, ctx, 'highlight border-radius');
  // padding="0" overrides mj-text's built-in 10px 25px default, so the card
  // column's padding preset is the full effective inset.
  const textMjml = segment.content
    ? `<mj-text align="${align}" padding="0" font-size="${theme.fontSize}" color="${textColor}" font-weight="600">${processInlineImages(segment.content)}</mj-text>`
    : '';
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column background-color="${bgColor}" border-radius="${borderRadius}" padding="${padding}">
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderHeaderSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const align = resolveAlign(segment.attrs?.align, 'center', ctx, 'header align');
  const textColor = resolveColor(segment.attrs?.color, theme.bodyColor, ctx, 'header color');
  const textMjml = segment.content
    ? `<mj-text align="${align}" font-size="13px" color="${textColor}" line-height="1.5">${processInlineImages(segment.content)}</mj-text>`
    : '';
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section padding="32px 32px 24px 32px">
      <mj-column>
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderFooterSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const align = resolveAlign(segment.attrs?.align, 'center', ctx, 'footer align');
  const textColor = resolveColor(segment.attrs?.color, theme.bodyColor, ctx, 'footer color');
  const textMjml = segment.content
    ? `<mj-text align="${align}" font-size="13px" color="${textColor}" line-height="1.5">${processInlineImages(segment.content)}</mj-text>`
    : '';
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section padding="24px 32px 32px 32px">
      <mj-column>
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderHrSegment(theme: Theme): string {
  return `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-divider border-color="${theme.cardColor}" border-width="1px" />
      </mj-column>
    </mj-section>`;
}

function resolveButtonColors(attrs: Record<string, string>, theme: Theme, ctx?: SegmentContext): { bgColor: string; textColor: string; border: string } {
  const customColor = attrs.color && isCssColor(attrs.color) ? attrs.color : undefined;
  if (attrs.color && !customColor) {
    warn(ctx, `Invalid color "${attrs.color}" for button — using theme default.`);
  }
  const variant = attrs.variant;

  if (customColor) {
    return { bgColor: customColor, textColor: '#ffffff', border: '' };
  } else if (variant === 'success') {
    return { bgColor: theme.successColor, textColor: theme.successTextColor, border: '' };
  } else if (variant === 'danger') {
    return { bgColor: theme.dangerColor, textColor: theme.dangerTextColor, border: '' };
  } else if (variant === 'warning') {
    return { bgColor: theme.warningColor, textColor: theme.warningTextColor, border: '' };
  } else if (variant === 'secondary') {
    return { bgColor: 'transparent', textColor: theme.secondaryTextColor, border: `border="2px solid ${theme.secondaryColor}"` };
  } else {
    return { bgColor: theme.buttonColor, textColor: theme.buttonTextColor, border: '' };
  }
}

function renderButtonFallback(buttons: Array<Record<string, string>>, theme: Theme, ctx?: SegmentContext): string {
  const fallbackButtons = buttons.filter(b => b.fallback);
  if (fallbackButtons.length === 0) return '';

  const template = ctx?.strings?.buttonFallback ?? DEFAULT_BUTTON_FALLBACK;

  const lines = fallbackButtons.map(b => {
    const href = escapeAttrValue(b.href);
    const linkHtml = `<a href="${href}" style="color: ${theme.bodyColor}; word-break: break-all;">${href}</a>`;
    // Single-pass substitution: handles repeated placeholders, and neither
    // scans substituted values for placeholders nor expands `$`-patterns.
    const message = b.fallback !== 'true'
      ? `${b.fallback} ${linkHtml}`
      : template.replace(/\{(text|url)\}/g, (_, key) => (key === 'text' ? b.text : linkHtml));
    return message;
  });

  return `<mj-section background-color="${theme.contentColor}" padding="0 32px">
      <mj-column>
        <mj-text font-size="12px" color="${theme.bodyColor}" line-height="1.4" align="center" padding="4px 0 8px 0">${lines.join('<br><br>')}</mj-text>
      </mj-column>
    </mj-section>`;
}

function renderButtonSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const attrs = segment.attrs!;
  const { bgColor, textColor, border } = resolveButtonColors(attrs, theme, ctx);
  const isFullWidth = attrs.width === 'full';
  const widthAttr = isFullWidth ? ' width="100%"' : '';
  const borderRadius = resolveLength(attrs['border-radius'], theme.borderRadius, ctx, 'button border-radius');

  let mjml = `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-button background-color="${bgColor}" color="${textColor}" font-size="16px" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>
      </mj-column>
    </mj-section>`;

  mjml += renderButtonFallback([attrs], theme, ctx);

  return mjml;
}

function renderButtonGroupSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const columns = segment.buttons!.map(attrs => {
    const { bgColor, textColor, border } = resolveButtonColors(attrs, theme, ctx);
    const isFullWidth = attrs.width === 'full';
    const widthAttr = isFullWidth ? ' width="100%"' : '';
    const borderRadius = resolveLength(attrs['border-radius'], theme.borderRadius, ctx, 'button border-radius');

    return `<mj-column>
        <mj-button background-color="${bgColor}" color="${textColor}" font-size="16px" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px" padding="10px 0"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>
      </mj-column>`;
  }).join('\n      ');

  let mjml = `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      ${columns}
    </mj-section>`;

  mjml += renderButtonFallback(segment.buttons!, theme, ctx);

  return mjml;
}

function renderImageSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const attrs = segment.attrs!;

  const mjAttrs: string[] = [
    `src="${escapeAttrValue(attrs.src)}"`,
    `fluid-on-mobile="true"`,
    `align="${resolveAlign(segment.attrs?.align, 'center', ctx, 'image align')}"`,
  ];

  if (attrs.alt) mjAttrs.push(`alt="${escapeAttrValue(attrs.alt)}"`);
  if (attrs.title) mjAttrs.push(`title="${escapeAttrValue(attrs.title)}"`);
  if (attrs.width) {
    const width = /^\d+$/.test(attrs.width) ? `${attrs.width}px` : attrs.width;
    if (isCssLength(width)) {
      mjAttrs.push(`width="${width}"`);
    } else {
      warn(ctx, `Invalid width "${attrs.width}" for image — ignoring.`);
    }
  }
  if (attrs.href) mjAttrs.push(`href="${escapeAttrValue(attrs.href)}"`);
  if (attrs['border-radius']) {
    const radius = resolveLength(attrs['border-radius'], theme.borderRadius, ctx, 'image border-radius');
    mjAttrs.push(`border-radius="${radius}"`);
  }

  return `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-image ${mjAttrs.join(' ')} />
      </mj-column>
    </mj-section>`;
}

function renderHeroSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  let url = segment.attrs?.url || '';
  if (url && !isSafeUrl(url)) {
    warn(ctx, `Unsafe URL "${url}" for hero background — ignoring.`);
    url = '';
  }
  const heroColor = resolveColor(segment.attrs?.color, theme.buttonTextColor, ctx, 'hero color');
  let textMjml = '';
  if (segment.content) {
    let content = processInlineImages(segment.content);
    if (segment.attrs?.color && heroColor === segment.attrs.color) {
      content = content.replace(/<(h[1-3])([\s>])/g, `<$1 style="color: ${heroColor}"$2`);
    }
    textMjml = `<mj-text align="center" color="${heroColor}">${content}</mj-text>`;
  }
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section background-url="${escapeAttrValue(url)}" background-size="cover" background-repeat="no-repeat" padding="40px 32px">
      <mj-column>
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderTableSegment(segment: Segment, theme: Theme): string {
  let tableHtml = segment.content;

  // Strip wrapper tags — mj-table only accepts <tr> rows directly
  tableHtml = tableHtml
    .replace(/<\/?table>/g, '')
    .replace(/<\/?thead>/g, '')
    .replace(/<\/?tbody>/g, '')
    .trim();

  // Add inline styles to <th> elements, preserving existing text-align
  tableHtml = tableHtml.replace(
    /<th(\s+style="([^"]*)")?>/g,
    (_, _styleAttr, existingStyle) => {
      const base = existingStyle ? `${existingStyle};` : '';
      return `<th style="${base}font-weight:700;border-bottom:2px solid ${theme.cardColor};padding:8px 12px">`;
    },
  );

  // Add inline styles to <td> elements, preserving existing text-align
  tableHtml = tableHtml.replace(
    /<td(\s+style="([^"]*)")?>/g,
    (_, _styleAttr, existingStyle) => {
      const base = existingStyle ? `${existingStyle};` : '';
      return `<td style="${base}border-bottom:1px solid ${theme.cardColor};padding:8px 12px">`;
    },
  );

  return `<mj-section background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-table color="${theme.bodyColor}" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" line-height="${theme.lineHeight}" cellpadding="0" cellspacing="0" width="100%">${tableHtml}</mj-table>
      </mj-column>
    </mj-section>`;
}

function segmentToMjml(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  switch (segment.type) {
    case 'text':
      return renderTextSegment(segment.content, theme);
    case 'callout':
      return renderCalloutSegment(segment, theme, ctx);
    case 'centered':
      return renderCenteredSegment(segment, theme, ctx);
    case 'highlight':
      return renderHighlightSegment(segment, theme, ctx);
    case 'header':
      return renderHeaderSegment(segment, theme, ctx);
    case 'footer':
      return renderFooterSegment(segment, theme, ctx);
    case 'hr':
      return renderHrSegment(theme);
    case 'button':
      return renderButtonSegment(segment, theme, ctx);
    case 'button-group':
      return renderButtonGroupSegment(segment, theme, ctx);
    case 'image':
      return renderImageSegment(segment, theme, ctx);
    case 'table':
      return renderTableSegment(segment, theme);
    case 'hero':
      return renderHeroSegment(segment, theme, ctx);
  }
}

export function segmentsToMjml(segments: Segment[], theme: Theme, ctx?: SegmentContext): string {
  return segments.map((s) => segmentToMjml(s, theme, ctx)).join('\n    ');
}

export interface MjmlRenderOptions {
  /** Minify the output HTML. Default: false. */
  minify?: boolean;
  /** Custom web fonts as a map of family name → URL (injected as <mj-font> tags). */
  fonts?: Record<string, string>;
  /** MJML validation level. Default: `'soft'`. */
  validationLevel?: 'skip' | 'soft' | 'strict';
  /** Custom template delimiters preserved during compilation. Default: `[{prefix:'{{',suffix:'}}'},{prefix:'[[',suffix:']]'}]`. */
  templateSyntax?: Array<{ prefix: string; suffix: string }>;
  /** Sanitize template variables inside CSS before minification. Only takes effect when `minify: true`. Default: false. */
  sanitizeStyles?: boolean;
  /** Pretty-print the output HTML. Ignored when `minify: true`. Default: false. */
  beautify?: boolean;
}

/** A single error reported by the MJML compiler. */
export interface MjmlCompileError {
  line?: number;
  message: string;
  tagName?: string;
  formattedMessage?: string;
}

export async function renderMjml(
  segments: Segment[],
  theme: Theme,
  meta: WrapperMeta,
  wrapper: WrapperFn,
  mjmlOptions?: MjmlRenderOptions,
): Promise<{ html: string; errors: MjmlCompileError[] }> {
  const mjmlDoc = wrapper(segments, theme, meta);
  const { html, errors } = await mjml2html(mjmlDoc, {
    minify: mjmlOptions?.minify ?? false,
    ...(mjmlOptions?.fonts ? { fonts: mjmlOptions.fonts } : {}),
    ...(mjmlOptions?.validationLevel ? { validationLevel: mjmlOptions.validationLevel } : {}),
    ...(mjmlOptions?.templateSyntax ? { templateSyntax: mjmlOptions.templateSyntax } : {}),
    ...(mjmlOptions?.sanitizeStyles !== undefined ? { sanitizeStyles: mjmlOptions.sanitizeStyles } : {}),
    ...(mjmlOptions?.beautify !== undefined ? { beautify: mjmlOptions.beautify } : {}),
  });
  return { html, errors: errors ?? [] };
}
