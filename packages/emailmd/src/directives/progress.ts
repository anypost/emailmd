import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_PROGRESS_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * A progress bar or stepped meter:
 *
 *   ::: progress max=10,000
 *   Raised so far: 8,400
 *   :::
 *
 *   ::: progress steps=4
 *   Account setup: 2
 *   :::
 *
 * The value is written `Label: value`, the same shape `chart` uses, and the
 * bar is drawn from table cells with a background color — no images, no SVG.
 * Unlike a chart bar, the unfilled groove always shows, because a lone bar has
 * no sibling to be measured against. Params: `max` (what a full bar means,
 * default 100), `steps` (draw N discrete segments instead), `color` / `track`
 * (fill and groove colors), `height`, `border-radius`, `values=false`.
 */
export function registerProgress(md: MarkdownIt): void {
  md.use(container, 'progress', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'progress');
        return `<!--EMAILMD:PROGRESS_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_PROGRESS_CLOSE + '\n';
    },
  });
}
