import mjml2html from 'mjml';
import type { ColumnCell, Segment } from './segmenter.js';
import type { Theme } from './theme.js';
import type { RenderWarning } from './warnings.js';
import { escapeHtml, escapeAttrValue, isCssColor, isCssLength, isSafeUrl, normalizeCssLength } from './sanitize.js';
import { EMPTY_TABLE_HEADER_RE } from './constants.js';
import { parseChart, resolveChartMax } from './chart.js';
import { barPercent, TREND_ARROWS } from './bar.js';
import { parseProgress, type ProgressData } from './progress.js';
import { parseSparkline } from './sparkline.js';
import { parseStats, defaultStatColumns, type StatItem } from './stats.js';

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
  /** Custom CSS to emit as an extra `<mj-style>` in the head (see {@link RenderOptions.css}). */
  css?: string;
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
  if (isCssLength(value)) return normalizeCssLength(value);
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
    ['.emd-chart-bar-themed', `background-color: ${dark.brandColor} !important;`],
    ['.emd-chart-track-themed', `background-color: ${dark.cardColor} !important;`],
    ['.emd-progress-bar-themed', `background-color: ${dark.brandColor} !important;`],
    ['.emd-progress-track-themed', `background-color: ${dark.cardColor} !important;`],
    ['.emd-sparkline-bar-themed', `background-color: ${dark.brandColor} !important;`],
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
    ['.emd-chart-label', `color: ${dark.bodyColor} !important;`],
    ['.emd-chart-value', `color: ${dark.headingColor} !important;`],
    ['.emd-progress-label', `color: ${dark.bodyColor} !important;`],
    ['.emd-progress-value', `color: ${dark.headingColor} !important;`],
    ['.emd-sparkline-label', `color: ${dark.bodyColor} !important;`],
    ['.emd-sparkline-value', `color: ${dark.headingColor} !important;`],
    ['.emd-sparkline-delta-themed', `color: ${dark.bodyColor} !important;`],
    ['.emd-stat-label', `color: ${dark.bodyColor} !important;`],
    ['.emd-stat-value-themed', `color: ${dark.headingColor} !important;`],
    ['.emd-stat-delta-themed', `color: ${dark.bodyColor} !important;`],
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

export function buildHead(theme: Theme, preheader?: string, darkTheme?: Theme, dir?: 'ltr' | 'rtl' | 'auto', css?: string): string {
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
      p { margin: 0 0 16px 0; }
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
    ${css ? `<mj-style>${css}</mj-style>` : ''}
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
      styles.push(`border-radius: ${normalizeCssLength(borderRadiusMatch[1])}`);
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
    return `<mj-button css-class="emd-btn" background-color="${bgColor}" color="${textColor}" font-size="${theme.fontSize}" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>`;
  }).join('\n        ');
}

/** Block elements the head styles give a bottom-only margin. */
const TRAILING_MARGIN_TAGS = /^(?:h[1-6]|p|ul|ol|dl|blockquote|table)$/;

/**
 * Inline margin-bottom:0 on the final top-level block element, so content
 * sits symmetrically inside a padded box (callout, highlight, hero, …) —
 * without this, the last block's bottom margin stacks on the box padding.
 */
