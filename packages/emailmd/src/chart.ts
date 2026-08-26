/**
 * Shared data model for the `chart` directive.
 *
 * Both the MJML renderer (bars built from table cells) and the plain-text
 * renderer (ASCII bars) read a chart from the same parsed list, so the two
 * outputs can never disagree about which items or scale a chart has.
 */

import { parseLabelValue, stripTags } from './bar.js';

/** One bar: a label, the value as written, and its numeric magnitude. */
export interface ChartItem {
  /** Bar label, plain text with tags stripped. */
  label: string;
  /** The value exactly as the author wrote it, e.g. `4,200` or `42%`. */
  display: string;
  /** Numeric magnitude parsed out of `display`. */
  value: number;
  /** Per-item bar color from `{color=…}` on the list item. */
  color?: string;
}

export interface ChartData {
  /** Content before the list, rendered above the chart. */
  intro: string;
  items: ChartItem[];
  /** List items with no `Label: value` shape, which are dropped. */
  skipped: number;
}

// The first list in the block is the data; `<ol>` works the same as `<ul>`.
const LIST_RE = /<([uo])l[^>]*>([\s\S]*?)<\/\1l>/;
const ITEM_RE = /<li([^>]*)>([\s\S]*?)<\/li>/g;

function parseItem(attrString: string, inner: string): ChartItem | null {
  // A chart bar needs a label; a bare number has nothing to name it.
  const parsed = parseLabelValue(stripTags(inner));
  if (!parsed || !parsed.label) return null;

  const color = /\bcolor="([^"]*)"/.exec(attrString)?.[1];
  return { ...parsed, ...(color ? { color } : {}) };
}

/** Pull the intro text and `Label: value` bars out of a chart block's HTML. */
export function parseChart(content: string): ChartData {
  const list = LIST_RE.exec(content);
  if (!list) return { intro: content, items: [], skipped: 0 };

  const items: ChartItem[] = [];
  let skipped = 0;
  const re = new RegExp(ITEM_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(list[2])) !== null) {
    const item = parseItem(match[1], match[2]);
    if (item) items.push(item);
    else skipped++;
  }

  return { intro: content.slice(0, list.index), items, skipped };
}

/**
 * The value a full-width bar represents.
 *
 * Percentages scale against 100 rather than the largest item: drawing "42%" as
 * a full bar would read as 100% and misstate the data. Any other units scale
 * against the largest item, so the chart always uses its full width. `max=`
 * overrides both.
 */
export function resolveChartMax(items: ChartItem[], override?: number): number {
  if (override !== undefined && override > 0) return override;
  const largest = Math.max(...items.map((i) => i.value), 0);
  if (items.length > 0 && items.every((i) => i.display.endsWith('%')) && largest <= 100) {
    return 100;
  }
  return largest > 0 ? largest : 1;
}

