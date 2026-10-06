import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_BREAKDOWN_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * A ranked list or breakdown, one row per list item:
 *
 *   ::: breakdown bars=true
 *   1. Checkout: 4,210 (+12%)
 *      p95 182 ms
 *   2. Search: 3,980 (-3%)
 *   :::
 *
 * Each item is `Label: value` with an optional signed change after it, and
 * any lines under it become the sub-label. An ordered list ranks the rows.
 *
 * Params: `swatches=true` (a palette dot per row), `bars=true` (a bar under
 * each row), `dividers=false`, `good` (also settable per row), `color`,
 * `max`, `height`, `track`, `border-radius`.
 */
export function registerBreakdown(md: MarkdownIt): void {
  md.use(container, 'breakdown', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'breakdown');
        return `<!--EMAILMD:BREAKDOWN_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_BREAKDOWN_CLOSE + '\n';
    },
  });
}