function zeroTrailingBlockMargin(html: string): string {
  const trimmed = html.trimEnd();
  const close = trimmed.match(/<\/([a-z][a-z0-9]*)>$/);
  if (!close || !TRAILING_MARGIN_TAGS.test(close[1])) return html;
  const tag = close[1];
  // Find the opening tag matching the final close — same-tag nesting
  // (e.g. lists in lists) must balance, so walk the pairs backwards.
  const re = new RegExp(`<${tag}(?=[\\s/>])|</${tag}>`, 'g');
  const tokens: Array<{ index: number; open: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) tokens.push({ index: m.index, open: m[0][1] !== '/' });
  let depth = 0;
  let openIndex = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    depth += tokens[i].open ? -1 : 1;
    if (depth === 0) {
      openIndex = tokens[i].index;
      break;
    }
  }
  if (openIndex === -1) return html;
  const tagEnd = trimmed.indexOf('>', openIndex);
  const openTag = trimmed.slice(openIndex, tagEnd + 1);
  const styled = openTag.includes('style="')
    ? openTag.replace(/style="([^"]*)"/, 'style="$1; margin-bottom: 0"')
    : `${openTag.slice(0, -1)} style="margin-bottom: 0">`;
  return trimmed.slice(0, openIndex) + styled + trimmed.slice(tagEnd + 1);
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
    ? `<mj-text align="${align}" padding="0" font-size="${theme.fontSize}" color="${textColor}" line-height="${theme.lineHeight}">${zeroTrailingBlockMargin(processInlineImages(segment.content))}</mj-text>`
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
    ? `<mj-text align="${align}" padding="0" font-size="${theme.fontSize}" color="${textColor}" font-weight="600">${zeroTrailingBlockMargin(processInlineImages(segment.content))}</mj-text>`
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
        <mj-button css-class="emd-btn" background-color="${bgColor}" color="${textColor}" font-size="${theme.fontSize}" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>
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
        <mj-button css-class="emd-btn" background-color="${bgColor}" color="${textColor}" font-size="${theme.fontSize}" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px" padding="10px 0"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>
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
  const bgColor = resolveColor(segment.attrs?.bg, theme.buttonColor, ctx, 'hero bg');
  let textMjml = '';
  if (segment.content) {
    let content = processInlineImages(segment.content);
    // The head's h1-h3 color rules beat the color inherited from mj-text, so
    // the hero text color must be inlined on headings.
    content = content.replace(/<(h[1-3])([\s>])/g, `<$1 style="color: ${heroColor}"$2`);
    textMjml = `<mj-text align="center" color="${heroColor}">${zeroTrailingBlockMargin(content)}</mj-text>`;
  }
  const buttonMjml = segment.buttons ? renderEmbeddedButtons(segment.buttons, theme, ctx) : '';
  // Hero colors are a self-contained pair, so dark mode leaves them alone;
  // the emd-hero/emd-hero-solid classes are hooks for custom wrapper CSS.
  const cssClass = url ? 'emd-hero' : 'emd-hero emd-hero-solid';
  const bgImage = url ? ` background-url="${escapeAttrValue(url)}" background-size="cover" background-repeat="no-repeat"` : '';
  let mjml = `<mj-section css-class="${cssClass}" background-color="${bgColor}"${bgImage} padding="40px 32px">
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
            <mj-accordion-text color="${theme.bodyColor}" font-size="${theme.fontSize}" font-family="${theme.fontFamily}" line-height="${theme.lineHeight}" padding="0 4px 12px">${zeroTrailingBlockMargin(panel.body)}</mj-accordion-text>
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

/** Bar geometry: thickness, its attribute backstop, and end rounding. */
interface BarShape {
  height: string;
  heightAttr: string;
  radius: string;
}

/**
 * Bar thickness and end rounding, shared by `chart` and `progress` so the two
 * take the same values and default the same way.
 */
function resolveBarShape(
  attrs: Record<string, string> | undefined,
  fallbackHeight: string,
  name: string,
  ctx?: SegmentContext,
): BarShape {
  const rawHeight = attrs?.height;
  const height = resolveLength(
    rawHeight && /^\d+$/.test(rawHeight) ? `${rawHeight}px` : rawHeight,
    fallbackHeight,
    ctx,
    `${name} height`,
  );

  // The height attribute is a backstop for clients that drop the inline
  // height; it only takes a bare pixel count, so other units go without.
  const heightPx = /^(\d+)px$/.exec(height)?.[1];

  // Bars default to a pill — half the bar height — but take an explicit
  // `border-radius` like the other rounded blocks do, so `border-radius=0`
  // gets square ends. A zero radius emits no declaration at all.
  const derivedRadius = heightPx ? `${Math.round(parseInt(heightPx, 10) / 2)}px` : '';
  const rawRadius = attrs?.['border-radius'];
  let radius = rawRadius !== undefined
    ? resolveLength(rawRadius, derivedRadius, ctx, `${name} border-radius`)
    : derivedRadius;
  if (/^0(?:[a-z%]+)?$/.test(radius)) radius = '';

  return { height, heightAttr: heightPx ? ` height="${heightPx}"` : '', radius };
}

/** One segment of a bar: a colored cell with no content but its own height. */
function barCell(cls: string, color: string, width: number, corners: string, shape: BarShape): string {
  return `<td class="${cls}" bgcolor="${color}" width="${width}%"${shape.heightAttr} style="width:${width}%;height:${shape.height};line-height:${shape.height};font-size:1px;background-color:${color};${corners ? `border-radius:${corners};` : ''}">&nbsp;</td>`;
}

/**
 * A horizontal bar: the fill and the remaining groove, inside a fixed-layout
 * table so the split lands on the same percentage in every client, Outlook
 * included. Only the outer ends are rounded, so a partly-filled bar reads as
 * one pill rather than two; in RTL the groove comes first and the bar grows
 * from the right edge.
 */
function renderBar(
  pct: number,
  fill: string,
  fillClass: string,
  trackColor: string,
  trackClass: string,
  shape: BarShape,
  rtl: boolean,
): string {
  const { radius } = shape;
  const startCorners = radius ? (rtl ? `0 ${radius} ${radius} 0` : `${radius} 0 0 ${radius}`) : '';
  const endCorners = radius ? (rtl ? `${radius} 0 0 ${radius}` : `0 ${radius} ${radius} 0`) : '';

  let cells: string;
  if (pct >= 100) {
    cells = barCell(fillClass, fill, 100, radius, shape);
  } else if (pct <= 0) {
    cells = barCell(trackClass, trackColor, 100, radius, shape);
  } else {
    const filled = barCell(fillClass, fill, pct, startCorners, shape);
    const rest = barCell(trackClass, trackColor, 100 - pct, endCorners, shape);
    cells = rtl ? rest + filled : filled + rest;
  }

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;table-layout:fixed;border-collapse:separate;">
              <tr>${cells}</tr>
            </table>`;
}

/**
 * Horizontal bar chart, built entirely from table cells with background
 * colors: no images, no SVG, no CSS that clients strip.
 * The `emd-chart-*` classes are dark-mode hooks; only bars left at their theme
 * color carry the `-themed` variant, so an author's explicit color survives
 * the dark palette the way hero colors do.
 */
function renderChartSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const { intro, items, skipped } = parseChart(segment.content);

  if (items.length === 0) {
    warn(ctx, 'Chart contains no "Label: value" list items — rendering its content as regular text.');
    return renderTextSegment(segment.content, theme);
  }
  if (skipped > 0) {
    warn(ctx, `${skipped} chart item${skipped === 1 ? '' : 's'} had no "Label: value" shape and ${skipped === 1 ? 'was' : 'were'} skipped.`);
  }

  const barColor = resolveColor(segment.attrs?.color, theme.brandColor, ctx, 'chart color');
  const trackColor = resolveColor(segment.attrs?.track, theme.cardColor, ctx, 'chart track');
  const shape = resolveBarShape(segment.attrs, '10px', 'chart', ctx);
  const showValues = segment.attrs?.values !== 'false';

  let maxOverride: number | undefined;
  if (segment.attrs?.max !== undefined) {
    const parsed = parseFloat(segment.attrs.max.replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      maxOverride = parsed;
    } else {
      warn(ctx, `Invalid max "${segment.attrs.max}" for chart — scaling to the largest value.`);
    }
  }
  const max = resolveChartMax(items, maxOverride);

  const rtl = ctx?.dir === 'rtl';
  const labelAlign = startAlign(ctx);
  const valueAlign = rtl ? 'left' : 'right';

  const themedBar = !segment.attrs?.color;
  const trackClass = `emd-chart-track${segment.attrs?.track ? '' : ' emd-chart-track-themed'}`;

  const rows = items.map((item, i) => {
    const fill = item.color
      ? resolveColor(item.color, barColor, ctx, `chart bar "${item.label}"`)
      : barColor;
    const barClass = `emd-chart-bar${themedBar && !item.color ? ' emd-chart-bar-themed' : ''}`;
    const bar = renderBar(barPercent(item.value, max), fill, barClass, trackColor, trackClass, shape, rtl);

    const labelCell = `<td class="emd-chart-label" align="${labelAlign}"${showValues ? '' : ' colspan="2"'} style="padding:0 0 5px 0;font-size:${theme.fontSize};line-height:1.4;color:${theme.bodyColor};">${escapeAttrValue(item.label)}</td>`;
    const valueCell = showValues
      ? `<td class="emd-chart-value" align="${valueAlign}" style="padding:0 0 5px 0;font-size:${theme.fontSize};line-height:1.4;font-weight:700;color:${theme.headingColor};white-space:nowrap;">${escapeAttrValue(item.display)}</td>`
      : '';
    // MJML pins the column to direction:ltr, so cell *order* is what puts each
    // one on its edge — aligning the text alone leaves both stranded mid-row.
    const captionCells = rtl ? valueCell + labelCell : labelCell + valueCell;
    const gap = i === items.length - 1 ? '0' : '0 0 14px 0';

    return `<tr>${captionCells}</tr>
          <tr><td colspan="2" style="padding:${gap};">
            ${bar}
          </td></tr>`;
  });

  const introMjml = intro.trim()
    ? `<mj-text padding="0 0 8px" font-size="${theme.fontSize}" color="${theme.bodyColor}" line-height="${theme.lineHeight}">${processInlineImages(intro)}</mj-text>
        `
    : '';

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        ${introMjml}<mj-table css-class="emd-chart" role="presentation" cellpadding="0" cellspacing="0" width="100%" padding="4px 0" font-family="${theme.fontFamily}">
          ${rows.join('\n          ')}
        </mj-table>
      </mj-column>
    </mj-section>`;
}

/** Gap between the segments of a stepped meter. */
const STEP_GAP = '6px';

/**
 * A stepped meter: one rounded segment per step, with the gaps made from cell
 * padding rather than border-spacing, which Outlook ignores. The DOM stays
 * left-to-right, so RTL walks the steps backwards to put the first one on the
 * right edge.
 */
function renderSteppedBar(
  data: ProgressData,
  fill: string,
  fillClass: string,
  trackColor: string,
  trackClass: string,
  shape: BarShape,
  rtl: boolean,
): string {
  const width = Math.round((100 / data.steps) * 100) / 100;
  const cells = Array.from({ length: data.steps }, (_, position) => {
    const step = rtl ? data.steps - 1 - position : position;
    const on = step < data.filled;
    const pad = position === data.steps - 1 ? '0' : `0 ${STEP_GAP} 0 0`;
    const segment = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:separate;"><tr>${barCell(on ? fillClass : trackClass, on ? fill : trackColor, 100, shape.radius, shape)}</tr></table>`;
    return `<td width="${width}%" style="width:${width}%;padding:${pad};">${segment}</td>`;
  });

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;table-layout:fixed;border-collapse:separate;">
              <tr>${cells.join('')}</tr>
            </table>`;
}

/**
 * A progress bar: one value against a known maximum, drawn from the same
 * table cells as a chart bar. The unfilled groove always shows — a lone bar
 * has no sibling to be read against, so the gap to the goal is the point.
 */
function renderProgressSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const data = parseProgress(segment.content, segment.attrs ?? {});
  if (!data) {
    warn(ctx, 'Progress block has no numeric value — rendering its content as regular text.');
    return renderTextSegment(segment.content, theme);
  }
  for (const message of data.warnings) warn(ctx, message);

  const fill = resolveColor(segment.attrs?.color, theme.brandColor, ctx, 'progress color');
  const trackColor = resolveColor(segment.attrs?.track, theme.cardColor, ctx, 'progress track');
  const shape = resolveBarShape(segment.attrs, '10px', 'progress', ctx);
  const rtl = ctx?.dir === 'rtl';
  const fillClass = `emd-progress-bar${segment.attrs?.color ? '' : ' emd-progress-bar-themed'}`;
  const trackClass = `emd-progress-track${segment.attrs?.track ? '' : ' emd-progress-track-themed'}`;

  const bar = data.steps > 0
    ? renderSteppedBar(data, fill, fillClass, trackColor, trackClass, shape, rtl)
    : renderBar(data.pct, fill, fillClass, trackColor, trackClass, shape, rtl);

  const labelCell = `<td class="emd-progress-label" align="${startAlign(ctx)}"${data.readout ? '' : ' colspan="2"'} style="padding:0 0 5px 0;font-size:${theme.fontSize};line-height:1.4;color:${theme.bodyColor};">${escapeAttrValue(data.label)}</td>`;
  const valueCell = data.readout
    ? `<td class="emd-progress-value" align="${rtl ? 'left' : 'right'}" style="padding:0 0 5px 0;font-size:${theme.fontSize};line-height:1.4;font-weight:700;color:${theme.headingColor};white-space:nowrap;">${escapeAttrValue(data.readout)}</td>`
    : '';
  // Same as chart: MJML pins the column to direction:ltr, so cell order is
  // what puts the label and the readout on their own edges.
  const captionCells = rtl ? valueCell + labelCell : labelCell + valueCell;
  const captionRow = data.label || data.readout ? `<tr>${captionCells}</tr>\n          ` : '';

  const restMjml = data.rest.trim()
    ? `
        <mj-text padding="8px 0 0" font-size="${theme.fontSize}" color="${theme.bodyColor}" line-height="${theme.lineHeight}">${processInlineImages(data.rest)}</mj-text>`
    : '';

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-table css-class="emd-progress" role="presentation" cellpadding="0" cellspacing="0" width="100%" padding="4px 0" font-family="${theme.fontFamily}">
          ${captionRow}<tr><td colspan="2">
            ${bar}
          </td></tr>
        </mj-table>${restMjml}
      </mj-column>
    </mj-section>`;
}

