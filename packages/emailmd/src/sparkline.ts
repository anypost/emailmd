/**
 * Shared data model for the `sparkline` and `trend` directives.
 *
 * A sparkline is a run of numbers drawn small enough to sit beside its own
 * label: the shape of a metric over time, not a chart to read values off. The
 * `trend` form is the same block with the columns left off, leaving just the
 * latest value and how far it has moved.
 *
 * The MJML renderer (columns built from table cells), the plain-text renderer
 * (block characters) and the trend readout all resolve a block through this,
 * so none of them can disagree about which way a metric went.
 */

import {
  splitValueLine,
  parseSeries,
  parseNumber,
  formatNumber,
  barPercent,
  trendTone,
  GOOD_VALUES,
  type TrendDirection,
  type TrendTone,
} from './bar.js';

/** Past this, columns are thinner than a hairline in an email client. */
export const MAX_SPARKLINE_POINTS = 60;

/** Two points is the least that can show a direction. */
const MIN_POINTS = 2;

export interface SparklineData {
  /** Text before the colon; empty when the block is a bare series. */
  label: string;
  /** Column heights as a percentage of the plot area, 0–100, one per point. */
  heights: number[];
  /** The last point, exactly as the author wrote it. */
  latest: string;
  /** How far the series moved, e.g. `217%` or `1,200`. The arrow carries the sign. */
  delta: string;
  direction: TrendDirection;
  tone: TrendTone;
  /** True for a `trend` block: the readout without the columns. */
  bare: boolean;
  /** False when `values=false` hid the readout. */
  showValues: boolean;
  /** Content after the value line, rendered below the sparkline. */
  rest: string;
  /** Problems worth telling the author about; the caller reports them. */
  warnings: string[];
}

/**
 * Read a sparkline block's series, scale, and trend.
 *
 * Returns null when the block holds fewer than two numbers — one point has no
 * shape and no direction, so the caller degrades it to regular text rather
 * than drawing a single meaningless column.
 */
/**
 * A move, rounded to the precision it can carry: a decimal place matters at
 * "3.2%" and is noise at "217%".
 */
function formatDelta(value: number): string {
  return formatNumber(Math.abs(value) >= 10 ? Math.round(value) : value);
}

export function parseSparkline(
  content: string,
  attrs: Record<string, string | undefined> = {},
): SparklineData | null {
  const { line, rest } = splitValueLine(content);

  // Same split as `chart` and `progress`: on the last colon, so a label may
  // contain one. A line with no colon is a bare series carrying no label.
  const sep = line.lastIndexOf(':');
  const label = sep === -1 ? '' : line.slice(0, sep).trim();
  const { values, displays } = parseSeries(sep === -1 ? line : line.slice(sep + 1));
  if (values.length < MIN_POINTS) return null;

  const warnings: string[] = [];

  // Trimming keeps the *last* points: recent history is what a sparkline is
  // for, and the trend is measured after the trim so the number and the
  // picture describe the same window.
  let points = values;
  let shown = displays;
  if (points.length > MAX_SPARKLINE_POINTS) {
    warnings.push(
      `Sparkline has ${points.length} points — drawing the last ${MAX_SPARKLINE_POINTS}; more than that is too thin to read.`,
    );
    points = points.slice(-MAX_SPARKLINE_POINTS);
    shown = shown.slice(-MAX_SPARKLINE_POINTS);
  }

  // Columns are measured from zero, not from the smallest point: a column
  // starting mid-air makes a steady metric look violent. The floor drops
  // below zero only where the data does, and `min` opens up a flat series.
  let floor = Math.min(0, ...points);
  let ceiling = Math.max(...points);

  if (attrs.min !== undefined) {
    const parsed = parseNumber(attrs.min);
    if (parsed !== null && parsed < ceiling) floor = parsed;
    else warnings.push(`Invalid min "${attrs.min}" for sparkline — measuring from ${formatNumber(floor)}.`);
  }
  if (attrs.max !== undefined) {
    const parsed = parseNumber(attrs.max);
    if (parsed !== null && parsed > floor) ceiling = parsed;
    else warnings.push(`Invalid max "${attrs.max}" for sparkline — scaling to the largest point.`);
  }
  // A series that never moves still has to draw something.
  if (!(ceiling > floor)) ceiling = floor + 1;

  const span = ceiling - floor;
  const heights = points.map((value) => barPercent(value - floor, span));

  const first = points[0];
  const last = points[points.length - 1];
  const change = last - first;
  const direction: TrendDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  // A percentage change against a zero or negative start is either undefined
  // or actively misleading, so those report the absolute move instead.
  const delta = first > 0
    ? `${formatDelta(Math.abs(change / first) * 100)}%`
    : formatDelta(Math.abs(change));

  let good = attrs.good ?? 'up';
  if (!GOOD_VALUES.has(good)) {
    warnings.push(`Invalid good "${attrs.good}" for sparkline — expected up, down, or neutral; treating up as good.`);
    good = 'up';
  }
  const tone: TrendTone = trendTone(direction, good);

  return {
    label,
    heights,
    latest: shown[shown.length - 1],
    delta,
    direction,
    tone,
    bare: attrs.variant === 'trend',
    showValues: attrs.values !== 'false',
    rest,
    warnings,
  };
}
