import type MarkdownIt from 'markdown-it';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * `::: divider color=#cccccc width=50% thickness=2px` — a styled horizontal
 * rule. Like spacer, this is a single-line leaf directive with no closing
 * fence. Plain `---` remains the unstyled form (themed via dividerColor).
 */
export function registerDivider(md: MarkdownIt): void {
  md.block.ruler.before(
    'fence',
    'divider',
    (state, startLine, _endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];
      // Disallow quotes in params so the marker attributes cannot be broken.
      const m = /^:{3,}\s*divider((?:\s+[^"\s]+)*)\s*$/.exec(state.src.slice(start, max));
      if (!m) return false;
      if (silent) return true;
      const token = state.push('divider', '', 0);
      token.markup = ':::';
      token.info = m[1] ?? '';
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  md.renderer.rules.divider = (tokens, idx) => {
    const params = parseDirectiveParams(`divider${tokens[idx].info}`, 'divider');
    return `<!--EMAILMD:DIVIDER${serializeMarkerAttrs(params)}-->\n`;
  };
}
