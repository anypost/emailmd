import mjml2html from 'mjml';
import type { ColumnCell, Segment } from './segmenter.js';
import type { Theme } from './theme.js';
import type { RenderWarning } from './warnings.js';
import { escapeHtml, escapeAttrValue, isCssColor, isCssLength, isSafeUrl } from './sanitize.js';
import { EMPTY_TABLE_HEADER_RE } from './constants.js';

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
  /**
   * Resolved dark-mode palette. When set, the head gets color-scheme meta tags
   * and `prefers-color-scheme: dark` (+ Outlook.com `[data-ogsc]`/`[data-ogsb]`)
   * style overrides.
   */
  darkTheme?: Theme;
  /** Validated frontmatter `lang`, for the output document's `lang` attribute. */
  lang?: string;
  /** Validated frontmatter `dir`, for the output document's text direction. */
  dir?: 'ltr' | 'rtl' | 'auto';
}

export type WrapperFn = (segments: Segment[], theme: Theme, meta?: WrapperMeta) => string;

/** Context threaded through segment rendering: strings overrides and a warnings collector. */
export interface SegmentContext {
  strings?: RenderStrings;
  warnings?: RenderWarning[];
  /** Document text direction; `rtl` flips the default (start-edge) alignment to `right`. */
  dir?: 'ltr' | 'rtl' | 'auto';
}

