import type MarkdownIt from 'markdown-it';

/**
 * `::: spacer 24` — explicit vertical whitespace, rendered as mj-spacer.
 *
 * Unlike the container directives this is a single-line leaf: it takes no
 * content, so requiring a closing fence would only invite the
 * swallow-the-rest-of-the-document mistake when it is forgotten.
 */
export function registerSpacer(md: MarkdownIt): void {
  md.block.ruler.before(
    'fence',
    'spacer',
    (state, startLine, _endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];
      // Height is restricted to word/percent characters, so the marker
      // attribute below cannot be broken out of.
      const m = /^:{3,}\s*spacer(?:\s+([\w.%-]+))?\s*$/.exec(state.src.slice(start, max));
      if (!m) return false;
      if (silent) return true;
      const token = state.push('spacer', '', 0);
      token.markup = ':::';
      token.info = m[1] ?? '';
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  md.renderer.rules.spacer = (tokens, idx) => {
    const height = tokens[idx].info;
    return height ? `<!--EMAILMD:SPACER height="${height}"-->\n` : '<!--EMAILMD:SPACER-->\n';
  };
}
