import type MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { MARKER_HERO_CLOSE } from '../constants.js';
import { serializeMarkerAttrs, unquote } from '../params.js';

export function registerHero(md: MarkdownIt): void {
  md.use(container, 'hero', {
    validate(params: string) {
      return params.trim().startsWith('hero');
    },
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const info = tokens[idx].info.trim();
        const rest = info.slice('hero'.length).trim();
        // First non-key=value token is the URL, remaining are params
        const tokens2 = rest.split(/\s+/).filter(Boolean);
        let url = '';
        const params: Record<string, string> = {};
        for (const t of tokens2) {
          const eq = t.indexOf('=');
          // Only treat as key=value if the key is a simple word (e.g. color=#fff),
          // not a URL containing = in query params (e.g. ?w=1200)
          if (eq !== -1 && /^[\w-]+$/.test(t.slice(0, eq))) {
            params[t.slice(0, eq)] = unquote(t.slice(eq + 1));
          } else if (!url) {
            url = unquote(t);
          }
        }
        const attrs = serializeMarkerAttrs({ url, ...params });
        return `<!--EMAILMD:HERO_OPEN${attrs}-->\n`;
      }
      return MARKER_HERO_CLOSE + '\n';
    },
  });
}