/** Default alignment for start-aligned blocks: `right` in RTL documents. */
function startAlign(ctx: SegmentContext | undefined): string {
  return ctx?.dir === 'rtl' ? 'right' : 'left';
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

type CssRule = [selector: string, declarations: string];

function renderCssRules(rules: CssRule[], prefix = ''): string {
  return rules
    .map(([sel, decl]) => {
      const selector = sel
        .split(',')
        .map((s) => (prefix ? `${prefix} ${s.trim()}` : s.trim()))
        .join(', ');
      return `${selector} { ${decl} }`;
    })
    .join('\n      ');
}

/**
 * Syntax-highlighting token colors (GitHub-flavored palettes). Fenced code
 * blocks carry `hljs-*` classed spans (see highlight.ts); the palette is
 * picked by the luminance of the code-block background so a dark card gets
 * readable tokens even under `theme: dark`.
 */
interface CodePalette {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  title: string;
  tag: string;
  attr: string;
  variable: string;
}

const LIGHT_CODE_PALETTE: CodePalette = {
  keyword: '#cf222e',
  string: '#0a3069',
  comment: '#6e7781',
  number: '#0550ae',
  title: '#8250df',
  tag: '#116329',
  attr: '#0550ae',
  variable: '#953800',
};

const DARK_CODE_PALETTE: CodePalette = {
  keyword: '#ff7b72',
  string: '#a5d6ff',
  comment: '#8b949e',
  number: '#79c0ff',
  title: '#d2a8ff',
  tag: '#7ee787',
  attr: '#79c0ff',
  variable: '#ffa657',
};

/** Perceived-brightness check for hex colors; non-hex values count as light. */
function isDarkBackground(color: string): boolean {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return false;
  let h = hex[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

function codePaletteFor(codeBackground: string): CodePalette {
  return isDarkBackground(codeBackground) ? DARK_CODE_PALETTE : LIGHT_CODE_PALETTE;
}

function codeTokenRules(p: CodePalette, important = false): CssRule[] {
  const imp = important ? ' !important' : '';
  return [
    ['pre .hljs-keyword, pre .hljs-doctag, pre .hljs-template-tag, pre .hljs-selector-tag, pre .hljs-deletion', `color: ${p.keyword}${imp};`],
    ['pre .hljs-string, pre .hljs-regexp, pre .hljs-quote, pre .hljs-attribute', `color: ${p.string}${imp};`],
    ['pre .hljs-comment', `color: ${p.comment}${imp};`],
    ['pre .hljs-number, pre .hljs-literal, pre .hljs-meta, pre .hljs-operator, pre .hljs-selector-attr, pre .hljs-selector-pseudo', `color: ${p.number}${imp};`],
    ['pre .hljs-title, pre .hljs-section, pre .hljs-type, pre .hljs-class, pre .hljs-selector-class, pre .hljs-selector-id', `color: ${p.title}${imp};`],
    ['pre .hljs-name, pre .hljs-tag, pre .hljs-addition', `color: ${p.tag}${imp};`],
    ['pre .hljs-attr, pre .hljs-property, pre .hljs-params', `color: ${p.attr}${imp};`],
    ['pre .hljs-built_in, pre .hljs-variable, pre .hljs-template-variable, pre .hljs-symbol, pre .hljs-bullet, pre .hljs-subst', `color: ${p.variable}${imp};`],
    ['pre .hljs-emphasis', `font-style: italic${imp};`],
    ['pre .hljs-strong', `font-weight: 700${imp};`],
  ];
}

/**
 * Dark-mode overrides. The `.emd-*` classes are stable hooks emitted on every
 * render (body, sections, cards, tables); `!important` is required to beat the
 * inline styles MJML generates.
 */
function buildDarkModeStyles(dark: Theme): string {
  const backgroundRules: CssRule[] = [
    ['body, .emd-root, .emd-root > div', `background-color: ${dark.backgroundColor} !important;`],
    ['.emd-bg, .emd-bg > table', `background: ${dark.contentColor} !important;`],
    ['.emd-card > table, .emd-card > table > tbody > tr > td', `background-color: ${dark.cardColor} !important;`],
    ['.emd-hl > table, .emd-hl > table > tbody > tr > td', `background-color: ${dark.brandColor} !important;`],
    ['.emd-s code, .emd-s pre', `background-color: ${dark.cardColor} !important;`],
    ['.emd-s mark', `background-color: ${dark.brandColor}33 !important;`],
    ['.emd-acc td', `background-color: ${dark.contentColor} !important;`],
  ];
  const colorRules: CssRule[] = [
    ['.emd-s div', `color: ${dark.bodyColor} !important;`],
    ['.emd-s h1, .emd-s h2, .emd-s h3', `color: ${dark.headingColor} !important;`],
    ['.emd-s div a', `color: ${dark.brandColor} !important;`],
    ['.emd-hl div', `color: ${dark.buttonTextColor} !important;`],
    ['.emd-s blockquote', `border-color: ${dark.brandColor} !important;`],
    ['.emd-s p[style*="border-top"]', `border-color: ${dark.dividerColor} !important;`],
    ['.emd-tbl', `color: ${dark.bodyColor} !important;`],
    ['.emd-tbl th, .emd-tbl td', `border-color: ${dark.cardColor} !important;`],
    ['.emd-acc table', `border-color: ${dark.dividerColor} !important;`],
    ['.emd-acc .mj-accordion-title td', `color: ${dark.headingColor} !important;`],
    ['.emd-acc .mj-accordion-content td', `color: ${dark.bodyColor} !important;`],
    ...codeTokenRules(codePaletteFor(dark.cardColor), true),
  ];

  return `<mj-style>
      @media (prefers-color-scheme: dark) {
      ${renderCssRules(backgroundRules)}
      ${renderCssRules(colorRules)}
      }
      ${renderCssRules(backgroundRules, '[data-ogsb]')}
      ${renderCssRules(colorRules, '[data-ogsc]')}
    </mj-style>
    <mj-raw>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
    </mj-raw>`;
}

export function buildHead(theme: Theme, preheader?: string, darkTheme?: Theme, dir?: 'ltr' | 'rtl' | 'auto'): string {
  // MJML hardcodes text-align:left on text blocks, so RTL documents flip the
  // default alignment and the left-anchored styles (blockquote bar, list indent).
  const rtl = dir === 'rtl';
  const start = rtl ? 'right' : 'left';
  return `<mj-head>
    <mj-attributes>
      <mj-all font-family="${theme.fontFamily}" />
      <mj-text font-size="${theme.fontSize}" line-height="${theme.lineHeight}" color="${theme.bodyColor}"${rtl ? ' align="right"' : ''} />
    </mj-attributes>
    <mj-style>
      h1 { font-size: 32px; font-weight: 700; color: ${theme.headingColor}; margin: 0 0 12px 0; }
      h2 { font-size: 24px; font-weight: 700; color: ${theme.headingColor}; margin: 0 0 10px 0; }
      h3 { font-size: 20px; font-weight: 600; color: ${theme.headingColor}; margin: 0 0 8px 0; }
      a { color: ${theme.brandColor}; }
      blockquote { border-${start}: 3px solid ${theme.brandColor}; padding-${start}: 16px; margin: 0; }
      blockquote blockquote { border-color: ${theme.cardColor}; }
      code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: ${theme.cardColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
      pre { background-color: ${theme.cardColor}; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 0; }
      pre code { background-color: transparent; padding: 0; border-radius: 0; font-size: inherit; }
      ul, ol { margin: 0 0 8px 0; padding-${start}: 24px; }
      li { margin-bottom: 4px; }
      .task-list-item { list-style-type: none; margin-${start}: -24px; }
      ul ul, ol ol, ul ol, ol ul { margin-top: 4px; margin-bottom: 0; }
      mark { background-color: ${theme.brandColor}33; padding: 2px 4px; border-radius: 2px; }
      dl { margin: 0 0 8px 0; }
      dt { font-weight: 700; margin-top: 8px; }
      dd { margin: ${rtl ? '2px 24px 0 0' : '2px 0 0 24px'}; }
      img { vertical-align: middle; }
      ${renderCssRules(codeTokenRules(codePaletteFor(theme.cardColor)))}
    </mj-style>
    ${darkTheme ? buildDarkModeStyles(darkTheme) : ''}
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
  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="0 32px">
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
  const align = resolveAlign(segment.attrs?.align, startAlign(ctx), ctx, 'callout align');
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
  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column css-class="emd-card" background-color="${bgColor}" border-radius="${borderRadius}" padding="${padding}">
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
  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function renderHighlightSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const align = resolveAlign(segment.attrs?.align, startAlign(ctx), ctx, 'highlight align');
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
  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column css-class="emd-hl" background-color="${bgColor}" border-radius="${borderRadius}" padding="${padding}">
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
  let mjml = `<mj-section css-class="emd-s" padding="32px 32px 24px 32px">
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
  let mjml = `<mj-section css-class="emd-s" padding="24px 32px 32px 32px">
      <mj-column>
        ${textMjml}${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function resolveSpacerHeight(value: string | undefined, ctx?: SegmentContext): string {
  if (!value) return '24px';
  // A bare number is pixels: ::: spacer 32 → 32px
  const height = /^\d+$/.test(value) ? `${value}px` : value;
  if (isCssLength(height)) return height;
  warn(ctx, `Invalid height "${value}" for spacer — using 24px.`);
  return '24px';
}

function renderSpacerSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const height = resolveSpacerHeight(segment.attrs?.height, ctx);
  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="0 32px">
      <mj-column>
        <mj-spacer height="${height}" />
      </mj-column>
    </mj-section>`;
}

function dividerMjAttrs(attrs: Record<string, string> | undefined, theme: Theme, ctx?: SegmentContext): string {
  const color = resolveColor(attrs?.color, theme.dividerColor, ctx, 'divider color');
  const rawThickness = attrs?.thickness && /^\d+$/.test(attrs.thickness) ? `${attrs.thickness}px` : attrs?.thickness;
  const thickness = resolveLength(rawThickness, '1px', ctx, 'divider thickness');
  const parts = [`border-color="${color}"`, `border-width="${thickness}"`];
  if (attrs?.width) {
    if (isCssLength(attrs.width)) {
      parts.push(`width="${attrs.width}"`);
    } else {
      warn(ctx, `Invalid width "${attrs.width}" for divider — ignoring.`);
    }
  }
  if (attrs?.align) {
    parts.push(`align="${resolveAlign(attrs.align, 'center', ctx, 'divider align')}"`);
  }
  return parts.join(' ');
}

function renderHrSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-divider ${dividerMjAttrs(segment.attrs, theme, ctx)} />
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

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="0 32px">
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

  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
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

  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      ${columns}
    </mj-section>`;

  mjml += renderButtonFallback(segment.buttons!, theme, ctx);

  return mjml;
}

function buildImageMjAttrs(attrs: Record<string, string>, theme: Theme, ctx?: SegmentContext): string[] {
  const mjAttrs: string[] = [
    `src="${escapeAttrValue(attrs.src)}"`,
    `fluid-on-mobile="true"`,
    `align="${resolveAlign(attrs.align, 'center', ctx, 'image align')}"`,
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

  return mjAttrs;
}

function imageCaptionMjml(attrs: Record<string, string>, theme: Theme, fallbackAlign = 'center'): string {
  if (!attrs.caption) return '';
  const align = attrs.align && ALIGN_VALUES.has(attrs.align) ? attrs.align : fallbackAlign;
  // Caption values arrive entity-escaped from markdown-it; escapeAttrValue
  // blocks tag injection without double-escaping `&`.
  return `<mj-text align="${align}" padding="4px 0 0" font-size="13px" color="${theme.bodyColor}" line-height="1.5">${escapeAttrValue(attrs.caption)}</mj-text>`;
}

function renderImageSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const mjAttrs = buildImageMjAttrs(segment.attrs!, theme, ctx);
  const caption = imageCaptionMjml(segment.attrs!, theme);

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-image ${mjAttrs.join(' ')} />${caption ? `\n        ${caption}` : ''}
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

/** Split accordion content on headings: each heading opens a new panel. */
function parseAccordionPanels(content: string): { intro: string; panels: Array<{ title: string; body: string }> } {
  const headingRe = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g;
  const panels: Array<{ title: string; body: string }> = [];
  let intro = '';
  let lastTitle: string | null = null;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(content)) !== null) {
    const before = content.slice(lastEnd, match.index);
    if (lastTitle === null) {
      intro = before;
    } else {
      panels.push({ title: lastTitle, body: before });
    }
    lastTitle = match[1].replace(/<[^>]*>/g, '').trim();
    lastEnd = match.index + match[0].length;
  }
  if (lastTitle !== null) {
    panels.push({ title: lastTitle, body: content.slice(lastEnd) });
  } else {
    intro = content;
  }
  return { intro, panels };
}

function renderAccordionSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const { intro, panels } = parseAccordionPanels(segment.content);

  if (panels.length === 0) {
    warn(ctx, 'Accordion contains no headings — rendering its content as regular text.');
    return renderTextSegment(segment.content, theme);
  }

  const iconAttrs: string[] = [];
  for (const [param, mjAttr] of [
    ['icon-wrapped', 'icon-wrapped-url'],
    ['icon-unwrapped', 'icon-unwrapped-url'],
  ] as const) {
    const url = segment.attrs?.[param];
    if (!url) continue;
    if (isSafeUrl(url)) {
      iconAttrs.push(`${mjAttr}="${escapeAttrValue(url)}"`);
    } else {
      warn(ctx, `Unsafe URL "${url}" for accordion ${param} — using the default icon.`);
    }
  }

  const introMjml = intro.trim()
    ? `<mj-text padding="0 0 8px" font-size="${theme.fontSize}" color="${theme.bodyColor}" line-height="${theme.lineHeight}">${processInlineImages(intro)}</mj-text>
        `
    : '';
  const elements = panels
    .map(
      (panel) => `<mj-accordion-element background-color="${theme.contentColor}">
            <mj-accordion-title color="${theme.headingColor}" font-size="${theme.fontSize}" font-family="${theme.fontFamily}" padding="12px 4px">${escapeAttrValue(panel.title)}</mj-accordion-title>
            <mj-accordion-text color="${theme.bodyColor}" font-size="${theme.fontSize}" font-family="${theme.fontFamily}" line-height="${theme.lineHeight}" padding="0 4px 12px">${panel.body}</mj-accordion-text>
          </mj-accordion-element>`,
    )
    .join('\n          ');

  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        ${introMjml}<mj-accordion css-class="emd-acc" border="1px solid ${theme.dividerColor}" font-family="${theme.fontFamily}"${iconAttrs.length > 0 ? ' ' + iconAttrs.join(' ') : ''}>
          ${elements}
        </mj-accordion>${buttonMjml}
      </mj-column>
    </mj-section>`;
  if (segment.buttons) mjml += renderButtonFallback(segment.buttons, theme, ctx);
  return mjml;
}

function styleTableHtml(html: string, theme: Theme): string {
  let tableHtml = html;

  // An all-empty header row means "headerless table" — drop the row.
  tableHtml = tableHtml.replace(EMPTY_TABLE_HEADER_RE, '');

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

  return tableHtml;
}

function tableMjAttrs(theme: Theme): string {
  return `css-class="emd-tbl" color="${theme.bodyColor}" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" line-height="${theme.lineHeight}" cellpadding="0" cellspacing="0" width="100%"`;
}

function renderTableSegment(segment: Segment, theme: Theme): string {
  const tableHtml = styleTableHtml(segment.content, theme);

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-table ${tableMjAttrs(theme)}>${tableHtml}</mj-table>
      </mj-column>
    </mj-section>`;
}

/** Hostname → mj-social-element network name (which selects the icon). */
const SOCIAL_NETWORKS: Array<{ hosts: RegExp; name: string }> = [
  { hosts: /(^|\.)facebook\.com$/i, name: 'facebook' },
  { hosts: /(^|\.)(?:twitter|x)\.com$/i, name: 'x' },
  { hosts: /(^|\.)instagram\.com$/i, name: 'instagram' },
  { hosts: /(^|\.)linkedin\.com$/i, name: 'linkedin' },
  { hosts: /(^|\.)github\.com$/i, name: 'github' },
  { hosts: /(^|\.)(?:youtube\.com|youtu\.be)$/i, name: 'youtube' },
  { hosts: /(^|\.)pinterest\.[a-z.]+$/i, name: 'pinterest' },
  { hosts: /(^|\.)medium\.com$/i, name: 'medium' },
  { hosts: /(^|\.)vimeo\.com$/i, name: 'vimeo' },
  { hosts: /(^|\.)dribbble\.com$/i, name: 'dribbble' },
  { hosts: /(^|\.)soundcloud\.com$/i, name: 'soundcloud' },
  { hosts: /(^|\.)tumblr\.com$/i, name: 'tumblr' },
  { hosts: /(^|\.)snapchat\.com$/i, name: 'snapchat' },
  { hosts: /(^|\.)xing\.com$/i, name: 'xing' },
];

function socialNetworkForUrl(href: string): string {
  try {
    const host = new URL(href).hostname;
    for (const network of SOCIAL_NETWORKS) {
      if (network.hosts.test(host)) return network.name;
    }
  } catch {
    // Relative URLs, mailto:, etc. fall through to the generic icon.
  }
  return 'web';
}

const SOCIAL_LINK_RE = /<a\s+([^>]*)>([\s\S]*?)<\/a>/g;

function renderSocialSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const links: Array<{ href: string; label: string; icon?: string }> = [];
  const re = new RegExp(SOCIAL_LINK_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(segment.content)) !== null) {
    const hrefMatch = match[1].match(/href="([^"]*)"/);
    if (!hrefMatch) continue;
    const iconMatch = match[1].match(/\bicon="([^"]*)"/);
    links.push({
      href: hrefMatch[1],
      label: match[2].replace(/<[^>]*>/g, '').trim(),
      icon: iconMatch?.[1],
    });
  }

  if (links.length === 0) {
    warn(ctx, 'Social block contains no links — nothing to render.');
    return '';
  }

  const showLabels = segment.attrs?.labels === 'true';
  const align = resolveAlign(segment.attrs?.align, 'center', ctx, 'social align');
  const rawSize = segment.attrs?.['icon-size'];
  const iconSize = resolveLength(
    rawSize && /^\d+$/.test(rawSize) ? `${rawSize}px` : rawSize,
    '24px',
    ctx,
    'social icon-size',
  );

  let iconBase = segment.attrs?.['icon-base'];
  if (iconBase && !isSafeUrl(iconBase)) {
    warn(ctx, `Unsafe icon-base URL "${iconBase}" for social — using default icons.`);
    iconBase = undefined;
  }
  if (iconBase && !iconBase.endsWith('/')) iconBase += '/';

  const elements = links.map((link) => {
    const name = socialNetworkForUrl(link.href);
    let srcAttr = '';
    if (link.icon) {
      if (isSafeUrl(link.icon)) {
        srcAttr = ` src="${escapeAttrValue(link.icon)}"`;
      } else {
        warn(ctx, `Unsafe icon URL "${link.icon}" for social link — using default icon.`);
      }
    }
    if (!srcAttr && iconBase) {
      srcAttr = ` src="${escapeAttrValue(`${iconBase}${name}.png`)}"`;
    }
    const label = showLabels ? link.label : '';
    // -noshare links to the URL directly; the bare name would wrap it in the
    // network's share-intent URL.
    return `<mj-social-element name="${name}-noshare"${srcAttr} href="${escapeAttrValue(link.href)}">${label}</mj-social-element>`;
  }).join('\n          ');

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-social mode="horizontal" align="${align}" icon-size="${iconSize}" font-size="13px" color="${theme.bodyColor}" padding="0">
          ${elements}
        </mj-social>
      </mj-column>
    </mj-section>`;
}

const VALIGN_VALUES = new Set(['top', 'middle', 'bottom']);

function resolveValign(value: string | undefined, ctx: SegmentContext | undefined): string | undefined {
  if (!value) return undefined;
  if (VALIGN_VALUES.has(value)) return value;
  warn(ctx, `Invalid vertical alignment "${value}" for column — using "top".`);
  return undefined;
}

function resolveColumnWidth(value: string | undefined, ctx?: SegmentContext): string | undefined {
  if (!value) return undefined;
  // A bare number is a percentage: width=40 → 40%
  const width = /^\d+(?:\.\d+)?$/.test(value) ? `${value}%` : value;
  if (isCssLength(width)) return width;
  warn(ctx, `Invalid width "${value}" for column — ignoring.`);
  return undefined;
}

function renderCellButton(attrs: Record<string, string>, theme: Theme, ctx?: SegmentContext, cellAlign?: string): string {
  const { bgColor, textColor, border } = resolveButtonColors(attrs, theme, ctx);
  const widthAttr = attrs.width === 'full' ? ' width="100%"' : '';
  const borderRadius = resolveLength(attrs['border-radius'], theme.borderRadius, ctx, 'button border-radius');
  const alignAttr = cellAlign ? ` align="${cellAlign}"` : '';
  return `<mj-button padding="8px 0"${alignAttr} background-color="${bgColor}" color="${textColor}" font-size="16px" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>`;
}

function renderCellSegments(cell: ColumnCell, theme: Theme, ctx?: SegmentContext): string {
  const cellAlign = cell.attrs?.align ? resolveAlign(cell.attrs.align, startAlign(ctx), ctx, 'column align') : undefined;
  const textColor = cell.attrs?.color ? resolveColor(cell.attrs.color, theme.bodyColor, ctx, 'column color') : undefined;

  const parts: string[] = [];
  for (const seg of cell.segments) {
    switch (seg.type) {
      case 'text': {
        const alignAttr = cellAlign ? ` align="${cellAlign}"` : '';
        const colorAttr = textColor ? ` color="${textColor}"` : '';
        parts.push(`<mj-text padding="4px 0"${alignAttr}${colorAttr}>${processInlineImages(seg.content)}</mj-text>`);
        break;
      }
      case 'image': {
        const attrs = { ...seg.attrs! };
        if (!attrs.align && cellAlign) attrs.align = cellAlign;
        parts.push(`<mj-image padding="4px 0" ${buildImageMjAttrs(attrs, theme, ctx).join(' ')} />`);
        const caption = imageCaptionMjml(attrs, theme);
        if (caption) parts.push(caption);
        break;
      }
      case 'button':
        parts.push(renderCellButton(seg.attrs!, theme, ctx, cellAlign));
        break;
      case 'button-group':
        // No nested groups inside a column — stack the buttons instead.
        for (const attrs of seg.buttons!) parts.push(renderCellButton(attrs, theme, ctx, cellAlign));
        break;
      case 'hr':
        parts.push(`<mj-divider padding="8px 0" ${dividerMjAttrs(seg.attrs, theme, ctx)} />`);
        break;
      case 'spacer':
        parts.push(`<mj-spacer height="${resolveSpacerHeight(seg.attrs?.height, ctx)}" />`);
        break;
      case 'table':
        parts.push(`<mj-table ${tableMjAttrs(theme)}>${styleTableHtml(seg.content, theme)}</mj-table>`);
        break;
      default:
        break;
    }
  }
  return parts.join('\n        ');
}

function renderColumnsSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const cells = segment.cells ?? [];
  if (cells.length === 0) {
    warn(ctx, 'Empty columns block — nothing to render.');
    return '';
  }

  let gap = 16;
  if (segment.attrs?.gap !== undefined) {
    const raw = segment.attrs.gap.replace(/px$/, '');
    if (/^\d+$/.test(raw)) {
      gap = parseInt(raw, 10);
    } else {
      warn(ctx, `Invalid gap "${segment.attrs.gap}" for columns — using 16px.`);
    }
  }

  const last = cells.length - 1;
  const columnsMjml = cells.map((cell, i) => {
    const attrs: string[] = [];
    const width = resolveColumnWidth(cell.attrs?.width, ctx);
    if (width) attrs.push(`width="${width}"`);
    const valign = resolveValign(cell.attrs?.valign, ctx);
    if (valign) attrs.push(`vertical-align="${valign}"`);

    const bg = cell.attrs?.bg ? resolveColor(cell.attrs.bg, theme.cardColor, ctx, 'column bg') : undefined;
    if (bg) {
      // mj-column paints its background across its own padding box, so a bg
      // cell takes a card inset instead of gutter halves; visual separation
      // comes from its neighbors' gutters.
      attrs.push(`css-class="emd-card"`, `background-color="${bg}"`, `border-radius="${theme.borderRadius}"`, `padding="${resolvePadding(cell.attrs?.padding)}"`);
    } else {
      const left = i === 0 ? 0 : Math.floor(gap / 2);
      const right = i === last ? 0 : Math.ceil(gap / 2);
      attrs.push(`padding="0 ${right}px 0 ${left}px"`);
    }

    return `<mj-column ${attrs.join(' ')}>
        ${renderCellSegments(cell, theme, ctx)}
      </mj-column>`;
  }).join('\n      ');

  // stack=false keeps columns side-by-side on mobile via mj-group.
  const stack = segment.attrs?.stack !== 'false';
  const inner = stack ? columnsMjml : `<mj-group>\n      ${columnsMjml}\n      </mj-group>`;

  let mjml = `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      ${inner}
    </mj-section>`;

  const fallbackButtons = cells.flatMap((c) => c.segments.flatMap((s) =>
    s.type === 'button' ? [s.attrs!] : s.type === 'button-group' ? s.buttons! : []));
  mjml += renderButtonFallback(fallbackButtons, theme, ctx);

  return mjml;
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
      return renderHrSegment(segment, theme, ctx);
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
    case 'columns':
      return renderColumnsSegment(segment, theme, ctx);
    case 'spacer':
      return renderSpacerSegment(segment, theme, ctx);
    case 'social':
      return renderSocialSegment(segment, theme, ctx);
    case 'accordion':
      return renderAccordionSegment(segment, theme, ctx);
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
