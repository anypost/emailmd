import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_ACCORDION_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * Collapsible accordion (FAQ) block:
 *
 *   ::: accordion
 *   ### How do I reset my password?
 *   Click "Forgot password" on the sign-in page.
 *
 *   ### Where is my order?
 *   Check the tracking link in your confirmation email.
 *   :::
 *
 * Each heading becomes a clickable title; the content below it becomes the
 * collapsible panel. Clients without interactive support (Gmail, Outlook)
 * show every panel expanded. Params: `icon-wrapped` / `icon-unwrapped`
 * (self-hosted expand/collapse icon URLs).
 */
export function registerAccordion(md: MarkdownIt): void {
  md.use(container, 'accordion', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'accordion');
        return `<!--EMAILMD:ACCORDION_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_ACCORDION_CLOSE + '\n';
    },
  });
}
