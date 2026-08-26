import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_RATING_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * A star rating, and its breakdown:
 *
 *   ::: rating
 *   Overall: 4.5
 *   :::
 *
 *   ::: rating
 *   - Comfort: 4.5
 *   - Value for money: 3.5
 *   - Customer service: 5
 *   :::
 *
 * The score is written `Label: value` — the same shape `chart`, `progress` and
 * `sparkline` use — as one line for a headline score or as a list for a
 * breakdown. The row is drawn from text glyphs rather than images, so a score
 * still shows in a client that blocks them.
 *
 * Params: `max` (glyphs in the scale, default 5), `icon` (`star`, `heart`,
 * `circle`, `square`), `color` / `track` (lit and unlit glyphs), `size`,
 * `precision` (`half` or `full`), `align`, `values=false` (hide the readout).
 */
export function registerRating(md: MarkdownIt): void {
  md.use(container, 'rating', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'rating');
        return `<!--EMAILMD:RATING_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_RATING_CLOSE + '\n';
    },
  });
}
