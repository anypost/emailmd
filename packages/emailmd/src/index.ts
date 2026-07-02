export type { Theme } from './theme.js';
export type { WrapperFn, WrapperMeta, RenderStrings, SegmentContext, MjmlCompileError } from './mjml.js';
export type { Segment, SegmentType } from './segmenter.js';
export type { RenderWarning } from './warnings.js';
export { defaultTheme, lightTheme, darkTheme, mergeTheme, resolveBaseTheme } from './theme.js';
export { extractFrontmatter, frontmatterToThemeOverrides } from './frontmatter.js';
export { buildHead, segmentsToMjml } from './mjml.js';
export { defaultWrapper } from './wrappers/default.js';
export { escapeHtml, escapeAttrValue, isCssColor, isCssLength, isSafeUrl } from './sanitize.js';

import { mergeTheme, resolveBaseTheme, type Theme } from './theme.js';
import { extractFrontmatter, frontmatterToThemeOverrides, frontmatterToFonts } from './frontmatter.js';
import { parseMarkdown } from './parser.js';
import { segment } from './segmenter.js';
import { renderMjml, type WrapperFn, type WrapperMeta, type RenderStrings } from './mjml.js';
import { resolveWrapper } from './wrappers/index.js';
import { toPlainText } from './plaintext.js';
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

/**
 * Replace theme values that could break out of a CSS or attribute context
 * with the base theme's value for that key, collecting a warning per repair.
 * Non-string values (e.g. `line_height: 1.6` from YAML) are coerced to strings.
 */
function sanitizeTheme(theme: Theme, base: Theme, warnings: RenderWarning[]): Theme {
  const safe = { ...theme };
  for (const key of Object.keys(base) as Array<keyof Theme>) {
    const value = safe[key];
    const str = typeof value === 'string' ? value : String(value);
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

  const { meta, content, error: frontmatterError } = extractFrontmatter(markdown);
  if (frontmatterError) {
    warnings.push({
      stage: 'frontmatter',
      message: frontmatterError.message,
      cause: frontmatterError,
    });
  }

  const baseTheme = resolveBaseTheme(meta.theme as string | undefined);
  const frontmatterOverrides = frontmatterToThemeOverrides(meta);
  const merged = mergeTheme({ ...options?.theme, ...frontmatterOverrides }, baseTheme);
  const theme = sanitizeTheme(merged, baseTheme, warnings);

  const parsedHtml = parseMarkdown(content);
  const segments = segment(parsedHtml);

  const wrapperFn = resolveWrapper(options?.wrapper);

  const wrapperMeta: WrapperMeta = {
    preheader: meta.preheader as string | undefined,
    frontmatter: meta,
    strings: options?.strings,
    warnings,
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
