/**
 * Shared data model for the `progress` directive.
 *
 * A progress block is one bar against a known maximum: how far along a goal,
 * an onboarding flow, or a quota the reader is. The MJML renderer (table
 * cells) and the plain-text renderer (ASCII bars) both resolve a block
 * through this, so the two can never disagree about how full a bar is or what
 * its readout says.
 */

import { parseLabelValue, parseNumber, barPercent, splitValueLine } from './bar.js';

/** Past this, segments are too thin to read in an email client. */
export const MAX_PROGRESS_STEPS = 12;

export interface ProgressData {
  /** Text before the value, shown beside the readout. Empty for a bare value. */
  label: string;
  /** Fill as a percentage of the track, 0–100. */
  pct: number;
  /** Text shown opposite the label; empty when `values=false`. */
  readout: string;
  /** Segment count in stepped mode; 0 for one continuous bar. */
  steps: number;
  /** Filled segments in stepped mode. */
  filled: number;
  /** Content after the value paragraph, rendered below the bar. */
  rest: string;
  /** Problems worth telling the author about; the caller reports them. */
  warnings: string[];
}

/**
 * Read a progress block's value, scale, and readout.
 *
 * Returns null when nothing in the block parses as a number — the caller
 * degrades the block to regular text rather than drawing a meaningless bar.
 */
export function parseProgress(
  content: string,
  attrs: Record<string, string | undefined> = {},
): ProgressData | null {
  const { line, rest } = splitValueLine(content);
  const parsed = parseLabelValue(line);
  if (!parsed) return null;

  const warnings: string[] = [];

  let steps = 0;
  if (attrs.steps !== undefined) {
    const count = parseNumber(attrs.steps);
    if (count !== null && Number.isInteger(count) && count >= 2 && count <= MAX_PROGRESS_STEPS) {
      steps = count;
    } else {
      warnings.push(
        `Invalid steps "${attrs.steps}" for progress — expected a whole number from 2 to ${MAX_PROGRESS_STEPS}; drawing one continuous bar.`,
      );
    }
  }

  // A bare number means "out of 100", the scale a progress bar implies.
  // `steps` sets its own maximum; `max` overrides for any other unit.
  let max = 100;
  let denominator = '';
  if (steps > 0) {
    max = steps;
    denominator = String(steps);
  } else if (attrs.max !== undefined) {
    const parsedMax = parseNumber(attrs.max);
    if (parsedMax !== null && parsedMax > 0) {
      max = parsedMax;
      denominator = attrs.max.trim();
    } else {
      warnings.push(`Invalid max "${attrs.max}" for progress — scaling to 100.`);
    }
  }

  const pct = barPercent(parsed.value, max);
  const filled = steps > 0 ? Math.max(0, Math.min(steps, Math.round(parsed.value))) : 0;

  // The readout prints the value as authored. A known denominator is spelled
  // out beside it, so "8,400" reads as progress rather than a bare total.
  let readout = '';
  if (attrs.values !== 'false') {
    if (steps > 0) readout = `${filled} / ${denominator}`;
    else if (denominator) readout = `${parsed.display} / ${denominator}`;
    else readout = parsed.display;
  }

  return { label: parsed.label, pct, readout, steps, filled, rest, warnings };
}
