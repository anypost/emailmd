import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { render, lint, type LintFinding } from './index.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
);

const HELP = `
emailmd v${version} — Render markdown into email-safe HTML

Usage:
  emailmd [file] [options]
  emailmd lint [file] [options]
  emailmd mcp [options]

Arguments:
  file              Markdown file to render (reads stdin if omitted)

Commands:
  lint              Check the email for deliverability, accessibility, and
                    readability problems instead of rendering it. Exits 1
                    when warnings are found (--strict: suggestions too).
  mcp               Run the emailmd MCP server on stdio, exposing render,
                    lint, and read_docs tools to AI clients. --partials
                    preloads partials for every render/lint call.

Options:
  -o, --output <f>  Write output to file instead of stdout
  -t, --text        Output plain text instead of HTML
  -m, --minify      Minify the HTML output
  -b, --beautify    Pretty-print the HTML output (ignored with --minify)
  -p, --partials <path>  Partials for "::: include <name>" — a directory of
                    .md files (subdirectories become name prefixes:
                    blocks/legal) or a single .md file. Repeatable;
                    later paths win on name collisions.
  --strict          Lint only: exit non-zero on suggestions as well
  -h, --help        Show this help message
  -v, --version     Show version number

Examples:
  emailmd input.md
  emailmd input.md -o output.html
  emailmd input.md --text
  emailmd input.md --minify -o output.html
  emailmd input.md --beautify
  emailmd input.md --partials ./partials
  emailmd input.md -p ./partials -p ./extra/legal.md
  emailmd lint input.md
  emailmd mcp --partials ./partials
  echo "# Hello" | emailmd
`.trimStart();

/**
 * Load every `.md` file under a directory as a partial. The name is the
 * path relative to the directory without the extension, always `/`-separated
 * (`blocks/legal.md` → `blocks/legal`).
 */
function loadPartialsDir(dir: string, prefix = ''): Record<string, string> {
  const partials: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(partials, loadPartialsDir(full, `${prefix}${entry.name}/`));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      partials[`${prefix}${entry.name.slice(0, -3)}`] = readFileSync(full, 'utf-8');
    }
  }
  return partials;
}

/**
 * Load one `--partials` argument: a directory of `.md` files, or a single
 * file whose name is its basename without the `.md` extension.
 */
function loadPartialsPath(path: string): Record<string, string> {
  if (statSync(path).isDirectory()) return loadPartialsDir(path);
  const name = basename(path).replace(/\.md$/, '');
  return { [name]: readFileSync(path, 'utf-8') };
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        output: { type: 'string', short: 'o' },
        text: { type: 'boolean', short: 't', default: false },
        minify: { type: 'boolean', short: 'm', default: false },
        beautify: { type: 'boolean', short: 'b', default: false },
        partials: { type: 'string', short: 'p', multiple: true },
        strict: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`emailmd: ${msg}\nRun 'emailmd --help' for usage.\n`);
    process.exitCode = 1;
    return;
  }

  const { values, positionals } = args;

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  if (values.version) {
    process.stdout.write(`${version}\n`);
    return;
  }

  let partials: Record<string, string> | undefined;
  if (Array.isArray(values.partials)) {
    partials = {};
    for (const path of values.partials) {
      try {
        Object.assign(partials, loadPartialsPath(String(path)));
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        process.stderr.write(`emailmd: cannot read partials path '${path}': ${detail}\n`);
        process.exitCode = 1;
        return;
      }
    }
  }

  if (positionals[0] === 'mcp') {
    if (positionals.length > 1) {
      process.stderr.write(`emailmd: 'mcp' takes no arguments\nRun 'emailmd --help' for usage.\n`);
      process.exitCode = 1;
      return;
    }
    const { createEmailmdMcpServer } = await import('./mcp.js');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    // stdout is the protocol channel from here on; nothing else may write to it.
    await createEmailmdMcpServer({ partials }).connect(new StdioServerTransport());
    return;
  }

  const isLint = positionals[0] === 'lint';
  const fileArgs = isLint ? positionals.slice(1) : positionals;

  if (fileArgs.length > 1) {
    process.stderr.write(`emailmd: expected at most one positional argument, got ${fileArgs.length}\nRun 'emailmd --help' for usage.\n`);
    process.exitCode = 1;
    return;
  }

  let markdown: string;

  if (fileArgs.length === 1) {
    const file = fileArgs[0];
    try {
      markdown = readFileSync(file, 'utf-8');
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      process.stderr.write(`emailmd: cannot read file '${file}': ${detail}\n`);
      process.exitCode = 1;
      return;
    }
  } else if (!process.stdin.isTTY) {
    markdown = await readStdin();
  } else {
    process.stderr.write(`emailmd: no input provided\nRun 'emailmd --help' for usage.\n`);
    process.exitCode = 1;
    return;
  }

  const minify = values.minify === true;
  const beautify = values.beautify === true;
  const text = values.text === true;
  const outputPath = typeof values.output === 'string' ? values.output : undefined;

  if (isLint) {
    const findings = await lint(markdown, { partials });
    if (findings.length === 0) {
      process.stdout.write('No problems found.\n');
      return;
    }
    const lineWidth = Math.max(...findings.map((f) => String(f.line ?? '').length), 1);
    for (const f of findings) {
      const line = String(f.line ?? '-').padStart(lineWidth);
      process.stdout.write(`  ${line}  ${f.severity.padEnd(10)}  ${f.message}  (${f.rule})\n`);
    }
    const warningCount = findings.filter((f: LintFinding) => f.severity === 'warning').length;
    const suggestionCount = findings.length - warningCount;
    process.stdout.write(`\n${findings.length} problem${findings.length === 1 ? '' : 's'} (${warningCount} warning${warningCount === 1 ? '' : 's'}, ${suggestionCount} suggestion${suggestionCount === 1 ? '' : 's'})\n`);
    if (warningCount > 0 || (values.strict === true && findings.length > 0)) {
      process.exitCode = 1;
    }
    return;
  }

  const result = await render(markdown, { minify, beautify, partials });
  const output = text ? result.text : result.html;

  if (outputPath) {
    try {
      writeFileSync(outputPath, output);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      process.stderr.write(`emailmd: cannot write to '${outputPath}': ${detail}\n`);
      process.exitCode = 1;
      return;
    }
  } else {
    process.stdout.write(output);
    if (output.length > 0 && !output.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
}

main().catch((err: unknown) => {
  const detail = err instanceof Error ? err.message : String(err);
  process.stderr.write(`emailmd: ${detail}\n`);
  process.exit(1);
});
