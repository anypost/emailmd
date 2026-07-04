/*
 * Model Context Protocol server for emailmd. One registration function feeds
 * both transports: `emailmd mcp` (stdio, via the CLI) and the hosted
 * Streamable HTTP endpoint at emailmd.dev.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { render, lint } from './index.js';

/** Injected by tsup at build time; source runs (tests) fall back. */
declare const EMAILMD_VERSION: string | undefined;
const VERSION = typeof EMAILMD_VERSION === 'string' ? EMAILMD_VERSION : '0.0.0-dev';

const SITE_URL = 'https://www.emailmd.dev';

/** Server identity shared by the stdio and hosted transports. */
export const EMAILMD_MCP_SERVER_INFO = { name: 'emailmd', version: VERSION };

/** Options for {@link createEmailmdMcpServer} and {@link registerEmailmdTools}. */
export interface McpServerOptions {
  /**
   * Preloaded partials available to every `render`/`lint` call (the CLI fills
   * this from `--partials`). Per-call partials merge on top.
   */
  partials?: Record<string, string>;
}

export const EMAILMD_MCP_INSTRUCTIONS = `emailmd turns markdown into responsive, email-safe HTML that renders correctly across Gmail, Outlook, Apple Mail, and the rest.

Typical workflow:
1. Write emailmd markdown. Standard markdown works; email-specific features are opt-in:
   - YAML frontmatter: preheader, theme (light|dark|auto), fonts, a dark: override map, and theme keys like accent_color or font_family.
   - Buttons: [Get Started](https://example.com){button} (variants: {button.secondary}, {button.success}, ...).
   - Layout directives: ::: hero, ::: columns with ::: column (outer block uses ::::), ::: callout, ::: header, ::: footer, ::: divider, ::: spacer, ::: social, ::: accordion, ::: centered, and ::: include <partial>.
2. Call lint and fix what it finds (deliverability, accessibility, readability).
3. Call render for the final html, the plain-text MIME part, and previewUrl. Share previewUrl with the user so they can open the email in a live preview.

Call read_docs with no arguments for the docs index, and read the specific page (e.g. 'directives/hero', 'frontmatter', 'theme') before using syntax you have not already seen this session.`;

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw');
  const writePromise = (async () => {
    const writer = stream.writable.getWriter();
    await writer.write(new Uint8Array(bytes));
    await writer.close();
  })();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await writePromise;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Builder share link for a markdown document, in the same
 * `#md=1.<base64url(deflate-raw)>` format the builder itself produces.
 * The document travels in the URL fragment, so it never reaches the server.
 */
export async function builderShareUrl(markdown: string): Promise<string> {
  const deflated = await deflateRaw(new TextEncoder().encode(markdown));
  return `${SITE_URL}/builder#md=1.${b64url(deflated)}`;
}

/** Well past any legitimate email (Gmail clips at 102KB), but bounds worst-case render CPU. */
const MAX_INPUT_BYTES = 256 * 1024;

const markdownArg = z
  .string()
  .max(MAX_INPUT_BYTES, `markdown must be under ${MAX_INPUT_BYTES / 1024}KB`)
  .describe('The emailmd markdown document, optionally starting with YAML frontmatter.');
const partialsArg = z
  .record(z.string().max(200), z.string().max(MAX_INPUT_BYTES, `each partial must be under ${MAX_INPUT_BYTES / 1024}KB`))
  .optional()
  .describe('Named markdown partials spliced in wherever the document says "::: include <name>".');

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const textResult = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
const errorResult = (err: unknown): ToolResult => ({
  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
  isError: true,
});

/** Register the emailmd tools on an existing {@link McpServer}. */
export function registerEmailmdTools(server: McpServer, options?: McpServerOptions): void {
  const baseTool = { partials: options?.partials };

  server.registerTool(
    'render',
    {
      title: 'Render an email',
      description:
        'Render emailmd markdown into email-safe HTML. Returns html (the complete email document), text (the plain-text MIME part), meta (frontmatter), warnings (non-fatal repairs made while rendering; aim for none), htmlBytes, and previewUrl (a live browser preview of this exact document to share with the user).',
      inputSchema: {
        markdown: markdownArg,
        minify: z
          .boolean()
          .optional()
          .describe('Minify the HTML. Recommended for sending; helps stay under Gmail\'s 102KB clip limit.'),
        partials: partialsArg,
      },
    },
    async ({ markdown, minify, partials }) => {
      try {
        const result = await render(markdown, {
          minify,
          partials: { ...baseTool.partials, ...partials },
        });
        const htmlBytes = new TextEncoder().encode(result.html).length;
        return textResult(
          JSON.stringify(
            {
              html: result.html,
              text: result.text,
              meta: result.meta,
              warnings: result.warnings ?? [],
              htmlBytes,
              previewUrl: await builderShareUrl(markdown),
            },
            null,
            2,
          ),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'lint',
    {
      title: 'Lint an email',
      description:
        'Check emailmd markdown for deliverability, accessibility, and readability problems without rendering it: missing alt text, http:// links, Gmail\'s 102KB clip limit, generic link text, spam-trigger phrases, and more. Fix warnings before sending; suggestions are sometimes intentional (e.g. transactional emails without an unsubscribe link).',
      inputSchema: {
        markdown: markdownArg,
        partials: partialsArg,
      },
    },
    async ({ markdown, partials }) => {
      try {
        const findings = await lint(markdown, {
          partials: { ...baseTool.partials, ...partials },
        });
        const warnings = findings.filter((f) => f.severity === 'warning').length;
        const summary =
          findings.length === 0
            ? 'No problems found.'
            : `${findings.length} problem${findings.length === 1 ? '' : 's'} (${warnings} warning${warnings === 1 ? '' : 's'}, ${findings.length - warnings} suggestion${findings.length - warnings === 1 ? '' : 's'})`;
        return textResult(JSON.stringify({ findings, summary }, null, 2));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'read_docs',
    {
      title: 'Read emailmd docs',
      description:
        "Fetch emailmd documentation from emailmd.dev. Call with no arguments for the index of all pages; pass page to read one (e.g. 'buttons', 'frontmatter', 'theme', 'directives/hero'). Read the relevant page before using syntax you are not sure about.",
      inputSchema: {
        page: z
          .string()
          .max(200)
          .regex(/^[a-z0-9][a-z0-9/-]*$/, 'lowercase path segments like "theme" or "directives/hero"')
          .optional()
          .describe("Docs page path, e.g. 'buttons' or 'directives/hero'. Omit for the index."),
      },
    },
    async ({ page }) => {
      try {
        const url = page ? `${SITE_URL}/docs/${page}.mdx` : `${SITE_URL}/llms.txt`;
        const res = await fetch(url);
        if (!res.ok) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Could not fetch ${url} (HTTP ${res.status}). Call read_docs with no arguments to list valid pages.`,
              },
            ],
            isError: true,
          };
        }
        return textResult(await res.text());
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** Create a ready-to-connect emailmd MCP server (used by `emailmd mcp`). */
export function createEmailmdMcpServer(options?: McpServerOptions): McpServer {
  const server = new McpServer(EMAILMD_MCP_SERVER_INFO, {
    instructions: EMAILMD_MCP_INSTRUCTIONS,
  });
  registerEmailmdTools(server, options);
  return server;
}
