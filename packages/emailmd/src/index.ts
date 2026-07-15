export type { Theme } from './theme.js';
export type { WrapperFn, WrapperMeta, RenderStrings, SegmentContext } from './mjml.js';
export type { Segment, SegmentType } from './segmenter.js';
export type { RenderWarning } from './warnings.js';
export { defaultTheme, lightTheme, darkTheme, mergeTheme, resolveBaseTheme } from './theme.js';
export { extractFrontmatter, frontmatterToThemeOverrides, frontmatterToFonts } from './frontmatter.js';
export { expandPartials } from './partials.js';
export { lint } from './lint.js';
export type { LintFinding, LintOptions } from './lint.js';
export { buildHead, segmentsToMjml } from './mjml.js';
export { defaultWrapper } from './wrappers/default.js';
export { escapeHtml, escapeAttrValue, isCssColor, isCssLength, isSafeUrl } from './sanitize.js';

import { mergeTheme, resolveBaseTheme, darkTheme as darkBaseTheme, type Theme } from './theme.js';
import { extractFrontmatter, frontmatterToThemeOverrides, frontmatterToFonts } from './frontmatter.js';
import { parseMarkdown } from './parser.js';
import { segment } from './segmenter.js';
import { renderMjml, type WrapperFn, type WrapperMeta, type RenderStrings } from './mjml.js';
import { resolveWrapper } from './wrappers/index.js';
import { toPlainText } from './plaintext.js';
import { expandPartials } from './partials.js';
import { repairColumnsFences } from './repair.js';
import type { RenderWarning } from './warnings.js';
import { isSafeThemeValue, isSafeUrl } from './sanitize.js';

/** Options for the {@link render} function. */
export interface RenderOptions {
  /** Theme overrides. Merged with defaults; frontmatter values take precedence. */
  theme?: Partial<Theme>;
  /** Wrapper template. Built-in names or a custom {@link WrapperFn}. */
  wrapper?: 'default' | WrapperFn;
  /** Minify the output HTML. Default: `false`. Useful for staying under Gmail's 102KB clip limit. */
  minify?: boolean;
  /**
   * Custom web fonts as a map of family name → URL (rendered as `<mj-font>` tags).
   * Frontmatter `fonts:` entries merge on top of this map (per-family, frontmatter wins).
   */
  fonts?: Record<string, string>;
  /** MJML validation level. Default: `'soft'`. */
  validationLevel?: 'skip' | 'soft' | 'strict';
  /**
   * Custom template delimiters preserved during compilation. Passed through to MJML.
   * Default: `[{ prefix: '{{', suffix: '}}' }, { prefix: '[[', suffix: ']]' }]`.
   */
  templateSyntax?: Array<{ prefix: string; suffix: string }>;
  /**
   * Sanitize template variables inside CSS before minification.
   * Only takes effect when `minify` is `true`. Default: `false`.
   */
  sanitizeStyles?: boolean;
  /** Pretty-print the output HTML. Ignored when `minify` is `true`. Default: `false`. */
  beautify?: boolean;
  /** Overridable output strings, for localization. See {@link RenderStrings}. */
  strings?: RenderStrings;
  /**
   * Opt into automatic dark mode (`prefers-color-scheme` + Outlook.com
   * support). `true` uses the built-in dark palette; a partial theme merges
   * over it. Frontmatter `dark:` overrides merge on top, and an explicitly
   * pinned frontmatter `theme: light`/`theme: dark` renders static instead.
   */
  darkTheme?: true | Partial<Theme>;
  /**
   * Render single newlines as line breaks (`<br>`), the way non-technical
   * writers expect Enter to behave. Frontmatter `breaks:` overrides this
   * per document. Default: `false` (standard markdown).
   */
  breaks?: boolean;
  /**
   * Allow raw HTML tags in the Markdown source. Default: `true`.
   *
   * With the default, a raw tag like `<span style="…">` passes through
   * verbatim. Set `false` for untrusted input to escape raw tags to text
   * (`<script>` → `&lt;script&gt;`) while every Markdown feature — headings,
   * links, tables, directives, buttons — keeps working.
   *
   * With `false`, the other two ways Markdown can emit markup are closed too:
   * the `{attr=…}` attribute syntax drops event handlers (`on*`), inline
   * `style`, and `javascript:`/`data:` URL overrides, and raw HTML inside
   * template tags (`{{…}}`, `${…}`) is escaped rather than spliced back
   * verbatim. `javascript:`/`data:` URLs in Markdown links are blocked either
   * way. It is still not a general HTML sanitizer, so for high-assurance
   * threat models pass the output through a dedicated sanitizer as well.
   */
  allowHtml?: boolean;
  /**
   * Custom CSS, emitted as one extra `<mj-style>` in the head after the built-in
   * styles so it can override them. Use it to reach classes the renderer exposes
   * (e.g. `.emd-btn` on buttons) without replacing the wrapper. Inline styles still
   * win, so target those with `!important`; and since it is an embedded `<style>`,
   * treat it as progressive enhancement — not every email client honours those.
   */
  css?: string;
  /**
   * Named markdown partials spliced in wherever the document says
   * `::: include <name>`. Parameters on the include line (`key="value"`)
   * fill `{{key}}` placeholders inside the partial; tokens for keys that
   * were not passed stay untouched for the sending app's template layer.
   */
  partials?: Record<string, string>;
}

