/**
 * Shared data model for the `steps` directive.
 *
 * A steps block is an ordered walk: numbered instructions, or a tracker whose
 * earlier stops are already behind you. Both the MJML renderer (markers on a
 * connecting rail) and the plain-text renderer (an indented outline) read a
 * block through this, so the two can never disagree about where a reader is.
 */

import { stripTags } from './bar.js';

// The first list in the block is the data; its open tag carries `<ol start>`.
const LIST_RE = /<([uo])l([^>]*)>([\s\S]*?)<\/\1l>/;
const ITEM_RE = /<li([^>]*)>([\s\S]*?)<\/li>/g;

// Task-list checkboxes reach us as characters: the parser swaps the `<input>`
// out before any of this, because email clients strip form controls.
const CHECKED_RE = /^☑\s*/;
const UNCHECKED_RE = /^☐\s*/;

/**
 * Where a step sits in the walk.
 *
 * `plain` is a step in a list that tracks nothing — a how-to, where every step
 * is drawn the same because none of them has happened yet or already has.
 */
export type StepState = 'plain' | 'done' | 'current' | 'todo' | 'failed';

/** States an author may write, which excludes the one meaning "not a tracker". */
export const STEP_STATES = new Set(['done', 'current', 'todo', 'failed']);

export interface StepItem {
  /** First line of the item, as inline HTML. */
  title: string;
  /** Anything after it — a second paragraph, or the tail of a `Title: detail` line. */
  description: string;
  state: StepState;
  /** The number drawn in the marker, honouring an `<ol start>`. */
  number: number;
}

export interface StepsData {
  /** Content before the list, rendered above the steps. */
  intro: string;
  items: StepItem[];
  /** True when any step carries a state, which is what turns a list into a tracker. */
  tracker: boolean;
  /** List items with no text at all, which are dropped. */
  skipped: number;
  /** Problems worth telling the author about; the caller reports them. */
  warnings: string[];
}

/**
 * Split a one-paragraph step into its title and the detail after the colon.
 *
 * The colon has to be followed by a space to count, which is what keeps a bare
 * `https://example.com` — whose colon is not — from tearing a step in half.
 * Angle brackets are tracked so a colon inside a tag is never the split point.
 */
function splitOnColon(html: string): { title: string; description: string } {
  let depth = 0;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') depth++;
    else if (ch === '>') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0 && /\s/.test(html[i + 1] ?? '')) {
      const title = html.slice(0, i).trim();
      const description = html.slice(i + 1).trim();
      if (title && description) return { title, description };
      return { title: html.trim(), description: '' };
    }
  }
  return { title: html.trim(), description: '' };
}

/**
 * Reduce a step's trailing blocks to something a table cell can hold.
 *
 * Paragraphs become one run separated by breaks, since a `<p>`'s margins are
 * the first thing an email client throws away. Anything else — a nested list,
 * a table — is left as the blocks it already is rather than flattened.
 */
function flattenBlocks(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  if (/^(?:<p>[\s\S]*?<\/p>\s*)+$/.test(trimmed)) {
    return [...trimmed.matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((m) => m[1].trim())
      .join('<br /><br />');
  }
  return trimmed;
}

function parseItem(attrString: string, inner: string, number: number): {
  item: StepItem;
  explicit: string | undefined;
  checked: boolean | null;
} | null {
  // A step written across two paragraphs splits on the paragraph break; one
  // written on a single line splits on its first colon. Structure wins, so a
  // colon in the headline of a two-paragraph step is left alone.
  const firstPara = /^\s*<p>([\s\S]*?)<\/p>([\s\S]*)$/.exec(inner);
  let title = firstPara ? firstPara[1].trim() : inner.trim();
  let description = firstPara ? flattenBlocks(firstPara[2]) : '';
  if (!description) ({ title, description } = splitOnColon(title));

  let checked: boolean | null = null;
  if (CHECKED_RE.test(title)) {
    checked = true;
    title = title.replace(CHECKED_RE, '');
  } else if (UNCHECKED_RE.test(title)) {
    checked = false;
    title = title.replace(UNCHECKED_RE, '');
  }

  if (!stripTags(title).trim()) return null;

  return {
    item: { title, description, state: 'plain', number },
    explicit: /\bstate="([^"]*)"/.exec(attrString)?.[1],
    checked,
  };
}

/** Pull the intro text and the steps out of a steps block. */
export function parseSteps(
  content: string,
  attrs: Record<string, string | undefined> = {},
): StepsData {
  const warnings: string[] = [];
  const list = LIST_RE.exec(content);
  if (!list) return { intro: content, items: [], tracker: false, skipped: 0, warnings };

  let start = 1;
  const listStart = /\bstart="(\d+)"/.exec(list[2])?.[1];
  if (listStart) start = parseInt(listStart, 10);
  if (attrs.start !== undefined) {
    const raw = attrs.start.trim();
    if (/^\d+$/.test(raw)) start = parseInt(raw, 10);
    else warnings.push(`Invalid start "${attrs.start}" for steps — expected a whole number; using ${start}.`);
  }

  const parsed: Array<NonNullable<ReturnType<typeof parseItem>>> = [];
  let skipped = 0;
  const re = new RegExp(ITEM_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(list[3])) !== null) {
    const entry = parseItem(match[1], match[2], start + parsed.length);
    if (entry) parsed.push(entry);
    else skipped++;
  }

  let tracker = false;
  for (const { item, explicit, checked } of parsed) {
    if (explicit !== undefined) {
      if (STEP_STATES.has(explicit)) {
        item.state = explicit as StepState;
        tracker = true;
        continue;
      }
      warnings.push(`Invalid state "${explicit}" for step — expected done, current, todo, or failed; ignoring it.`);
    }
    if (checked !== null) {
      item.state = checked ? 'done' : 'todo';
      tracker = true;
    }
  }

  const items = parsed.map((p) => p.item);
  // Anything left unmarked in a tracker is still ahead of the reader. Which of
  // those the reader is *on* is never inferred: an unticked box says the step
  // has not happened, and picking one of them out as "you are here" would
  // render something the author did not write. `{state=current}` says it.
  if (tracker) for (const item of items) if (item.state === 'plain') item.state = 'todo';

  return { intro: content.slice(0, list.index), items, tracker, skipped, warnings };
}