/** Plot height of a sparkline, in pixels. */
const SPARKLINE_HEIGHT = 36;

/** Shortest column drawn, so a zero point still marks the baseline. */
const MIN_COLUMN_PX = 2;

/** Widest a single column is drawn before the plot stops growing with it. */
const MAX_COLUMN_PX = 18;

/** Gap between columns; a dense series cannot spare the wider one. */
function columnGap(count: number): number {
  return count > 20 ? 1 : 2;
}

/**
 * The plot width.
 *
 * Left to itself the plot grows with the series and stops: columns widen only
 * to a point, so a seven-point sparkline reads as a sparkline instead of a
 * wall of blocks stretched across the whole email, while a dense series still
 * fills the width. `width` overrides, in pixels or as a percentage.
 */
function resolvePlotWidth(
  raw: string | undefined,
  count: number,
  innerPx: number,
  ctx?: SegmentContext,
): string {
  if (raw !== undefined) {
    const value = raw.trim();
    const pct = /^(\d{1,3})%$/.exec(value);
    if (pct && Number(pct[1]) > 0 && Number(pct[1]) <= 100) return `${pct[1]}%`;
    const px = /^(\d+)(?:px)?$/.exec(value);
    if (px && Number(px[1]) >= 40 && Number(px[1]) <= innerPx) return `${px[1]}px`;
    warn(ctx, `Invalid width "${raw}" for sparkline — expected a pixel width from 40 to ${innerPx}, or a percentage; sizing to the series.`);
  }

  const natural = count * MAX_COLUMN_PX + (count - 1) * columnGap(count);
  return natural < innerPx ? `${natural}px` : '100%';
}

/**
 * The sparkline plot height.
 *
 * Unlike the other block heights this one is arithmetic, not just a style —
 * each column's fill and the space above it are computed from it — so it only
 * takes a pixel count, and says so when handed anything else.
 */
function resolvePlotHeight(raw: string | undefined, ctx?: SegmentContext): number {
  if (raw === undefined) return SPARKLINE_HEIGHT;
  const px = /^(\d+)(?:px)?$/.exec(raw.trim());
  if (px) {
    const height = parseInt(px[1], 10);
    if (height >= 8 && height <= 200) return height;
  }
  warn(ctx, `Invalid height "${raw}" for sparkline — expected a pixel height from 8 to 200; using ${SPARKLINE_HEIGHT}px.`);
  return SPARKLINE_HEIGHT;
}

/**
 * The columns of a sparkline: one fixed-width cell per point, each holding a
 * spacer stacked on a colored fill, so every column ends on the same baseline
 * without relying on vertical-align — which Outlook applies unevenly to cells
 * of differing heights.
 */
