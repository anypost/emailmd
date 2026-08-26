import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_SPARKLINE_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * A sparkline, and its bar-less sibling the trend indicator:
 *
 *   ::: sparkline
 *   Weekly signups: 12, 19, 15, 27, 24, 31, 38
 *   :::
 *
 *   ::: trend good=down
 *   Churn: 4.1, 3.8, 3.5, 3.2
 *   :::
 *
 * The series is written `Label: a, b, c` — the same `Label:` shape `chart` and
 * `progress` use — and the columns are table cells with a background color, so
 * a trend line survives clients that strip images and SVG. `trend` renders the
 * same block as its readout alone: the latest value and how far it moved.
 *
 * Params: `min` / `max` (scale), `color` (column color), `track` (the groove
 * behind each column), `height`, `border-radius`, `good` (which direction is
 * the win), `values=false` (hide the readout).
 */
export function registerSparkline(md: MarkdownIt): void {
  md.use(container, 'sparkline', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'sparkline');
        return `<!--EMAILMD:SPARKLINE_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_SPARKLINE_CLOSE + '\n';
    },
  });

  // `trend` is the same block drawn without its columns, so it shares the
  // marker and the renderer rather than duplicating either.
  md.use(container, 'trend', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'trend');
        params.variant = 'trend';
        return `<!--EMAILMD:SPARKLINE_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_SPARKLINE_CLOSE + '\n';
    },
  });
}
