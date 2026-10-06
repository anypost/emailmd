/**
 * Shared data model for the `breakdown` directive.
 *
 * A breakdown is a ranked or unranked list of values: one row per list item,
 * with a label, an optional sub-label under it, a value, and optionally the
 * change beside it. Both the MJML renderer (a table) and the plain-text renderer
 * (aligned columns) read a block through this, so the two never disagree.
 */

import { parseNumber, stripTags, trendTone, GOOD_VALUES, type TrendDirection, type TrendTone } from './bar.js';
import { splitDelta } from './stats.js';

// The first list in the block is the data. An `<ol>` ranks its rows.
const LIST_RE = /<([uo])l([^>]*)>([\s\S]*?)<\/\1l>/;
const ITEM_RE = /<li([^>]*)>([\s\S]*?)<\/li>/g;

/**
 * Attributes written at the end of an item's first line. markdown-it-attrs
 * only lifts `{…}` from the end of an item's *last* line onto the `<li>`, but
 * the first line is where a row's data, and so its `{good=down}`, is written.
 */
const LINE_ATTRS_RE = /\s*\{([^{}]*=[^{}]*)\}\s*$/;
const ATTR_PAIR_RE = /([\w-]+)=("[^"]*"|'[^']*'|[^\s"']+)/g;

export interface BreakdownItem {
  /** The row's position, when the block is an ordered list. */
  rank?: number;
  /** Text before the last colon of the first line. */
  label: string;
  /** The lines after the first, joined; empty when there are none. */
  sub: string;
  /** The value as written, without its change. Need not be numeric. */
  value: string;
  /** The number in the value, for the bar; `null` when it has none. */
  number: number | null;
  /** The change with its sign stripped, e.g. `12%`; empty when the row has none. */
  delta: string;
  direction: TrendDirection;
  tone: TrendTone;
  /** Per-item data color from `{color=…}`. */
  color?: string;
}

export interface BreakdownData {
  /** Content before the list, rendered above the rows. */
  intro: string;
  items: BreakdownItem[];
  /** True when the list is ordered, so every row has a rank. */
  ranked: boolean;
  /** List items with no `Label: value` first line, which are dropped. */
  skipped: number;
  /** Problems worth telling the author about; the caller reports them. */
  warnings: string[];
}

function readAttrs(attrString: string, into: Record<string, string>): void {
  for (const [, key, raw] of attrString.matchAll(ATTR_PAIR_RE)) {
    into[key] = raw.replace(/^(["'])([\s\S]*)\1$/, '$2');
  }
}

function parseItem(attrString: string, inner: string, blockGood: string, warnings: string[]): Omit<BreakdownItem, 'rank'> | null {
  // Paragraphs of a loose item are lines like any other.
  const text = stripTags(inner.replace(/<\/p>\s*<p>/g, '\n')).trim();
  const [rawFirst, ...rest] = text.split('\n');

  const attrs: Record<string, string> = {};
  readAttrs(attrString, attrs);
  let first = rawFirst;
  const lineAttrs = LINE_ATTRS_RE.exec(first);
  if (lineAttrs) {
    readAttrs(lineAttrs[1], attrs);
    first = first.slice(0, lineAttrs.index);
  }

  // Split on the *last* colon, as `chart` and `stats` do, so a label may
  // contain one. Only the first line is data: a sub-label may hold colons too.
  const sep = first.lastIndexOf(':');
  if (sep === -1) return null;
  const label = first.slice(0, sep).trim();
  const after = first.slice(sep + 1).trim();
  if (!label || !after) return null;

  const { value, delta, direction } = splitDelta(after);

  let good = blockGood;
  if (attrs.good !== undefined) {
    if (GOOD_VALUES.has(attrs.good)) good = attrs.good;
    else warnings.push(`Invalid good "${attrs.good}" for row "${label}" — expected up, down, or neutral; using the block's.`);
  }

  return {
    label,
    sub: rest.map((line) => line.trim()).filter(Boolean).join(' '),
    value,
    number: parseNumber(value),
    delta,
    direction,
    tone: delta ? trendTone(direction, good) : 'neutral',
    ...(attrs.color ? { color: attrs.color } : {}),
  };
}

/** Pull the intro text and rows out of a breakdown block. */
export function parseBreakdown(
  content: string,
  attrs: Record<string, string | undefined> = {},
): BreakdownData {
  const warnings: string[] = [];

  let good = attrs.good ?? 'up';
  if (!GOOD_VALUES.has(good)) {
    warnings.push(`Invalid good "${attrs.good}" for breakdown — expected up, down, or neutral; treating up as good.`);
    good = 'up';
  }

  const list = LIST_RE.exec(content);
  if (!list) return { intro: content, items: [], ranked: false, skipped: 0, warnings };

  const ranked = list[1] === 'o';
  const start = ranked ? parseInt(/\bstart="(-?\d+)"/.exec(list[2])?.[1] ?? '1', 10) : 1;

  const items: BreakdownItem[] = [];
  let skipped = 0;
  for (const match of list[3].matchAll(new RegExp(ITEM_RE.source, 'g'))) {
    const item = parseItem(match[1], match[2], good, warnings);
    if (!item) {
      skipped++;
      continue;
    }
    // A rank counts the list's items, skipped ones included, so a row keeps
    // the number its author wrote beside it.
    const position = items.length + skipped;
    items.push(ranked ? { rank: start + position, ...item } : item);
  }

  return { intro: content.slice(0, list.index), items, ranked, skipped, warnings };
}
