import yaml from 'js-yaml';
import type { Theme } from './theme.js';

export interface FrontmatterResult {
  meta: Record<string, unknown>;
  content: string;
  /** Present when the frontmatter block was found but could not be parsed as YAML. */
  error?: Error;
}

const frontmatterRegex = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/;

const themeKeys: Set<string> = new Set([
  'brand_color',
  'heading_color',
  'body_color',
  'background_color',
  'content_color',
  'card_color',
  'button_color',
  'button_text_color',
  'secondary_color',
  'secondary_text_color',
  'success_color',
  'success_text_color',
  'danger_color',
  'danger_text_color',
  'warning_color',
  'warning_text_color',
  'divider_color',
  'font_family',
  'font_size',
  'line_height',
  'content_width',
  'border_radius',
]);

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function extractFrontmatter(input: string): FrontmatterResult {
  const match = input.match(frontmatterRegex);
  if (!match) {
    return { meta: {}, content: input };
  }
  try {
    const data = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
    return { meta: data, content: match[2] };
  } catch (err) {
    // Invalid YAML — fall back to empty meta and keep rendering the body.
    return {
      meta: {},
      content: match[2],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

export function frontmatterToThemeOverrides(meta: Record<string, unknown>): Partial<Theme> {
  const overrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (themeKeys.has(key)) {
      overrides[snakeToCamel(key)] = value;
    }
  }
  return overrides as Partial<Theme>;
}

/**
 * Extract the nested `fonts:` map from frontmatter, if present.
 * Silently ignores non-string values so malformed entries don't crash rendering.
 */
export function frontmatterToFonts(meta: Record<string, unknown>): Record<string, string> | undefined {
  const raw = meta.fonts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const fonts: Record<string, string> = {};
  for (const [family, url] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof url === 'string' && family) fonts[family] = url;
  }
  return Object.keys(fonts).length > 0 ? fonts : undefined;
}
