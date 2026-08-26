/**
 * Shared data model for the `rating` directive.
 *
 * A rating block is one or more scores drawn on a fixed scale — the star row
 * under a product, the breakdown under a review. Both the MJML renderer (a row
 * of colored glyphs) and the plain-text renderer (the same glyphs as
 * characters) read a block through this, so the two can never disagree about
 * how many are lit.
 */

import { parseLabelValue, stripTags, splitValueLine } from './bar.js';

// The first list in the block is the data; `<ol>` works the same as `<ul>`.
const LIST_RE = /<([uo])l[^>]*>([\s\S]*?)<\/\1l>/;
const ITEM_RE = /<li([^>]*)>([\s\S]*?)<\/li>/g;

/** Whether a score is drawn to the nearest glyph or the nearest half. */
export type RatingPrecision = 'half' | 'full';

export const RATING_PRECISIONS = new Set<string>(['half', 'full']);

/**
 * The glyph pairs a rating can be drawn with: filled, then hollow.
 *
 * All four pairs are Basic Multilingual Plane characters that predate emoji,
 * so they are drawn from the reader's text font rather than fetched as images
 * — which is the whole point, since an email client that strips images still
 * has to show the score. The heart carries U+FE0E after it, the variation
 * selector that asks for the text rendering: left alone, some platforms
 * promote a bare heart to a color emoji.
 */
export const RATING_ICONS: Record<string, readonly [string, string]> = {
  star: ['★', '☆'],
  heart: ['♥︎', '♡︎'],
  circle: ['●', '○'],
  square: ['■', '□'],
};

/**
 * Look an icon up by name.
 *
 * Guarded rather than indexed directly: a plain object answers to every name on
 * `Object.prototype`, so `icon=constructor` would otherwise come back a
 * function where a pair of glyphs was expected.
 */
export function ratingIcons(name: string | undefined): readonly [string, string] | null {
  if (name === undefined || !Object.hasOwn(RATING_ICONS, name)) return null;
  return RATING_ICONS[name];
}

/** Widest scale drawn; past this a row of glyphs stops being countable at a glance. */
const MAX_SCALE = 10;

export interface RatingItem {
  /** Text before the last colon; empty when the score was written bare. */
  label: string;
  /** The score as the author wrote it, e.g. `4.5`. Clamped values are rewritten. */
  display: string;
  /** The score itself, clamped to the scale. */
  value: number;
  /** How many glyphs are lit, after rounding to the block's precision; may end in .5. */
  lit: number;
}

export interface RatingData {
  /** Content before the scores, rendered above them. */
  intro: string;
  /** Content after the scores, rendered below them. */
  rest: string;
  items: RatingItem[];
  /** Glyphs in the scale. */
  max: number;
  precision: RatingPrecision;
  showValues: boolean;
  /** List items carrying no number, which are dropped. */
  skipped: number;
  /** Problems worth telling the author about; the caller reports them. */
  warnings: string[];
}

/** Read the scale off the block, which must be a whole number of glyphs. */
function resolveScale(raw: string | undefined, warnings: string[]): number {
  if (raw === undefined) return 5;
  const value = raw.trim();
  const scale = /^\d+$/.test(value) ? parseInt(value, 10) : NaN;
  if (scale >= 1 && scale <= MAX_SCALE) return scale;
  warnings.push(`Invalid max "${raw}" for rating — expected a whole number from 1 to ${MAX_SCALE}; using 5.`);
  return 5;
}

/** Trim a score to the scale and round it to the glyphs the block draws in. */
function toItem(
  label: string,
  display: string,
  value: number,
  max: number,
  precision: RatingPrecision,
  warnings: string[],
): RatingItem {
  let score = value;
  if (score < 0 || score > max) {
    warnings.push(`Rating ${display}${label ? ` for "${label}"` : ''} is outside the 0–${max} scale — clamping.`);
    score = Math.max(0, Math.min(max, score));
  }
  const lit = precision === 'full' ? Math.round(score) : Math.round(score * 2) / 2;
  // A clamped score is shown as the number that was actually drawn: a readout
  // saying 7 beside five lit glyphs would just look like a rendering bug.
  const shown = score === value ? display : String(score);
  return { label, display: shown, value: score, lit };
}

/** Pull the scores out of a rating block, written either as a list or as one line. */
export function parseRating(
  content: string,
  attrs: Record<string, string | undefined> = {},
): RatingData {
  const warnings: string[] = [];
  const max = resolveScale(attrs.max, warnings);

  let precision: RatingPrecision = 'half';
  if (attrs.precision !== undefined) {
    if (RATING_PRECISIONS.has(attrs.precision)) precision = attrs.precision as RatingPrecision;
    else warnings.push(`Invalid precision "${attrs.precision}" for rating — expected half or full; using half.`);
  }

  const showValues = attrs.values !== 'false';
  const base = { max, precision, showValues, warnings };

  const list = LIST_RE.exec(content);

  // A list is a breakdown — one score per criterion. Without one the block is a
  // single headline score on its own line, the shape `progress` uses, and any
  // prose wrapped under it renders below rather than being read as data.
  if (!list) {
    const { line, rest } = splitValueLine(content);
    const parsed = parseLabelValue(line);
    if (!parsed) return { ...base, intro: content, rest: '', items: [], skipped: 0 };
    const item = toItem(parsed.label, parsed.display, parsed.value, max, precision, warnings);
    return { ...base, intro: '', rest, items: [item], skipped: 0 };
  }

  const items: RatingItem[] = [];
  let skipped = 0;
  const re = new RegExp(ITEM_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(list[2])) !== null) {
    const parsed = parseLabelValue(stripTags(match[2]));
    if (!parsed) {
      skipped++;
      continue;
    }
    items.push(toItem(parsed.label, parsed.display, parsed.value, max, precision, warnings));
  }

  return {
    ...base,
    intro: content.slice(0, list.index),
    rest: content.slice(list.index + list[0].length),
    items,
    skipped,
  };
}
