import {
  MARKER_CALLOUT_CLOSE,
  MARKER_CENTERED_CLOSE,
  MARKER_HIGHLIGHT_CLOSE,
  MARKER_HEADER_CLOSE,
  MARKER_FOOTER_CLOSE,
  MARKER_HERO_CLOSE,
  EMPTY_TABLE_HEADER_RE,
} from './constants.js';
import { parseChart, resolveChartMax } from './chart.js';
import { barPercent, parseNumber, TREND_ARROWS } from './bar.js';
import { parseProgress, type ProgressData } from './progress.js';
import { parseSparkline } from './sparkline.js';
import { parseStats } from './stats.js';
import { parseSteps, type StepState } from './steps.js';

/**
 * Convert rendered HTML (with directive markers) into a plain text email body.
 * Used for the text/plain MIME part.
 */
export function toPlainText(html: string): string {
  let text = html;

  // Strip directive markers (parameterized directives use regex to handle optional attrs)
  text = text.replace(/<!--EMAILMD:CALLOUT_OPEN(?:\s+[\w-]+="[^"]*")*-->/g, '');
  text = text.replace(new RegExp(escapeRegExp(MARKER_CALLOUT_CLOSE), 'g'), '');
  text = text.replace(/<!--EMAILMD:CENTERED_OPEN(?:\s+[\w-]+="[^"]*")*-->/g, '');
  text = text.replace(new RegExp(escapeRegExp(MARKER_CENTERED_CLOSE), 'g'), '');
  text = text.replace(/<!--EMAILMD:HIGHLIGHT_OPEN(?:\s+[\w-]+="[^"]*")*-->/g, '');
  text = text.replace(new RegExp(escapeRegExp(MARKER_HIGHLIGHT_CLOSE), 'g'), '');
  text = text.replace(/<!--EMAILMD:HEADER_OPEN(?:\s+[\w-]+="[^"]*")*-->/g, '');
  text = text.replace(new RegExp(escapeRegExp(MARKER_HEADER_CLOSE), 'g'), '');
  text = text.replace(/<!--EMAILMD:FOOTER_OPEN(?:\s+[\w-]+="[^"]*")*-->/g, '');
  text = text.replace(new RegExp(escapeRegExp(MARKER_FOOTER_CLOSE), 'g'), '');
  text = text.replace(/<!--EMAILMD:HERO_OPEN(?:\s+[\w-]+="[^"]*")*-->/g, '');
  text = text.replace(new RegExp(escapeRegExp(MARKER_HERO_CLOSE), 'g'), '');
  // Columns flatten to sequential content (covers COLUMNS_ and COLUMN_ markers)
  text = text.replace(/<!--EMAILMD:COLUMNS?_(?:OPEN|CLOSE)(?:\s+[\w-]+="[^"]*")*-->/g, '');
  // Spacers are purely visual
  text = text.replace(/<!--EMAILMD:SPACER(?:\s+[\w-]+="[^"]*")*-->/g, '');
  // Styled dividers read as a rule, same as ---
  text = text.replace(/<!--EMAILMD:DIVIDER(?:\s+[\w-]+="[^"]*")*-->/g, '\n---\n');
  // Social blocks flatten to their links
  text = text.replace(/<!--EMAILMD:SOCIAL_(?:OPEN|CLOSE)(?:\s+[\w-]+="[^"]*")*-->/g, '');

  // Accordions flatten to sequential headings + content
  text = text.replace(/<!--EMAILMD:ACCORDION_(?:OPEN|CLOSE)(?:\s+[\w-]+="[^"]*")*-->/g, '');

  // Charts become ASCII bars, before the generic list conversion claims them
  text = text.replace(
    /<!--EMAILMD:CHART_OPEN((?:\s+[\w-]+="[^"]*")*)-->([\s\S]*?)<!--EMAILMD:CHART_CLOSE-->/g,
    (_, attrString: string, inner: string) => chartToText(inner, attrString),
  );

  // Progress bars draw the same meter in ASCII
  text = text.replace(
    /<!--EMAILMD:PROGRESS_OPEN((?:\s+[\w-]+="[^"]*")*)-->([\s\S]*?)<!--EMAILMD:PROGRESS_CLOSE-->/g,
    (_, attrString: string, inner: string) => progressToText(inner, attrString),
  );

  // Sparklines keep their shape as block characters; `trend` blocks share the
  // marker and come through as their readout alone.
  text = text.replace(
    /<!--EMAILMD:SPARKLINE_OPEN((?:\s+[\w-]+="[^"]*")*)-->([\s\S]*?)<!--EMAILMD:SPARKLINE_CLOSE-->/g,
    (_, attrString: string, inner: string) => sparklineToText(inner, attrString),
  );

  // Stat tiles flatten to aligned columns, before the generic list conversion
  // claims their list
  text = text.replace(
    /<!--EMAILMD:STATS_OPEN((?:\s+[\w-]+="[^"]*")*)-->([\s\S]*?)<!--EMAILMD:STATS_CLOSE-->/g,
    (_, attrString: string, inner: string) => statsToText(inner, attrString),
  );

  // Steps become an indented outline, before the generic list conversion
  // claims their list
  text = text.replace(
    /<!--EMAILMD:STEPS_OPEN((?:\s+[\w-]+="[^"]*")*)-->([\s\S]*?)<!--EMAILMD:STEPS_CLOSE-->/g,
    (_, attrString: string, inner: string) => stepsToText(inner, attrString),
  );

  // Convert buttons: <p><a href="url" button="">Text</a></p> → Text: url
  // Handles both single and multiple buttons in one paragraph
  text = text.replace(/<p>\s*((?:<a\s+[^>]*>[^<]*<\/a>\s*)+)<\/p>/g, (match, inner) => {
    const linkRe = /<a\s+([^>]*?)>([^<]*)<\/a>/g;
    let linkMatch;
    const results: string[] = [];
    let allButtons = true;
    while ((linkMatch = linkRe.exec(inner)) !== null) {
      if (!/\bbutton\b/.test(linkMatch[1])) {
        allButtons = false;
        break;
      }
      const hrefMatch = linkMatch[1].match(/href="([^"]*)"/);
      const url = hrefMatch ? hrefMatch[1] : '';
      results.push(`${linkMatch[2]}: ${url}`);
    }
    if (!allButtons || results.length === 0) return match;
    return results.join('\n') + '\n';
  });

  // Convert headings to UPPERCASE (preserving template token case)
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_, content) => {
    return `\n${toUpperCasePreserveTokens(stripTags(content))}\n`;
  });

  // Convert images to [Image: alt], with the caption (if any) on the next line
  text = text.replace(/<img\s+([^>]*)>/gi, (_, attrString: string) => {
    const alt = /alt="([^"]*)"/i.exec(attrString)?.[1] ?? '';
    const caption = /caption="([^"]*)"/i.exec(attrString)?.[1];
    const label = alt ? `[Image: ${alt}]` : '';
    if (!caption) return label;
    return label ? `${label}\n${caption}` : caption;
  });

  // Convert links: <a href="url">text</a> → text (url)
  text = text.replace(LINK_RE, (_, url, label) => linkToText(url, label));

  // Convert definition lists: <dl><dt>term</dt><dd>definition</dd></dl>
  text = text.replace(/<dl>([\s\S]*?)<\/dl>/gi, (_, inner) => {
    let result = inner;
    result = result.replace(/<dt[^>]*>([\s\S]*?)<\/dt>/gi, (_: string, term: string) => `\n${stripTags(term).trim()}\n`);
    result = result.replace(/<dd[^>]*>([\s\S]*?)<\/dd>/gi, (_: string, def: string) => `  ${stripTags(def).trim()}\n`);
    return result;
  });

  // Convert lists (handles nesting, mixed types, indentation)
  text = convertLists(text);

  // Convert <br> and <hr>
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Convert blockquotes (inside-out to handle nesting)
  while (/<blockquote/i.test(text)) {
    text = text.replace(
      /<blockquote[^>]*>((?:(?!<blockquote)[\s\S])*?)<\/blockquote>/gi,
      (_, content) => {
        const lines = stripTags(content).trim().split('\n');
        return lines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n';
      },
    );
  }

  // Convert code blocks: <pre><code>...</code></pre> → indented content
  text = text.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, content) => {
    const lines = content.split('\n');
    if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    return '\n' + lines.map((l: string) => `    ${l}`).join('\n') + '\n';
  });

  // Convert inline code: <code>text</code> → `text`
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, (_, content) => {
    return '`' + content + '`';
  });

  // Convert tables to aligned text
  text = convertTables(text);

  // Convert paragraphs to double newlines
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Strip all remaining HTML tags
  text = stripTags(text);

  // Convert task list checkboxes to text markers
  text = text.replace(/\u2610/g, '[ ]');
  text = text.replace(/\u2611/g, '[x]');

  // Decode common HTML entities
  text = decodeEntities(text);

  // Clean up whitespace: collapse multiple blank lines, trim
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

const LINK_RE = /<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;

/** A link as text: its label, with the URL after it unless the two are the same. */
function linkToText(url: string, label: string): string {
  if (label.trim() === url.trim()) return url;
  if (url.startsWith('mailto:') && label.trim() === url.slice(7).trim()) return label.trim();
  return `${label} (${url})`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Attributes off a directive marker, e.g. ` max="10,000" steps="4"`. */
function markerAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of attrString.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

/** Widest ASCII bar, in characters. */
const TEXT_BAR_WIDTH = 24;

/**
 * Render a chart block as ASCII bars, so the text part carries the same
 * comparison the HTML bars draw rather than a bare list of numbers.
 *
 * Labels and values are entity-decoded here rather than in the final pass, so
 * the column padding is measured against the characters a reader actually sees.
 */
function chartToText(inner: string, attrString: string): string {
  const { intro, items } = parseChart(inner);
  if (items.length === 0) return inner;

  const parsedMax = parseNumber(markerAttrs(attrString).max);
  const max = resolveChartMax(items, parsedMax !== null && parsedMax > 0 ? parsedMax : undefined);

  const labels = items.map((i) => decodeEntities(i.label));
  const values = items.map((i) => decodeEntities(i.display));
  const labelWidth = Math.max(...labels.map((l) => l.length));

  const lines = items.map((item, i) => {
    const pct = barPercent(item.value, max);
    const filled = pct > 0 ? Math.max(1, Math.round((pct / 100) * TEXT_BAR_WIDTH)) : 0;
    const bar = '█'.repeat(filled).padEnd(TEXT_BAR_WIDTH);
    return `${labels[i].padEnd(labelWidth)}  ${bar}  ${values[i]}`;
  });

  return `${intro}\n${lines.join('\n')}\n`;
}

/**
 * Render a progress block as an ASCII meter.
 *
 * Unlike a chart, the empty part of the track is drawn too: a lone bar has no
 * sibling to be measured against, so without the groove a third of the way
 * through would just look like a short bar.
 */
function progressToText(inner: string, attrString: string): string {
  const data = parseProgress(inner, markerAttrs(attrString));
  if (!data) return inner;

  const bar = data.steps > 0 ? steppedTextBar(data) : continuousTextBar(data.pct);
  const line = data.readout ? `${bar}  ${decodeEntities(data.readout)}` : bar;

  // The label heads the meter and the readout closes it, the same shape the
  // HTML draws — printing the authored "Label: value" line as well would say
  // the number twice.
  const heading = data.label ? `${decodeEntities(data.label)}\n` : '';
  return `${heading}${line}\n${data.rest}`;
}

function continuousTextBar(pct: number): string {
  const filled = pct > 0 ? Math.max(1, Math.round((pct / 100) * TEXT_BAR_WIDTH)) : 0;
  return '█'.repeat(filled) + '░'.repeat(TEXT_BAR_WIDTH - filled);
}

function steppedTextBar(data: ProgressData): string {
  const width = Math.max(2, Math.floor(TEXT_BAR_WIDTH / data.steps));
  return Array.from({ length: data.steps }, (_, i) => (i < data.filled ? '█' : '░').repeat(width)).join(' ');
}

/** Eight column heights, from a baseline tick to a full column. */
const SPARK_LEVELS = '▁▂▃▄▅▆▇█';

/**
 * Render a sparkline as block characters, so the shape of the series survives
 * the text part instead of flattening to a row of numbers. A `trend` block has
 * no columns to draw, so it comes through as a single readout line.
 */
function sparklineToText(inner: string, attrString: string): string {
  const data = parseSparkline(inner, markerAttrs(attrString));
  if (!data) return inner;

  const label = decodeEntities(data.label);
  const readout = data.showValues
    ? `${decodeEntities(data.latest)}  ${TREND_ARROWS[data.direction]} ${data.delta}`
    : '';

  if (data.bare) {
    return `${[label, readout].filter(Boolean).join('  ')}\n${data.rest}`;
  }

  const spark = data.heights
    .map((pct) => SPARK_LEVELS[Math.max(0, Math.min(7, Math.round((pct / 100) * 7)))])
    .join('');
  const line = readout ? `${spark}  ${readout}` : spark;

  // Label above, readout closing the line — the same shape progress draws.
  return `${label ? `${label}\n` : ''}${line}\n${data.rest}`;
}

/**
 * Render a stats block as aligned columns.
 *
 * A grid of tiles has no meaning in a text part, so the tiles become one row
 * each — label, value, change — padded into columns so the numbers still line
 * up to be read down.
 */
function statsToText(inner: string, attrString: string): string {
  const { intro, items } = parseStats(inner, markerAttrs(attrString));
  if (items.length === 0) return inner;

  const labels = items.map((i) => decodeEntities(i.label));
  const values = items.map((i) => decodeEntities(i.value));
  const labelWidth = Math.max(...labels.map((l) => l.length));
  const valueWidth = Math.max(...values.map((v) => v.length));

  const lines = items.map((item, i) => {
    const delta = item.delta ? `  ${TREND_ARROWS[item.direction]} ${decodeEntities(item.delta)}` : '';
    // Only the value column is padded when nothing trails it, so a block with
    // no changes does not end every line in a run of spaces.
    const value = delta ? values[i].padEnd(valueWidth) : values[i];
    return `${labels[i].padEnd(labelWidth)}  ${value}${delta}`;
  });

  return `${intro}\n${lines.join('\n')}\n`;
}

/** How a tracker's stops are marked in a text part. */
const STEP_TEXT_MARKERS: Record<StepState, string> = {
  plain: '',
  done: '[\u2713]',
  current: '[\u2192]',
  todo: '[ ]',
  failed: '[\u2715]',
};

/** Flatten one step's inline HTML into text lines, keeping its breaks. */
function stepLines(html: string): string[] {
  // Links are spelled out here rather than left to the generic pass below,
  // which runs after this block has already been flattened to text.
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(new RegExp(LINK_RE.source, 'gi'), (_, url: string, label: string) => linkToText(url, label))
      .replace(/<[^>]*>/g, ''),
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Render a steps block as an indented outline.
 *
 * The markers carry over as the closest thing text has to them — a number, or
 * a ticked box — and detail is indented under its own step, so a reader
 * skimming the left edge still sees where the walk has got to.
 */
function stepsToText(inner: string, attrString: string): string {
  const { intro, items, tracker } = parseSteps(inner, markerAttrs(attrString));
  if (items.length === 0) return inner;

  const prefixes = items.map((item) => (tracker ? STEP_TEXT_MARKERS[item.state] : `${item.number}.`));
  const width = Math.max(...prefixes.map((p) => p.length));
  const indent = ' '.repeat(width + 1);

  const lines: string[] = [];
  items.forEach((item, i) => {
    lines.push(`${prefixes[i].padEnd(width)} ${stepLines(item.title).join(' ')}`);
    for (const line of stepLines(item.description)) lines.push(indent + line);
  });

  return `${intro}\n${lines.join('\n')}\n`;
}

function convertLists(html: string): string {
  return processListsInText(html, 0);
}

function processListsInText(text: string, depth: number): string {
  const listOpenRe = /<(ul|ol)[^>]*>/i;
  let result = '';
  let remaining = text;

  while (remaining.length > 0) {
    const match = listOpenRe.exec(remaining);
    if (!match) {
      result += remaining;
      break;
    }

    result += remaining.slice(0, match.index);
    const tagName = match[1].toLowerCase();
    const afterOpen = remaining.slice(match.index + match[0].length);
    const closeIndex = findMatchingClose(afterOpen, tagName);

    if (closeIndex === -1) {
      result += remaining.slice(match.index);
      break;
    }

    const listContent = afterOpen.slice(0, closeIndex);
    remaining = afterOpen.slice(closeIndex + `</${tagName}>`.length);
    result += processListItems(listContent, tagName, depth);
  }

  return result;
}

function findMatchingClose(html: string, tagName: string): number {
  const openRe = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tagName}>`, 'gi');
  let nesting = 1;
  let searchFrom = 0;

  while (nesting > 0) {
    openRe.lastIndex = searchFrom;
    closeRe.lastIndex = searchFrom;
    const openMatch = openRe.exec(html);
    const closeMatch = closeRe.exec(html);

    if (!closeMatch) return -1;

    if (openMatch && openMatch.index < closeMatch.index) {
      nesting++;
      searchFrom = openMatch.index + openMatch[0].length;
    } else {
      nesting--;
      if (nesting === 0) return closeMatch.index;
      searchFrom = closeMatch.index + closeMatch[0].length;
    }
  }
  return -1;
}

function processListItems(html: string, listType: string, depth: number): string {
  const indent = '  '.repeat(depth);
  let result = '';
  let counter = 0;

  const liOpenRe = /<li[^>]*>/gi;
  let liMatch: RegExpExecArray | null;

  while ((liMatch = liOpenRe.exec(html)) !== null) {
    const start = liMatch.index + liMatch[0].length;
    const afterLiOpen = html.slice(start);
    const closeLiIndex = findMatchingClose(afterLiOpen, 'li');
    if (closeLiIndex === -1) continue;

    const liContent = afterLiOpen.slice(0, closeLiIndex);
    counter++;

    const marker = listType === 'ol' ? `${counter}.` : '-';

    // Separate text content from nested sublists
    const nestedListRe = /<(ul|ol)[^>]*>/i;
    const nestedMatch = nestedListRe.exec(liContent);

    if (nestedMatch) {
      const textPart = liContent.slice(0, nestedMatch.index);
      const cleanText = stripTags(textPart).trim();
      if (cleanText) {
        result += `${indent}${marker} ${cleanText}\n`;
      }
      const nestedPart = liContent.slice(nestedMatch.index);
      result += processListsInText(nestedPart, depth + 1);
    } else {
      const cleanText = stripTags(liContent).trim();
      if (cleanText) {
        result += `${indent}${marker} ${cleanText}\n`;
      }
    }

    liOpenRe.lastIndex = start + closeLiIndex + '</li>'.length;
  }

  return result;
}

function convertTables(html: string): string {
  const tableRe = /<table>[\s\S]*?<\/table>/gi;
  return html.replace(tableRe, (tableHtml) => {
    // An all-empty header row means "headerless table" — drop the row.
    const headerless = EMPTY_TABLE_HEADER_RE.test(tableHtml);
    if (headerless) tableHtml = tableHtml.replace(EMPTY_TABLE_HEADER_RE, '');

    const rows: string[][] = [];
    const rowRe = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
      const cells: string[] = [];
      const cellRe = /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
        cells.push(stripTags(cellMatch[1]).trim());
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) return '';

    // Calculate column widths
    const colCount = Math.max(...rows.map((r) => r.length));
    const colWidths: number[] = [];
    for (let c = 0; c < colCount; c++) {
      colWidths[c] = Math.max(...rows.map((r) => (r[c] || '').length));
    }

    // Format rows with padding
    const lines = rows.map((row) => {
      const cells = row.map((cell, c) => cell.padEnd(colWidths[c]));
      return cells.join('   ');
    });

    // Insert separator after header row
    if (!headerless && lines.length > 1) {
      const separator = colWidths.map((w) => '-'.repeat(w)).join('   ');
      lines.splice(1, 0, separator);
    }

    return '\n' + lines.join('\n') + '\n';
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches common template token delimiters: {{...}}, {%...%}, <%...%>, ${...}, %%...%% */
const TEMPLATE_TOKEN_RE = /(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|&lt;%[\s\S]*?%&gt;|<%[\s\S]*?%>|\$\{[\s\S]*?\}|%%[\s\S]*?%%)/g;

function toUpperCasePreserveTokens(str: string): string {
  const parts = str.split(TEMPLATE_TOKEN_RE);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      parts[i] = parts[i].toUpperCase();
    }
  }
  return parts.join('');
}
