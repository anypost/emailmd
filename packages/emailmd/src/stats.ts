/**
 * Shared data model for the `stats` directive.
 *
 * A stats block is a row of KPI tiles: a label, the number it names, and
 * optionally how far that number moved. Both the MJML renderer (a grid of
 * cards) and the plain-text renderer (aligned columns) read a block through
 * this, so the two can never disagree about a value or which way it went.
 */

import { stripTags, trendTone, GOOD_VALUES, type TrendDirection, type TrendTone } from './bar.js';

// The first list in the block is the data; `<ol>` works the same as `<ul>`.
const LIST_RE = /<([uo])l[^>]*>([\s\S]*?)<\/\1l>/;
const ITEM_RE = /<li([^>]*)>([\s\S]*?)<\/li>/g;

/**
 * A trailing parenthetical, which is where a tile's change is written.
 *
 * Only a *signed* parenthetical is read as a change — `(+12%)` is a delta,
 * `(last 30 days)` is part of the value. Without that rule an author could not
 * write a parenthetical at all without it turning into a trend line.
 */
const DELTA_RE = /^([\s\S]*?)\s*\(([^()]*)\)$/;
const UP_RE = /^[+▲↑]\s*/;
const DOWN_RE = /^[-−–▼↓]\s*/;

export interface StatItem {
  /** Text before the last colon; the tile's caption. */
  label: string;
  /** Everything after it, exactly as the author wrote it. Need not be numeric. */
  value: string;
  /** The change with its sign stripped, e.g. `12%`; empty when the tile has none. */
  delta: string;
  /** `flat` exactly when there is no change to draw; the arrow carries the sign. */
  direction: TrendDirection;
  tone: TrendTone;
  /** Per-item value color from `{color=…}` on the list item. */
  color?: string;
}

export interface StatsData {
  /** Content before the list, rendered above the tiles. */
  intro: string;
  items: StatItem[];
  /** List items with no `Label: value` shape, which are dropped. */
  skipped: number;
  /** Problems worth telling the author about; the caller reports them. */
  warnings: string[];
}

/** Split a tile's text into its value and the signed change trailing it. */
function splitDelta(text: string): { value: string; delta: string; direction: TrendDirection } {
  const match = DELTA_RE.exec(text);
  if (!match || !match[1].trim()) return { value: text, delta: '', direction: 'flat' };

  const inner = match[2].trim();
  const up = UP_RE.test(inner);
  const down = !up && DOWN_RE.test(inner);
  if (!up && !down) return { value: text, delta: '', direction: 'flat' };

  const delta = inner.replace(up ? UP_RE : DOWN_RE, '').trim();
  if (!delta) return { value: text, delta: '', direction: 'flat' };

  return { value: match[1].trim(), delta, direction: up ? 'up' : 'down' };
}

function parseItem(attrString: string, inner: string, blockGood: string): StatItem | null {
  // Split on the *last* colon, the same as `chart` and `progress`, so a label
  // may contain one. A tile needs both halves: a bare number has nothing to
  // name it, and a bare label has nothing to report.
  const text = stripTags(inner).trim();
  const sep = text.lastIndexOf(':');
  if (sep === -1) return null;
  const label = text.slice(0, sep).trim();
  const rest = text.slice(sep + 1).trim();
  if (!label || !rest) return null;

  const { value, delta, direction } = splitDelta(rest);

  // One block routinely mixes metrics that want opposite readings — revenue up
  // is a win, churn up is not — so `good` is settable per tile as well.
  const itemGood = /\bgood="([^"]*)"/.exec(attrString)?.[1];
  const good = itemGood !== undefined && GOOD_VALUES.has(itemGood) ? itemGood : blockGood;

  const color = /\bcolor="([^"]*)"/.exec(attrString)?.[1];
  return {
    label,
    value,
    delta,
    direction,
    tone: delta ? trendTone(direction, good) : 'neutral',
    ...(color ? { color } : {}),
  };
}

/** Pull the intro text and `Label: value (±change)` tiles out of a stats block. */
export function parseStats(
  content: string,
  attrs: Record<string, string | undefined> = {},
): StatsData {
  const warnings: string[] = [];

  let good = attrs.good ?? 'up';
  if (!GOOD_VALUES.has(good)) {
    warnings.push(`Invalid good "${attrs.good}" for stats — expected up, down, or neutral; treating up as good.`);
    good = 'up';
  }

  const list = LIST_RE.exec(content);
  if (!list) return { intro: content, items: [], skipped: 0, warnings };

  const items: StatItem[] = [];
  let skipped = 0;
  const re = new RegExp(ITEM_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(list[2])) !== null) {
    const item = parseItem(match[1], match[2], good);
    if (item) items.push(item);
    else skipped++;
  }

  return { intro: content.slice(0, list.index), items, skipped, warnings };
}

/**
 * Tiles per row when the author has not said.
 *
 * Three across is as narrow as a tile can get at the default content width
 * before its number starts wrapping, and four items read better as a 2×2 block
 * than as a row of three with an orphan under it.
 */
export function defaultStatColumns(count: number): number {
  if (count <= 3) return Math.max(1, count);
  return count === 4 ? 2 : 3;
}
