import { source } from '@/lib/source';
import type { InferPageType } from 'fumadocs-core/source';

type DocsPage = InferPageType<typeof source>;

export const SITE_URL = 'https://www.emailmd.dev';

/**
 * fumadocs' processed markdown flattens every heading to `Title [#id]` — the
 * `#` markers are dropped and the id is left behind as a bare bracket token.
 * Rebuild the real heading using the depth recorded in the page's TOC.
 */
function restoreHeadings(markdown: string, toc: DocsPage['data']['toc']) {
  const depths = new Map(
    toc.map((item) => [item.url.replace(/^#/, ''), item.depth]),
  );

  return markdown.replace(
    /^(.+) \[#([\w-]+)\]$/gm,
    (line, title: string, id: string) => {
      const depth = depths.get(id);
      return depth ? `${'#'.repeat(depth)} ${title}` : line;
    },
  );
}

/**
 * Links in the docs are site-relative (`/docs/mcp`) or in-page (`#mcp-server`).
 * The llms.txt outputs are read with no base URL, so consumers guess at one and
 * invent pages that don't exist (`#mcp-server` on the CLI page becoming
 * `/docs/mcp-server`). Make every target absolute.
 */
function absolutizeLinks(markdown: string, pageUrl: string) {
  return markdown.replace(
    /(\]\()(\/[^)\s]*|#[\w-]+)(\))/g,
    (_line, open: string, href: string, close: string) =>
      href.startsWith('#')
        ? `${open}${SITE_URL}${pageUrl}${href}${close}`
        : `${open}${SITE_URL}${href}${close}`,
  );
}

export async function getLLMText(page: DocsPage) {
  const processed = await page.data.getText('processed');
  const body = absolutizeLinks(
    restoreHeadings(processed, page.data.toc),
    page.url,
  );

  return `# ${page.data.title}

Source: ${SITE_URL}${page.url}

${body}`;
}