function renderSparklineColumns(
  heights: number[],
  plotPx: number,
  plotWidth: string,
  radius: string,
  fill: string,
  fillClass: string,
  trackColor: string,
  trackClass: string,
  rtl: boolean,
): string {
  const count = heights.length;
  const width = Math.round((100 / count) * 100) / 100;
  const gap = columnGap(count);
  const topCorners = radius ? `${radius} ${radius} 0 0` : '';

  const cells = Array.from({ length: count }, (_, position) => {
    // The DOM stays left-to-right, so RTL walks the series backwards to put
    // the oldest point on the right edge and read inward.
    const pct = heights[rtl ? count - 1 - position : position];

    // Every point draws at least a stub: the series reads as one continuous
    // shape rather than breaking open wherever a value reaches zero.
    const fillPx = Math.max(MIN_COLUMN_PX, Math.round((pct / 100) * plotPx));
    const spacerPx = Math.max(0, plotPx - fillPx);

    // Only the top of a column is rounded — they all stand on one baseline.
    // Where a track covers that top, the fill's own top edge is interior.
    const fillShape: BarShape = { height: `${fillPx}px`, heightAttr: ` height="${fillPx}"`, radius };
    const fillCorners = spacerPx > 0 && trackColor ? '' : topCorners;

    let rows = '';
    if (spacerPx > 0) {
      const spacerShape: BarShape = { height: `${spacerPx}px`, heightAttr: ` height="${spacerPx}"`, radius };
      rows += trackColor
        ? `<tr>${barCell(trackClass, trackColor, 100, topCorners, spacerShape)}</tr>`
        : `<tr><td height="${spacerPx}" style="height:${spacerPx}px;line-height:${spacerPx}px;font-size:1px;">&nbsp;</td></tr>`;
    }
    rows += `<tr>${barCell(fillClass, fill, 100, fillCorners, fillShape)}</tr>`;

    const pad = position === count - 1 ? '0' : `0 ${gap}px 0 0`;
    return `<td width="${width}%" style="width:${width}%;padding:${pad};">`
      + `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:separate;">${rows}</table>`
      + `</td>`;
  });

  const widthAttr = plotWidth.endsWith('%') ? plotWidth : String(parseInt(plotWidth, 10));
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${widthAttr}" style="width:${plotWidth};table-layout:fixed;border-collapse:separate;">
              <tr>${cells.join('')}</tr>
            </table>`;
}

/**
 * A sparkline, and the `trend` readout that is the same block without its
 * columns: the shape of a metric over time plus how far it moved.
 *
 * The delta takes its color from the theme's success and danger colors, which
 * are the same in both palettes — so only a neutral reading needs a dark-mode
 * hook, the same way an explicitly colored bar needs none.
 */
function renderSparklineSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const bare = segment.attrs?.variant === 'trend';
  const name = bare ? 'Trend' : 'Sparkline';

  const data = parseSparkline(segment.content, segment.attrs ?? {});
  if (!data) {
    warn(ctx, `${name} block needs at least two numbers — rendering its content as regular text.`);
    return renderTextSegment(segment.content, theme);
  }
  for (const message of data.warnings) warn(ctx, message);

  const rtl = ctx?.dir === 'rtl';
  const fill = resolveColor(segment.attrs?.color, theme.brandColor, ctx, 'sparkline color');
  // The groove is off by default: a sparkline is read as a shape, and filling
  // the space above every column turns it back into a bar chart.
  const trackColor = segment.attrs?.track
    ? resolveColor(segment.attrs.track, theme.cardColor, ctx, 'sparkline track')
    : '';
  const fillClass = `emd-sparkline-bar${segment.attrs?.color ? '' : ' emd-sparkline-bar-themed'}`;

  // Columns are thin, so they default to a slight softening rather than the
  // pill the wide bars take; `border-radius=0` squares them.
  let radius = resolveLength(segment.attrs?.['border-radius'], '2px', ctx, 'sparkline border-radius');
  if (/^0(?:[a-z%]+)?$/.test(radius)) radius = '';

  const toneColor = data.tone === 'good'
    ? theme.successColor
    : data.tone === 'bad'
      ? theme.dangerColor
      : theme.bodyColor;
  const deltaClass = `emd-sparkline-delta${data.tone === 'neutral' ? ' emd-sparkline-delta-themed' : ''}`;
  const readout = data.showValues
    ? `${escapeAttrValue(data.latest)} <span class="${deltaClass}" style="color:${toneColor};font-weight:700;">${TREND_ARROWS[data.direction]}&#160;${escapeAttrValue(data.delta)}</span>`
    : '';

  // Section padding is 32px a side, so that is what the plot has to fit in.
  const innerPx = (parseInt(theme.contentWidth, 10) || 600) - 64;
  const plotWidth = bare
    ? '100%'
    : resolvePlotWidth(segment.attrs?.width, data.heights.length, innerPx, ctx);

  // Where the plot leaves room beside it, the readout sits there rather than
  // flying off to the far edge — the same shape the text part draws, and the
  // gap between a narrow sparkline and its own number reads as a mistake.
  const beside = !bare && plotWidth !== '100%';

  // The label spans the row whenever it is not sharing it with the readout, so
  // a label wider than the plot cannot stretch the plot's column and reopen
  // the gap the readout was moved to close.
  const labelSpan = beside || !readout ? ' colspan="2"' : '';
  const labelCell = `<td class="emd-sparkline-label" align="${startAlign(ctx)}"${labelSpan} style="padding:0 0 5px 0;font-size:${theme.fontSize};line-height:1.4;color:${theme.bodyColor};">${escapeAttrValue(data.label)}</td>`;
  const valueCell = readout
    ? `<td class="emd-sparkline-value" align="${rtl ? 'left' : 'right'}" style="padding:0 0 5px 0;font-size:${theme.fontSize};line-height:1.4;font-weight:700;color:${theme.headingColor};white-space:nowrap;">${readout}</td>`
    : '';
  // Same as chart and progress: MJML pins the column to direction:ltr, so cell
  // order is what puts the label and the readout on their own edges.
  const captionCells = beside
    ? labelCell
    : rtl
      ? valueCell + labelCell
      : labelCell + valueCell;
  const captionRow = data.label || (readout && !beside) ? `<tr>${captionCells}</tr>` : '';

  // A trend block is nothing but its caption, so an empty one has nothing left
  // to draw.
  if (bare && !captionRow) {
    warn(ctx, 'Trend block has no label and no readout — rendering its content as regular text.');
    return renderTextSegment(segment.content, theme);
  }

  const columns = renderSparklineColumns(
    data.heights,
    resolvePlotHeight(segment.attrs?.height, ctx),
    plotWidth,
    radius,
    fill,
    fillClass,
    trackColor,
    'emd-sparkline-track',
    rtl,
  );

  let plotRow = '';
  if (!bare && beside) {
    const plotCell = `<td width="${parseInt(plotWidth, 10)}" style="width:${plotWidth};">${columns}</td>`;
    // The readout takes the rest of the row so the plot keeps its own width,
    // and hugs the plot from whichever side the series ends on.
    const asideCell = readout
      ? `<td class="emd-sparkline-value" align="${startAlign(ctx)}" style="padding:0 ${rtl ? '10px' : '0'} 0 ${rtl ? '0' : '10px'};font-size:${theme.fontSize};line-height:1.4;font-weight:700;color:${theme.headingColor};white-space:nowrap;">${readout}</td>`
      : '<td></td>';
    plotRow = `<tr>${rtl ? asideCell + plotCell : plotCell + asideCell}</tr>`;
  } else if (!bare) {
    // A full-width plot has no room beside it, so the readout stays on the
    // caption row, pinned to the far edge the way a chart's values are.
    plotRow = `<tr><td colspan="2" align="${startAlign(ctx)}">
            ${columns}
          </td></tr>`;
  }

  const restMjml = data.rest.trim()
    ? `
        <mj-text padding="8px 0 0" font-size="${theme.fontSize}" color="${theme.bodyColor}" line-height="${theme.lineHeight}">${processInlineImages(data.rest)}</mj-text>`
    : '';

  return `<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="8px 32px">
      <mj-column>
        <mj-table css-class="emd-sparkline" role="presentation" cellpadding="0" cellspacing="0" width="100%" padding="4px 0" font-family="${theme.fontFamily}">
          ${captionRow}${captionRow && plotRow ? '\n          ' : ''}${plotRow}
        </mj-table>${restMjml}
      </mj-column>
    </mj-section>`;
}