/** Object returned by {@link render}. */
export interface RenderResult {
  /** Complete email-safe HTML document. */
  html: string;
  /** Plain text version for the text/plain MIME part. */
  text: string;
  /** Extracted frontmatter metadata (preheader and any custom keys). */
  meta: {
    preheader?: string;
    [key: string]: unknown;
  };
  /**
   * Non-fatal issues encountered while rendering. Omitted when empty.
   * See {@link RenderWarning}.
   */
  warnings?: RenderWarning[];
}

/** Opening delimiters of the template-tag syntaxes preserved by the parser and MJML's templateSyntax pass. */
const TEMPLATE_DELIMITERS = ['{{', '{%', '${', '%%', '[['];

/** Theme keys that hold CSS lengths, where a bare number means pixels. */
const PX_THEME_KEYS = new Set<keyof Theme>(['borderRadius', 'fontSize', 'contentWidth']);

/**
 * Replace theme values that could break out of a CSS or attribute context
 * with the base theme's value for that key, collecting a warning per repair.
 * Non-string values (e.g. `line_height: 1.6` from YAML) are coerced to strings,
 * and unitless numbers on length keys (e.g. `border_radius: 12`) get `px` —
 * otherwise they'd emit invalid CSS that clients silently drop.
 */
function sanitizeTheme(theme: Theme, base: Theme, warnings: RenderWarning[]): Theme {
  const safe = { ...theme };
  for (const key of Object.keys(base) as Array<keyof Theme>) {
    const value = safe[key];
    let str = typeof value === 'string' ? value : String(value);
    if (PX_THEME_KEYS.has(key) && /^\d+(?:\.\d+)?$/.test(str)) str = `${str}px`;
    if (!isSafeThemeValue(str)) {
      warnings.push({
        stage: 'theme',
        message: `Invalid theme value for ${key} — using default.`,
      });
      safe[key] = base[key];
    } else {
      safe[key] = str;
    }
  }
  return safe;
}

