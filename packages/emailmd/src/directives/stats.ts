import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_STATS_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * A row of stat / KPI tiles:
 *
 *   ::: stats
 *   - Revenue: $48,200 (+12%)
 *   - New customers: 340 (+8%)
 *   - Churn: 2.1% (-0.4pt) {good=down}
 *   :::
 *
 * Each list item is one tile, written as `Label: value` with the change, if
 * any, in a signed parenthetical after it. Tiles are `mj-column` cards, so
 * they sit side by side on a desktop client and stack on a phone; the value
 * is free text, since not every headline number is a number.
 *
 * Params: `columns` (tiles per row), `bg` (tile background, `none` for no
 * card), `color` (value color), `align`, `size` (value type size), `gap`,
 * `good` (which direction is the win, also settable per tile).
 */
export function registerStats(md: MarkdownIt): void {
  md.use(container, 'stats', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'stats');
        return `<!--EMAILMD:STATS_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_STATS_CLOSE + '\n';
    },
  });
}
