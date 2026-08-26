/**
 * Primitives shared by the bar-drawing directives (`chart`, `progress`).
 *
 * Both read their data from the same `Label: value` text and scale a bar the
 * same way, so neither can drift from the other — and the MJML and plain-text
 * renderers of each can never disagree about a number.
 */

// Leading digit required, so a bare "$" or "%" is not read as a value.
const NUMBER_RE = /-?\d[\d,]*(?:\.\d+)?/;

export interface LabelValue {
  /** Text before the last colon; empty when the source is a bare value. */
  label: string;
  /** The value exactly as the author wrote it, e.g. `4,200` or `42%`. */
  display: string;
  /** Numeric magnitude parsed out of `display`. */
  value: number;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Read a number out of authored text, tolerating thousands separators. */
export function parseNumber(text: string | undefined): number | null {
  if (text === undefined) return null;
  const match = NUMBER_RE.exec(text);
  if (!match) return null;
  const value = parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/**
 * Split `Label: value` text into its parts.
 *
 * The split is on the *last* colon, so a label may itself contain one
 * ("Q1: revenue: 400"). Text with no colon at all is a bare value carrying no
 * label; callers that require one reject it themselves.
 */
export function parseLabelValue(text: string): LabelValue | null {
  const trimmed = text.trim();
  const sep = trimmed.lastIndexOf(':');
  const label = sep === -1 ? '' : trimmed.slice(0, sep).trim();
  const display = sep === -1 ? trimmed : trimmed.slice(sep + 1).trim();
  if (!display) return null;

  const value = parseNumber(display);
  if (value === null) return null;
  return { label, display, value };
}

/** Bar fill as a percentage of the track, clamped to 0–100. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0)) return 0;
  const pct = (value / max) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100));
}
