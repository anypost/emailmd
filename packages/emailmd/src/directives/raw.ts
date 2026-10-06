import type MarkdownIt from 'markdown-it';
import { MARKER_RAW_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/** `::: raw`, with optional params, and nothing else on the line. */
const RAW_OPEN_RE = /^(:{3,})\s*raw(?:\s+.*)?$/;

/**
 * `::: raw` … `:::` — a block of HTML passed through untouched, in a section
 * of its own with no side padding.
 *
 * This is a fence rather than a container: the lines inside are never parsed
 * as markdown, so a blank line, an indented line, or an `_underscore_` in an
 * embedded fragment cannot end the HTML block or turn into a code block or
 * emphasis. Like a code fence, the closing `:::` must be at least as long as
 * the opening one, and an unclosed block runs to the end of the document.
 *
 * When raw HTML is disabled (`allowHtml: false`) the rule does not match, so
 * the block falls through to ordinary markdown and its tags are escaped to
 * text like any other raw HTML.
 */
export function registerRaw(md: MarkdownIt): void {
  md.block.ruler.before(
    'fence',
    'raw',
    (state, startLine, endLine, silent) => {
      if (!state.md.options.html) return false;
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const line = state.src.slice(start, state.eMarks[startLine]).trimEnd();
      const m = RAW_OPEN_RE.exec(line);
      if (!m) return false;
      if (silent) return true;

      const fenceLen = m[1].length;
      let next = startLine;
      let closed = false;
      for (;;) {
        next++;
        if (next >= endLine) break;
        const pos = state.bMarks[next] + state.tShift[next];
        const max = state.eMarks[next];
        // A non-empty line dedented past the enclosing block ends it, as with a fence.
        if (pos < max && state.sCount[next] < state.blkIndent) break;
        if (state.sCount[next] - state.blkIndent >= 4) continue;
        const close = /^(:{3,})\s*$/.exec(state.src.slice(pos, max));
        if (close && close[1].length >= fenceLen) {
          closed = true;
          break;
        }
      }

      state.line = next + (closed ? 1 : 0);
      const token = state.push('raw_block', '', 0);
      token.markup = m[1];
      token.info = line.slice(fenceLen).trim();
      token.content = state.getLines(startLine + 1, next, state.sCount[startLine], true);
      token.map = [startLine, state.line];
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  md.renderer.rules.raw_block = (tokens, idx) => {
    const token = tokens[idx];
    const attrs = serializeMarkerAttrs(parseDirectiveParams(token.info, 'raw'));
    return `<!--EMAILMD:RAW_OPEN${attrs}-->\n${token.content}${MARKER_RAW_CLOSE}\n`;
  };
}