/** Past four across, a tile is narrower than the number it holds. */
const MAX_STAT_COLUMNS = 4;

/** Inset inside a tile card. */
function resolveTilePadding(value: string | undefined): string {
  if (value === 'compact') return '12px 14px';
  if (value === 'spacious') return '24px 24px';
  return '16px 18px';
}

/** Type sizes derived from the theme's body size, so a tile scales with it. */
function statTypeScale(theme: Theme): { small: string; value: string } {
  const base = parseInt(theme.fontSize, 10) || 16;
  return { small: `${Math.round(base * 0.875)}px`, value: `${Math.round(base * 1.75)}px` };
}

/**
 * One tile: caption, headline number, and — where the author wrote one — the
 * change beneath it. Built from table rows rather than stacked divs, because
 * the gaps between the three lines have to survive Outlook, which drops the
 * margins a div stack would rely on.
 */
function renderStatTile(
  item: StatItem,
  theme: Theme,
  align: string,
  valueColor: string,
  themedValue: boolean,
  scale: { small: string; value: string },
  valueSize: string,
  ctx?: SegmentContext,
): string {
  const color = item.color
    ? resolveColor(item.color, valueColor, ctx, `stat "${item.label}" color`)
    : valueColor;
  const valueClass = `emd-stat-value${themedValue && !item.color ? ' emd-stat-value-themed' : ''}`;

  let rows = `<tr><td class="emd-stat-label" align="${align}" style="padding:0 0 4px 0;font-size:${scale.small};line-height:1.4;color:${theme.bodyColor};">${escapeAttrValue(item.label)}</td></tr>`
    + `<tr><td class="${valueClass}" align="${align}" style="padding:0;font-size:${valueSize};line-height:1.25;font-weight:700;color:${color};">${escapeAttrValue(item.value)}</td></tr>`;

  if (item.delta) {
    const toneColor = item.tone === 'good' ? theme.successColor
      : item.tone === 'bad' ? theme.dangerColor : theme.bodyColor;
    // Only the neutral tone needs a dark-mode hook: success and danger are the
    // same color in both palettes.
    const deltaClass = `emd-stat-delta${item.tone === 'neutral' ? ' emd-stat-delta-themed' : ''}`;
    rows += `<tr><td class="${deltaClass}" align="${align}" style="padding:6px 0 0 0;font-size:${scale.small};line-height:1.4;font-weight:600;color:${toneColor};white-space:nowrap;">${TREND_ARROWS[item.direction]}&#160;${escapeAttrValue(item.delta)}</td></tr>`;
  }

  return `<mj-table css-class="emd-stat" role="presentation" cellpadding="0" cellspacing="0" width="100%" padding="0" font-family="${theme.fontFamily}">${rows}</mj-table>`;
}

/**
 * A grid of stat tiles.
 *
 * Tiles are `mj-column` cards rather than cells of one table: a table of KPIs
 * stays a single unreadable row on a phone, while columns stack. Every tile
 * keeps the width its grid position gives it, so a short last row lines up
 * under the one above instead of stretching to fill.
 */
