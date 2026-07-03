import {
  MARKER_CALLOUT_CLOSE,
  MARKER_CENTERED_CLOSE,
  MARKER_HIGHLIGHT_CLOSE,
  MARKER_HEADER_CLOSE,
  MARKER_FOOTER_CLOSE,
  MARKER_HERO_CLOSE,
  EMPTY_TABLE_HEADER_RE,
} from './constants.js';

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
  text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, (_, url, label) => {
    if (label.trim() === url.trim()) return url;
    if (url.startsWith('mailto:') && label.trim() === url.slice(7).trim()) return label.trim();
    return `${label} (${url})`;
  });

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
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  // Clean up whitespace: collapse multiple blank lines, trim
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
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
