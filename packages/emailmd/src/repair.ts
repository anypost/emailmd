import type { RenderWarning } from './warnings.js';

/**
 * Repair a `columns` block opened with three colons instead of four.
 *
 * The outer fence needs four colons so the inner `:::` closes don't
 * terminate it; with three, markdown-it-container closes the block at the
 * first bare `:::`, the first column swallows the block at full width,
 * later columns degrade to plain text, and the final `:::` leaks into the
 * output as a literal paragraph. AI-written markdown hits this often.
 *
 * The repair upgrades the open fence and its matching close to four colons.
 * The close is found by tracking inner container opens: each bare `:::`
 * closes the innermost pending open, and the one that arrives with nothing
 * left open belongs to the columns block. A misopened block with no close
 * at all only needs its open upgraded — an unclosed container extends to
 * the end of the document, which is the intended layout anyway.
 *
 * Lines are edited in place, never inserted or removed, so line numbers
 * (which lint findings point at) are preserved.
 */
export function repairColumnsFences(markdown: string, warnings?: RenderWarning[]): string {
  if (!/^ {0,3}:::(?!:)\s*columns\b/m.test(markdown)) return markdown;

  const lines = markdown.split('\n');
  let repaired = false;
  let codeFence: string | null = null;
  let open = -1; // line index of the misopened ::: columns
  let depth = 0; // inner container opens pending a close

  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
    if (code) {
      if (!codeFence) codeFence = code[1];
      else if (code[1][0] === codeFence[0] && code[1].length >= codeFence.length) codeFence = null;
      continue;
    }
    if (codeFence) continue;

    if (open === -1) {
      if (/^ {0,3}:::(?!:)\s*columns\b/.test(lines[i])) {
        open = i;
        depth = 0;
      }
      continue;
    }
    if (/^ {0,3}:{3,}\s*[^\s:]/.test(lines[i])) {
      depth++;
    } else if (/^ {0,3}:{3,}\s*$/.test(lines[i])) {
      if (depth > 0) {
        depth--;
      } else {
        lines[open] = lines[open].replace(':::', '::::');
        lines[i] = lines[i].replace(':::', '::::');
        repaired = true;
        open = -1;
      }
    }
  }
  if (open !== -1) {
    lines[open] = lines[open].replace(':::', '::::');
    repaired = true;
  }

  if (!repaired) return markdown;
  warnings?.push({
    stage: 'content',
    message:
      'A columns block was opened with ":::" — the outer fence needs four colons so the inner ":::" closes don\'t end it. Repaired automatically; write ":::: columns … ::::".',
  });
  return lines.join('\n');
}