function renderStatsSegment(segment: Segment, theme: Theme, ctx?: SegmentContext): string {
  const attrs = segment.attrs ?? {};
  const data = parseStats(segment.content, attrs);

  if (data.items.length === 0) {
    warn(ctx, 'Stats block contains no "Label: value" list items — rendering its content as regular text.');
    return renderTextSegment(segment.content, theme);
  }
  for (const message of data.warnings) warn(ctx, message);
  if (data.skipped > 0) {
    warn(ctx, `${data.skipped} stat${data.skipped === 1 ? '' : 's'} had no "Label: value" shape and ${data.skipped === 1 ? 'was' : 'were'} skipped.`);
  }

  let columns = defaultStatColumns(data.items.length);
  if (attrs.columns !== undefined) {
    const raw = attrs.columns.trim();
    const count = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
    if (count >= 1 && count <= MAX_STAT_COLUMNS) columns = count;
    else warn(ctx, `Invalid columns "${attrs.columns}" for stats — expected a whole number from 1 to ${MAX_STAT_COLUMNS}; using ${columns}.`);
  }
  // An explicit count wider than the block is honoured rather than shrunk to
  // fit: two tiles asked to sit on a three-wide grid are two tiles that line up
  // under the three-tile block above them.

  let gap = 16;
  if (attrs.gap !== undefined) {
    const raw = attrs.gap.replace(/px$/, '').trim();
    if (/^\d+$/.test(raw)) gap = parseInt(raw, 10);
    else warn(ctx, `Invalid gap "${attrs.gap}" for stats — using 16px.`);
  }

  // Tiles are cards by default — that is what makes them read as tiles rather
  // than as a paragraph of numbers — but `bg=none` drops back to bare columns.
  const card = attrs.bg !== 'none';
  const bg = resolveColor(attrs.bg === 'none' ? undefined : attrs.bg, theme.cardColor, ctx, 'stats bg');
  const themedCard = card && !attrs.bg;

  const align = resolveAlign(attrs.align, startAlign(ctx), ctx, 'stats align');
  const valueColor = resolveColor(attrs.color, theme.headingColor, ctx, 'stats color');
  const scale = statTypeScale(theme);
  const valueSize = resolveLength(
    attrs.size && /^\d+$/.test(attrs.size.trim()) ? `${attrs.size.trim()}px` : attrs.size,
    scale.value, ctx, 'stats size',
  );
  const radius = resolveLength(attrs['border-radius'], theme.borderRadius, ctx, 'stats border-radius');
  const padding = resolveTilePadding(attrs.padding);

  // Section padding is 32px a side, so that is the width the grid divides up.
  const innerPx = (parseInt(theme.contentWidth, 10) || 600) - 64;
  // Percentages are floored: inline-block columns wrap if a row exceeds 100%.
  const pct = (n: number) => Math.floor(n * 100) / 100;
  const gapPct = columns > 1 ? pct((gap / innerPx) * 100) : 0;
  const tilePct = pct((100 - (columns - 1) * gapPct) / columns);

  const rtl = ctx?.dir === 'rtl';
  const vpad = Math.max(4, Math.round(gap / 2));

  const sections: string[] = [];
  if (data.intro.trim()) {
    sections.push(`<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="${vpad}px 32px 0">
      <mj-column>
        <mj-text padding="0 0 4px" font-size="${theme.fontSize}" color="${theme.bodyColor}" line-height="${theme.lineHeight}">${processInlineImages(data.intro)}</mj-text>
      </mj-column>
    </mj-section>`);
  }

  for (let start = 0; start < data.items.length; start += columns) {
    const row = data.items.slice(start, start + columns);
    const parts: string[] = [];

    // The gap is its own column rather than column padding: mj-column paints
    // its background across the padding box, so padding would widen the card
    // instead of separating it. As a column the gap also survives stacking,
    // becoming a gap-tall row between the cards on a phone.
    const spacer = `<mj-column css-class="emd-gap" width="${gapPct}%">
        <mj-spacer height="${gap}px" />
      </mj-column>`;

    // A short last row keeps its tiles at grid width, so they line up under the
    // row above. The leftover is a real column rather than nothing: a section
    // centres its column track, so a part-full row would otherwise drift to the
    // middle. It leads the row in RTL, since MJML pins the track left-to-right.
    const missing = columns - row.length;
    const filler = missing > 0
      ? `<mj-column css-class="emd-gap" width="${pct(missing * (tilePct + gapPct))}%">
        <mj-spacer height="1px" />
      </mj-column>`
      : '';
    if (rtl && filler) parts.push(filler);

    const ordered = rtl ? [...row].reverse() : row;
    ordered.forEach((item, i) => {
      const tileAttrs = card
        ? `${themedCard ? ' css-class="emd-card"' : ''} background-color="${bg}" border-radius="${radius}" padding="${padding}"`
        : ' padding="0"';
      parts.push(`<mj-column width="${tilePct}%"${tileAttrs}>
        ${renderStatTile(item, theme, align, valueColor, !attrs.color, scale, valueSize, ctx)}
      </mj-column>`);
      if (i < ordered.length - 1) parts.push(spacer);
    });
    if (!rtl && filler) parts.push(filler);

    sections.push(`<mj-section css-class="emd-s emd-bg" background-color="${theme.contentColor}" padding="${vpad}px 32px">
      ${parts.join('\n      ')}
    </mj-section>`);
  }

  return sections.join('\n    ');
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
  return `<mj-button css-class="emd-btn" padding="8px 0"${alignAttr} background-color="${bgColor}" color="${textColor}" font-size="${theme.fontSize}" font-weight="600" border-radius="${borderRadius}" inner-padding="14px 32px"${widthAttr} ${border} href="${escapeAttrValue(attrs.href)}">${attrs.text}</mj-button>`;
}

