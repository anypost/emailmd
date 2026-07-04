import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEmailmdMcpServer, builderShareUrl } from '../src/mcp.js';

/** Connect a linked client/server pair and return the client. */
async function connect(options?: Parameters<typeof createEmailmdMcpServer>[0]): Promise<Client> {
  const server = createEmailmdMcpServer(options);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function firstText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  expect(content[0]?.type).toBe('text');
  return content[0]!.text!;
}

describe('mcp server', () => {
  it('exposes render, lint, and read_docs tools', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['lint', 'read_docs', 'render']);
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
    }
  });

  it('render returns html, text, meta, warnings, and a preview link', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'render',
      arguments: {
        markdown: '---\npreheader: Hi there\n---\n\n# Hello\n\nA test email.',
      },
    });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(firstText(result));
    expect(payload.html).toContain('<!doctype html>');
    expect(payload.html).toContain('Hello');
    expect(payload.text).toContain('HELLO');
    expect(payload.meta.preheader).toBe('Hi there');
    expect(payload.warnings).toEqual([]);
    expect(payload.htmlBytes).toBeGreaterThan(1000);
    expect(payload.previewUrl).toMatch(/^https:\/\/www\.emailmd\.dev\/builder#md=1\./);
  });

  it('render surfaces warnings and honors minify', async () => {
    const client = await connect();
    const markdown = '---\ntheme: nonsense\n---\n\n# Hello';
    const result = await client.callTool({ name: 'render', arguments: { markdown, minify: true } });
    const payload = JSON.parse(firstText(result));
    expect(payload.warnings.some((w: { message: string }) => w.message.includes('Unknown theme'))).toBe(true);
    const unminified = await client.callTool({ name: 'render', arguments: { markdown } });
    expect(payload.htmlBytes).toBeLessThan(JSON.parse(firstText(unminified)).htmlBytes);
  });

  it('render resolves partials, with call-level partials overriding server defaults', async () => {
    const client = await connect({ partials: { legal: 'Server legal text', promo: 'Server promo' } });
    const result = await client.callTool({
      name: 'render',
      arguments: {
        markdown: '# Hi\n\n::: include legal\n\n::: include promo',
        partials: { promo: 'Call-level promo' },
      },
    });
    const payload = JSON.parse(firstText(result));
    expect(payload.html).toContain('Server legal text');
    expect(payload.html).toContain('Call-level promo');
    expect(payload.html).not.toContain('Server promo');
  });

  it('rejects oversized markdown before rendering', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'render',
      arguments: { markdown: 'a'.repeat(256 * 1024 + 1) },
    });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('under 256KB');
  });

  it('lint reports findings with a summary', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'lint',
      arguments: { markdown: '# Hi\n\n![](http://example.com/a.png)' },
    });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(firstText(result));
    const ruleNames = payload.findings.map((f: { rule: string }) => f.rule);
    expect(ruleNames).toContain('image-alt');
    expect(ruleNames).toContain('insecure-link');
    expect(payload.summary).toMatch(/^\d+ problems? \(\d+ warnings?, \d+ suggestions?\)$/);
  });

  it('lint returns a clean summary for a clean email', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'lint',
      arguments: {
        markdown:
          '---\npreheader: A concise preview\n---\n\n# Hello\n\nRead the [full announcement](https://example.com/news).\n\n[Unsubscribe](https://example.com/unsub)',
      },
    });
    const payload = JSON.parse(firstText(result));
    expect(payload.findings).toEqual([]);
    expect(payload.summary).toBe('No problems found.');
  });

  it('read_docs rejects malformed page paths without fetching', async () => {
    const client = await connect();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const result = await client.callTool({
        name: 'read_docs',
        arguments: { page: '../etc/passwd' },
      });
      expect(result.isError).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  describe('read_docs fetching', () => {
    beforeAll(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url === 'https://www.emailmd.dev/llms.txt') {
          return new Response('# emailmd docs index', { status: 200 });
        }
        if (url === 'https://www.emailmd.dev/docs/theme.mdx') {
          return new Response('# Theme page', { status: 200 });
        }
        return new Response('not found', { status: 404 });
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('fetches the index when no page is given', async () => {
      const client = await connect();
      const result = await client.callTool({ name: 'read_docs', arguments: {} });
      expect(result.isError).toBeFalsy();
      expect(firstText(result)).toBe('# emailmd docs index');
    });

    it('fetches a specific page', async () => {
      const client = await connect();
      const result = await client.callTool({ name: 'read_docs', arguments: { page: 'theme' } });
      expect(firstText(result)).toBe('# Theme page');
    });

    it('flags missing pages as errors with a hint', async () => {
      const client = await connect();
      const result = await client.callTool({ name: 'read_docs', arguments: { page: 'no-such-page' } });
      expect(result.isError).toBe(true);
      expect(firstText(result)).toContain('HTTP 404');
    });
  });
});

describe('builderShareUrl', () => {
  it('round-trips through the builder share decoder', async () => {
    const { decodeShare } = await import('../../react/src/builder/share.js');
    const markdown = '---\npreheader: Round trip\n---\n\n# Hello\n\nSome **bold** text.';
    const url = await builderShareUrl(markdown);
    expect(url).toMatch(/^https:\/\/www\.emailmd\.dev\/builder#md=/);
    const encoded = url.split('#md=')[1]!;
    expect(await decodeShare(encoded)).toBe(markdown);
  });
});
