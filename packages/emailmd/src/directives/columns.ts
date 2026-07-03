import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_COLUMNS_CLOSE, MARKER_COLUMN_CLOSE } from '../constants.js';
import { parseDirectiveParams, serializeMarkerAttrs } from '../params.js';

/**
 * Multi-column layout:
 *
 *   :::: columns
 *   ::: column width=40
 *   Left content
 *   :::
 *   ::: column
 *   Right content
 *   :::
 *   ::::
 *
 * A bare numeric token on a column is shorthand for width (`::: column 40`).
 */
function parseColumnParams(info: string) {
  const params = parseDirectiveParams(info, 'column');
  if (!params.width) {
    const rest = info.trim().slice('column'.length).trim();
    for (const token of rest.split(/\s+/)) {
      if (/^\d+(?:\.\d+)?%?$/.test(token)) {
        params.width = token;
        break;
      }
    }
  }
  return params;
}

export function registerColumns(md: MarkdownIt): void {
  md.use(container, 'columns', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseDirectiveParams(tokens[idx].info.trim(), 'columns');
        return `<!--EMAILMD:COLUMNS_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_COLUMNS_CLOSE + '\n';
    },
  });
  md.use(container, 'column', {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const params = parseColumnParams(tokens[idx].info.trim());
        return `<!--EMAILMD:COLUMN_OPEN${serializeMarkerAttrs(params)}-->\n`;
      }
      return MARKER_COLUMN_CLOSE + '\n';
    },
  });
}
