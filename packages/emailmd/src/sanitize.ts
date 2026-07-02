/**
 * Escaping and validation helpers for values interpolated into MJML.
 *
 * Two distinct trust levels flow through the renderer:
 * - Values that passed through markdown-it (button text/href, image src/alt)
 *   are already entity-escaped; they get `escapeAttrValue` as a second layer.
 * - Values that bypass markdown-it (frontmatter preheader, directive params,
 *   hero URLs, theme overrides) are raw user input and must be escaped
 *   and/or validated before interpolation.
 */

/** Full-value template tokens ({{ x }}, {% x %}, ${x}, %%x%%, [[x]]) pass validation untouched — the sending app resolves them after render. */
const TEMPLATE_TOKEN_RE = /^(\{\{[\s\S]+\}\}|\{%[\s\S]+%\}|\$\{[\s\S]+\}|%%[\s\S]+%%|\[\[[\s\S]+\]\])$/;

export function isTemplateToken(value: string): boolean {
  return TEMPLATE_TOKEN_RE.test(value.trim());
}

/** Escape a raw string for use as HTML text content or a quoted attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Defense-in-depth escape for values that may already contain HTML entities
 * (markdown-it output). Escapes only the characters that could break out of
 * a double-quoted attribute or open a tag, without double-escaping `&`.
 */
export function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR_RE = /^(?:rgb|rgba|hsl|hsla)\(\s*[\d.,%\s/-]+\s*\)$/i;
const NAMED_COLOR_RE = /^[a-z]+$/i;

/** True when the value is a plausible, injection-safe CSS color (hex, rgb/hsl functional, named) or a template token. */
export function isCssColor(value: string): boolean {
  const v = value.trim();
  return HEX_COLOR_RE.test(v) || FUNC_COLOR_RE.test(v) || NAMED_COLOR_RE.test(v) || isTemplateToken(v);
}

const LENGTH_TOKEN_RE = /^-?\d*\.?\d+(?:px|em|rem|pt|%)?$/;

/** True for 1–4 space-separated CSS length tokens (e.g. `8px`, `50%`, `8px 16px`) or a template token. */
export function isCssLength(value: string): boolean {
  const v = value.trim();
  if (isTemplateToken(v)) return true;
  const tokens = v.split(/\s+/);
  if (tokens.length < 1 || tokens.length > 4) return false;
  return tokens.every((t) => LENGTH_TOKEN_RE.test(t));
}

const URL_SCHEME_RE = /^\s*([a-z][a-z0-9+.-]*):/i;
const BLOCKED_SCHEMES = new Set(['javascript', 'vbscript', 'data', 'file']);

/**
 * True when the URL has no scheme (relative), a safe scheme (http, https,
 * mailto, tel), or is a template token. Blocks javascript:, vbscript:,
 * data:, and file:.
 */
export function isSafeUrl(value: string): boolean {
  const v = value.trim();
  if (isTemplateToken(v)) return true;
  const match = v.match(URL_SCHEME_RE);
  if (!match) return true;
  return !BLOCKED_SCHEMES.has(match[1].toLowerCase());
}

/** True when a theme/font value can be interpolated into CSS or attributes without breaking out of context. */
export function isSafeThemeValue(value: string): boolean {
  return !/[<>"]/.test(value);
}
