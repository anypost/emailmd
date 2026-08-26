import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_CHART_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * Horizontal bar chart:
 *
 *   ::: chart
 *   - Direct: 4,200
 *   - Organic search: 3,100
 *   - Referral: 1,800
 *   :::
 *
 * Each list item is one bar, written as `Label: value`. Bars are table cells
 * with a background color — no images, no SVG, no CSS the clients strip — so
 * they render everywhere, respond to dark mode, and degrade to ASCII bars in
 * the text part. Params: `max` (scale maximum), `color` / `track` (bar and
 * groove colors), `height` (bar thickness), `values=false` (hide the numbers).
 * A single bar can be recolored with `{color=…}` on its list item.
 */
export function registerChart(md: MarkdownIt): void {
  md.use(container, 'chart', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'chart');
        return `<!--EMAILMD:CHART_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_CHART_CLOSE + '\n';
    },
  });
}