/** Drop font entries with unsafe family names or URLs, collecting a warning per drop. */
function sanitizeFonts(fonts: Record<string, string> | undefined, warnings: RenderWarning[]): Record<string, string> | undefined {
  if (!fonts) return undefined;
  const safe: Record<string, string> = {};
  for (const [family, url] of Object.entries(fonts)) {
    if (!isSafeThemeValue(family) || !isSafeThemeValue(url) || !isSafeUrl(url)) {
      warnings.push({
        stage: 'theme',
        message: `Invalid font entry "${family}" — skipping.`,
      });
      continue;
    }
    safe[family] = url;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

/**
 * Render markdown (with optional YAML frontmatter) into email-safe HTML.
 *
 * @param markdown - Markdown string, optionally with YAML frontmatter.
 * @param options  - Theme and wrapper overrides.
 * @returns An object with `html`, `text`, and `meta` properties.
 *
 * @example
 * ```ts
 * const { html, text, meta } = await render(`
 * ---
 * preheader: Welcome!
 * ---
 * # Hello
 * Thanks for signing up.
 * `);
 * ```
 */
export async function render(markdown: string, options?: RenderOptions): Promise<RenderResult> {
  const warnings: RenderWarning[] = [];

  const { meta, content: rawContent, error: frontmatterError } = extractFrontmatter(markdown);
  if (frontmatterError) {
    warnings.push({
      stage: 'frontmatter',
      message: frontmatterError.message,
      cause: frontmatterError,
    });
  }

  // Runs with an empty map too, so a stray include still warns and is
  // dropped instead of rendering as a literal ":::" paragraph.
  // After partial expansion, since partials can contain columns blocks too.
  const content = repairColumnsFences(
    expandPartials(rawContent, options?.partials ?? {}, warnings),
    warnings,
  );

  if (meta.theme !== undefined && meta.theme !== 'light' && meta.theme !== 'dark' && meta.theme !== 'auto') {
    warnings.push({
      stage: 'theme',
      message: `Unknown theme "${String(meta.theme)}" — using default. Valid values: "light", "dark", "auto".`,
    });
  }
  const baseTheme = resolveBaseTheme(meta.theme as string | undefined);
  const frontmatterOverrides = frontmatterToThemeOverrides(meta);
  const merged = mergeTheme({ ...options?.theme, ...frontmatterOverrides }, baseTheme);
  const theme = sanitizeTheme(merged, baseTheme, warnings);

  // Automatic dark mode is on when the author asks for `theme: auto` (a bare
  // `dark:` override map implies it) or the rendering app passes `darkTheme`.
  // An explicitly pinned `theme: light`/`theme: dark` always renders static.
  let darkThemeResolved: Theme | undefined;
  {
    const fmDark = meta.dark;
    const fmDarkValid = fmDark === undefined
      || (typeof fmDark === 'object' && fmDark !== null && !Array.isArray(fmDark));
    if (!fmDarkValid) {
      warnings.push({
        stage: 'theme',
        message: 'Invalid "dark" frontmatter — expected a map of theme keys. Use "theme: auto" to enable automatic dark mode.',
      });
    }
    const hasDarkOverrides = fmDarkValid && fmDark !== undefined;
    const pinned = meta.theme === 'light' || meta.theme === 'dark';
    if (pinned && hasDarkOverrides) {
      warnings.push({
        stage: 'theme',
        message: `"dark" overrides are ignored because the theme is pinned to "${String(meta.theme)}". Use "theme: auto" for automatic dark mode.`,
      });
    }
    const requested = meta.theme === 'auto' || hasDarkOverrides || options?.darkTheme !== undefined;
    if (requested && !pinned) {
      const optDark = options?.darkTheme;
      const optOverrides = typeof optDark === 'object' ? optDark : undefined;
      const fmOverrides = hasDarkOverrides
        ? frontmatterToThemeOverrides(fmDark as Record<string, unknown>)
        : undefined;
      const mergedDark = mergeTheme({ ...optOverrides, ...fmOverrides }, darkBaseTheme);
      darkThemeResolved = sanitizeTheme(mergedDark, darkBaseTheme, warnings);
    }
  }

  // Hard line breaks: frontmatter wins over the render option per document.
  let breaks = options?.breaks ?? false;
  if (meta.breaks !== undefined) {
    if (typeof meta.breaks === 'boolean') {
      breaks = meta.breaks;
    } else {
      warnings.push({
        stage: 'frontmatter',
        message: `Invalid "breaks" frontmatter — expected true or false.`,
      });
    }
  }

  // Document language and text direction, emitted on the output <html> tag.
  let lang: string | undefined;
  if (meta.lang !== undefined) {
    if (typeof meta.lang === 'string' && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/.test(meta.lang)) {
      lang = meta.lang;
    } else {
      warnings.push({
        stage: 'frontmatter',
        message: `Invalid "lang" frontmatter "${String(meta.lang)}" — expected a language tag like "en" or "pt-BR".`,
      });
    }
  }
  let dir: 'ltr' | 'rtl' | 'auto' | undefined;
  if (meta.dir !== undefined) {
    if (meta.dir === 'ltr' || meta.dir === 'rtl' || meta.dir === 'auto') {
      dir = meta.dir;
    } else {
      warnings.push({
        stage: 'frontmatter',
        message: `Invalid "dir" frontmatter "${String(meta.dir)}" — expected "ltr", "rtl", or "auto".`,
      });
    }
  }

  const parsedHtml = parseMarkdown(content, { breaks, html: options?.allowHtml });
  const segments = segment(parsedHtml, warnings);

  const wrapperFn = resolveWrapper(options?.wrapper);

  const wrapperMeta: WrapperMeta = {
    preheader: meta.preheader as string | undefined,
    frontmatter: meta,
    strings: options?.strings,
    warnings,
    darkTheme: darkThemeResolved,
    lang,
    dir,
    css: options?.css,
  };

  const frontmatterFonts = frontmatterToFonts(meta);
  const mergedFonts = options?.fonts || frontmatterFonts
    ? sanitizeFonts({ ...options?.fonts, ...frontmatterFonts }, warnings)
    : undefined;

  const { html, errors } = await renderMjml(segments, theme, wrapperMeta, wrapperFn, {
    minify: options?.minify,
    fonts: mergedFonts,
    validationLevel: options?.validationLevel,
    templateSyntax: options?.templateSyntax,
    sanitizeStyles: options?.sanitizeStyles,
    beautify: options?.beautify,
  });
  for (const error of errors) {
    const message = error.formattedMessage ?? error.message;
    // MJML's validator flags template tokens ({{ x }}, ${x}, …) as invalid
    // attribute values, but they are a supported feature — the sending app
    // resolves them after render. Don't surface those as warnings.
    if (/invalid value/i.test(message) && TEMPLATE_DELIMITERS.some((d) => message.includes(d))) {
      continue;
    }
    warnings.push({ stage: 'mjml', message });
  }

  const text = toPlainText(parsedHtml);

  return {
    html,
    text,
    meta: { ...meta },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
