import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { render } from './index.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
);

const HELP = `
emailmd v${version} — Render markdown into email-safe HTML

Usage:
  emailmd [file] [options]

Arguments:
  file              Markdown file to render (reads stdin if omitted)

Options:
  -o, --output <f>  Write output to file instead of stdout
  -t, --text        Output plain text instead of HTML
  -m, --minify      Minify the HTML output
  -b, --beautify    Pretty-print the HTML output (ignored with --minify)
  -p, --partials <path>  Partials for "::: include <name>" — a directory of
                    .md files (subdirectories become name prefixes:
                    blocks/legal) or a single .md file. Repeatable;
                    later paths win on name collisions.
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

  if (positionals.length > 1) {
    process.stderr.write(`emailmd: expected at most one positional argument, got ${positionals.length}\nRun 'emailmd --help' for usage.\n`);
    process.exitCode = 1;
    return;
  }

  let markdown: string;

  if (positionals.length === 1) {
    const file = positionals[0];
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

  let partials: Record<string, string> | undefined;
  if (Array.isArray(values.partials)) {
    partials = {};
    for (const path of values.partials) {
      try {
        Object.assign(partials, loadPartialsPath(path));
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        process.stderr.write(`emailmd: cannot read partials path '${path}': ${detail}\n`);
        process.exitCode = 1;
        return;
      }
    }
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