function renderCellSegments(cell: ColumnCell, theme: Theme, ctx?: SegmentContext, card = false): string {
  const cellAlign = cell.attrs?.align ? resolveAlign(cell.attrs.align, startAlign(ctx), ctx, 'column align') : undefined;
  const textColor = cell.attrs?.color ? resolveColor(cell.attrs.color, theme.bodyColor, ctx, 'column color') : undefined;

  const parts: string[] = [];
  for (const seg of cell.segments) {
    switch (seg.type) {
      case 'text': {
        const alignAttr = cellAlign ? ` align="${cellAlign}"` : '';
        const colorAttr = textColor ? ` color="${textColor}"` : '';
        const content = processInlineImages(seg.content);
        const trimmed = card && seg === cell.segments[cell.segments.length - 1] ? zeroTrailingBlockMargin(content) : content;
        parts.push(`<mj-text padding="4px 0"${alignAttr}${colorAttr}>${trimmed}</mj-text>`);
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
  const widths = cells.map((cell) => resolveColumnWidth(cell.attrs?.width, ctx));
  const bgs = cells.map((cell) =>
    cell.attrs?.bg ? resolveColor(cell.attrs.bg, theme.cardColor, ctx, 'column bg') : undefined);

  // Boundary i sits between cell i and i+1. Plain neighbors split the gap as
  // padding halves, but mj-column paints its background across its padding
  // box, so a boundary touching a bg card gets a real spacer column instead.
  const spacerAfter = cells.map((_, i) => i < last && gap > 0 && Boolean(bgs[i] || bgs[i + 1]));

  // Once spacer columns join the row, every content column needs an explicit
  // width: MJML otherwise splits 100% evenly across all siblings, spacers
  // included. Percentages are computed against the section's inner width and
  // always floored — inline-block columns wrap if the row exceeds 100%.
  const pct = (n: number) => Math.floor(n * 100) / 100;
  let spacerWidthPct = 0;
  let fillWidthPct: number | undefined;
  if (spacerAfter.some(Boolean)) {
    const innerPx = (parseInt(theme.contentWidth, 10) || 600) - 64; // section padding is 32px per side
    spacerWidthPct = pct((gap / innerPx) * 100);
    const spacerTotal = spacerAfter.filter(Boolean).length * spacerWidthPct;
    const explicitTotal = widths.reduce((sum, w) =>
      w ? sum + (w.endsWith('px') ? (parseFloat(w) / innerPx) * 100 : parseFloat(w)) : sum, 0);
    const flexible = widths.filter((w) => !w).length;
    if (flexible > 0) {
      fillWidthPct = pct((100 - spacerTotal - explicitTotal) / flexible);
      if (fillWidthPct <= 0) {
        warn(ctx, 'Column widths plus gaps exceed 100% — layout may overflow.');
        fillWidthPct = 1;
      }
    }
  }

  const parts: string[] = [];
  cells.forEach((cell, i) => {
    const attrs: string[] = [];
    const width = widths[i] ?? (fillWidthPct !== undefined ? `${pct(fillWidthPct)}%` : undefined);
    if (width) attrs.push(`width="${width}"`);
    const valign = resolveValign(cell.attrs?.valign, ctx);
    if (valign) attrs.push(`vertical-align="${valign}"`);

    const bg = bgs[i];
    if (bg) {
      // A bg cell takes a card inset instead of gutter halves; separation from
      // its neighbors comes from the spacer columns.
      attrs.push(`css-class="emd-card"`, `background-color="${bg}"`, `border-radius="${theme.borderRadius}"`, `padding="${resolvePadding(cell.attrs?.padding)}"`);
    } else {
      const left = i === 0 || spacerAfter[i - 1] ? 0 : Math.floor(gap / 2);
      const right = i === last || spacerAfter[i] ? 0 : Math.ceil(gap / 2);
      attrs.push(`padding="0 ${right}px 0 ${left}px"`);
    }

    parts.push(`<mj-column ${attrs.join(' ')}>
        ${renderCellSegments(cell, theme, ctx, Boolean(bg))}
      </mj-column>`);

    if (spacerAfter[i]) {
      // The inner mj-spacer keeps the gap when columns stack on mobile: the
      // spacer column becomes a full-width, gap-tall row between the cards.
      parts.push(`<mj-column css-class="emd-gap" width="${pct(spacerWidthPct)}%">
        <mj-spacer height="${gap}px" />
      </mj-column>`);
    }
  });
  const columnsMjml = parts.join('\n      ');

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
    case 'chart':
      return renderChartSegment(segment, theme, ctx);
    case 'progress':
      return renderProgressSegment(segment, theme, ctx);
    case 'sparkline':
      return renderSparklineSegment(segment, theme, ctx);
    case 'stats':
      return renderStatsSegment(segment, theme, ctx);
  }
}

/**
 * Sections that make up the visible content box — the ones carrying a
 * background of their own. Header and footer bands sit on the page background
 * (`emd-s` alone) and stay outside it.
 */
const BOX_SECTION_RE = /<mj-section css-class="(?=[^"]*\bemd-(?:bg|hero)\b)[^"]*"/g;

/**
 * Tag the first and last section of the content box with `emd-top`/`emd-bot`.
 *
 * The box renders as a stack of same-colored sections, so there is no single
 * element to style. These classes are a pure styling hook — no visual change on
 * their own — letting the `css` render option round or pad the box as a whole:
 *
 * ```css
 * .emd-top, .emd-top > table { border-top-left-radius: 12px; border-top-right-radius: 12px; }
 * ```
 *
 * Corner longhands matter: a single-section document gets both classes, and
 * competing `border-radius` shorthands would leave it square on one edge.
 */
function markBoxEdges(body: string): string {
  const matches = [...body.matchAll(BOX_SECTION_RE)];
  if (matches.length === 0) return body;

  const first = matches[0];
  const last = matches[matches.length - 1];
  const edits = first === last
    ? [{ match: first, extra: ' emd-top emd-bot' }]
    : [{ match: first, extra: ' emd-top' }, { match: last, extra: ' emd-bot' }];

  // Apply back to front so earlier insertions don't shift later offsets.
  let out = body;
  for (const { match, extra } of edits.reverse()) {
    const closingQuote = match.index! + match[0].length - 1;
    out = out.slice(0, closingQuote) + extra + out.slice(closingQuote);
  }
  return out;
}

export function segmentsToMjml(segments: Segment[], theme: Theme, ctx?: SegmentContext): string {
  return markBoxEdges(segments.map((s) => segmentToMjml(s, theme, ctx)).join('\n    '));
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

/**
 * MJML's default accordion toggle icons are white PNGs hotlinked from imgur —
 * invisible on light themes (so collapsed panels look inert) and a third-party
 * image host in every email. Swap them for theme-colored text glyphs carrying
 * the same classes, so MJML's checkbox CSS toggles them identically. Custom
 * icon URLs set via icon-wrapped=/icon-unwrapped= are left untouched.
 */
function themeAccordionIcons(html: string, theme: Theme): string {
  return html.replace(/<img[^>]*class="mj-accordion-(more|less)"[^>]*\/?>/g, (tag, kind: string) => {
    if (!tag.includes('src="https://i.imgur.com/')) return tag;
    const glyph = kind === 'more' ? '+' : '−';
    return `<span class="mj-accordion-${kind}" style="display:none;width:32px;height:32px;font-size:24px;line-height:32px;text-align:center;color:${escapeAttrValue(theme.headingColor)};">${glyph}</span>`;
  });
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
  return { html: html.includes('mj-accordion-ico') ? themeAccordionIcons(html, theme) : html, errors: errors ?? [] };
}
