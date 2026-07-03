import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_SOCIAL_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * Social icon row:
 *
 *   ::: social
 *   - [GitHub](https://github.com/anypost/emailmd)
 *   - [X](https://x.com/emailmd)
 *   :::
 *
 * The network (icon) is derived from each link's hostname. Params: `labels`
 * (show link text next to icons), `icon-size`, `icon-base` (self-hosted icon
 * set), and alignment keywords.
 */
export function registerSocial(md: MarkdownIt): void {
  md.use(container, 'social', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const info = tokens[idx].info.trim();
        const params = parseDirectiveParams(info, 'social');
        // `labels` is a bare flag, which parseDirectiveParams drops.
        if (/(?:^|\s)labels(?:\s|$)/.test(info.slice('social'.length))) {
          params.labels = 'true';
        }
        return `<!--EMAILMD:SOCIAL_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_SOCIAL_CLOSE + '\n';
    },
  });
}
