import { source } from '@/lib/source';

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
      (page) => `- [${page.data.title}](https://www.emailmd.dev${page.url})`,
    ),
  ];

  return new Response(lines.join('\n'));
}
