import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_STEPS_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * A numbered walk-through, and its dated sibling the timeline:
 *
 *   ::: steps
 *   1. Create your account: Takes about a minute.
 *   2. Connect your data: Point us at your warehouse.
 *   3. Invite your team
 *   :::
 *
 *   ::: steps
 *   - [x] Order placed: 12 Mar
 *   - [x] Shipped: 14 Mar
 *   - [ ] Out for delivery
 *   - [ ] Delivered
 *   :::
 *
 * Each list item is one step, written as `Title: detail` or as two paragraphs.
 * Tick an item off and the block becomes a tracker: the ticked steps are
 * behind the reader, the first one that is not is where they are now.
 *
 * `timeline` is the same block with dot markers instead of numbers, for stops
 * that are events rather than instructions.
 *
 * Params: `color` (marker accent), `rail` (the connector, `none` to drop it),
 * `marker` (`number`, `dot`, or `none`), `size`, `gap`, `start` (first
 * number), and `state` per item.
 */
export function registerSteps(md: MarkdownIt): void {
  md.use(container, 'steps', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'steps');
        return `<!--EMAILMD:STEPS_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_STEPS_CLOSE + '\n';
    },
  });

  // `timeline` is the same walk drawn without its numbers, so it shares the
  // marker and the renderer rather than duplicating either.
  md.use(container, 'timeline', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'timeline');
        params.variant = 'timeline';
        return `<!--EMAILMD:STEPS_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_STEPS_CLOSE + '\n';
    },
  });
}
