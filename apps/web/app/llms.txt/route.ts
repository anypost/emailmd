import { source } from '@/lib/source';
import { SITE_URL } from '@/lib/get-llm-text';

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();

  const lines = [
    '# emailmd',
    '',
    '> emailmd converts markdown to email-safe HTML that works everywhere.',
    '',
    `## Docs (${pages.length} pages)`,
    '',
    ...pages.map(
      (page) => `- [${page.data.title}](${SITE_URL}${page.url})`,
    ),
  ];

  return new Response(lines.join('\n'));
}
