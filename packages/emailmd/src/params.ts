const ALIGNMENT_KEYWORDS = new Set(['center', 'left', 'right']);
const PADDING_KEYWORDS = new Set(['compact', 'spacious']);

export interface DirectiveParams {
  align?: string;
  padding?: string;
  color?: string;
  bg?: string;
  [key: string]: string | undefined;
}

/**
 * Strip one pair of matching surrounding quotes from a param value, so the
 * HTML-style `color="#fff"` authors naturally write parses the same as the
 * bare `color=#fff` form.
 */
export function unquote(value: string): string {
  const first = value[0];
  return value.length >= 2 && (first === '"' || first === "'") && value.endsWith(first)
    ? value.slice(1, -1)
    : value;
}

/**
 * Parse space-separated parameters from a directive info string.
 *
 * Bare keywords are mapped to known parameter types:
 * - center, left, right → align
 * - compact, spacious → padding
 *
 * Key=value pairs are stored directly, with surrounding quotes stripped:
 * - color=#1e40af → { color: "#1e40af" }
 * - bg="#eff6ff" → { bg: "#eff6ff" }
 */
export function parseDirectiveParams(info: string, name: string): DirectiveParams {
  const params: DirectiveParams = {};
  const rest = info.trim().slice(name.length).trim();
  if (!rest) return params;

  for (const token of rest.split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq !== -1) {
      params[token.slice(0, eq)] = unquote(token.slice(eq + 1));
    } else if (ALIGNMENT_KEYWORDS.has(token)) {
      params.align = token;
    } else if (PADDING_KEYWORDS.has(token)) {
      params.padding = token;
    }
  }

  return params;
}

/**
 * Serialize a DirectiveParams object into a marker attribute string.
 * Returns empty string when there are no params.
 *
 * { align: "center", bg: "#eff6ff" } → ' align="center" bg="#eff6ff"'
 *
 * Double quotes are stripped from values: the segmenter re-parses markers
 * with a `key="[^"]*"` pattern, and a quote inside a value would make the
 * whole marker unparseable, silently dropping the directive.
 */
export function serializeMarkerAttrs(params: DirectiveParams): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return ' ' + entries.map(([k, v]) => `${k}="${v!.replace(/"/g, '')}"`).join(' ');
}
