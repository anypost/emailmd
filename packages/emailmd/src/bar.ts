/**
 * Primitives shared by the data-drawing directives (`chart`, `progress`,
 * `sparkline`, `stats`).
 *
 * They all read their numbers out of the same authored text and scale a bar
 * the same way, so none of them can drift from the others — and the MJML and
 * plain-text renderers of each can never disagree about a number.
 */

// Leading digit required, so a bare "$" or "%" is not read as a value.
const NUMBER_RE = /-?\d[\d,]*(?:\.\d+)?/;

/**
 * One number in a series.
 *
 * A comma is a thousands separator only where three digits follow it, so
 * `12,000 13,500` reads as two points and `12,19,15` as three.
 */
const SERIES_NUMBER_RE = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

/** The paragraph carrying the value; anything after it renders below the drawing. */
const VALUE_PARAGRAPH_RE = /<p>([\s\S]*?)<\/p>/;

export interface LabelValue {
  /** Text before the last colon; empty when the source is a bare value. */
  label: string;
  /** The value exactly as the author wrote it, e.g. `4,200` or `42%`. */
  display: string;
  /** Numeric magnitude parsed out of `display`. */
  value: number;
}

export interface ValueLine {
  /** Plain text of the first line of the block's first paragraph. */
  line: string;
  /** Everything else in the block, rendered below the drawing. */
  rest: string;
}

export interface Series {
  values: number[];
  /** Each value exactly as the author wrote it. */
  displays: string[];
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
 * Split a one-value block into its value line and the content below it.
 *
 * Markdown joins soft-wrapped lines into one paragraph, so only the *first*
 * line of that paragraph is the data — a sentence wrapped under it is
 * commentary, and is handed back as its own paragraph to render below.
 */
export function splitValueLine(content: string): ValueLine {
  const paragraph = VALUE_PARAGRAPH_RE.exec(content);
  const inner = paragraph ? paragraph[1] : content;

  const wrap = inner.indexOf('\n');
  const line = stripTags(wrap === -1 ? inner : inner.slice(0, wrap));
  const trailing = wrap === -1 ? '' : `<p>${inner.slice(wrap + 1)}</p>`;
  const rest = paragraph
    ? content.slice(0, paragraph.index) + trailing + content.slice(paragraph.index + paragraph[0].length)
    : '';

  return { line, rest };
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

/**
 * Read a run of numbers out of authored text.
 *
 * Numbers are matched rather than split on a separator, so commas, spaces and
 * a mix of the two all work — and a comma inside a thousands group stays part
 * of its number instead of cutting it in half.
 */
export function parseSeries(text: string): Series {
  const values: number[] = [];
  const displays: string[] = [];
  for (const match of text.matchAll(SERIES_NUMBER_RE)) {
    const value = parseFloat(match[0].replace(/,/g, ''));
    if (Number.isFinite(value)) {
      values.push(value);
      displays.push(match[0]);
    }
  }
  return { values, displays };
}

/**
 * Format a computed number for display: at most one decimal place, thousands
 * grouped. Written out by hand rather than through `toLocaleString`, so the
 * same document renders identically on every machine.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Math.abs(rounded).toFixed(Number.isInteger(rounded) ? 0 : 1);
  const [whole, fraction] = text.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded < 0 ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Bar fill as a percentage of the track, clamped to 0–100. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0)) return 0;
  const pct = (value / max) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100));
}

/** Which way a metric moved. */
export type TrendDirection = 'up' | 'down' | 'flat';

/** Whether the move was in the direction the author called good. */
export type TrendTone = 'good' | 'bad' | 'neutral';

/** Marks the direction in both the HTML and the text part. */
export const TREND_ARROWS: Record<TrendDirection, string> = {
  up: '\u25b2',
  down: '\u25bc',
  flat: '\u25ac',
};

/** Accepted values of the `good` parameter. */
export const GOOD_VALUES = new Set(['up', 'down', 'neutral']);

/**
 * Read a move against the direction the author called good.
 *
 * A metric that fell is only bad if rising was the win, and some numbers —
 * headcount, tickets opened — are neither. A flat move is never coloured: no
 * change is no news.
 */
export function trendTone(direction: TrendDirection, good: string): TrendTone {
  if (direction === 'flat' || good === 'neutral') return 'neutral';
  return direction === good ? 'good' : 'bad';
}
