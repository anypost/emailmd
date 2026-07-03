import type { RenderWarning } from './warnings.js';
import { extractFrontmatter } from './frontmatter.js';

/**
 * `::: include <name> key="value" …` — splice a named partial's markdown into
 * the document before parsing.
 *
 * Partials are markdown strings supplied by the rendering app (there is no
 * filesystem access — emailmd also runs in the browser). Expansion is a
 * textual pre-parse pass, so a partial can contain anything a document can:
 * directives, buttons, images, even other includes.
 *
 * Parameters passed on the include line fill `{{key}}` placeholders inside
 * the partial. Only explicitly passed keys are substituted — every other
 * `{{token}}` is left untouched for the sending app's template layer, the
 * same pass-through contract the rest of the pipeline honors.
 */

/** Maximum include nesting depth before expansion stops with a warning. */
const MAX_DEPTH = 10;

/** An include line: up to 3 spaces of indent (4+ is a code block), then `:::`. */
const INCLUDE_RE = /^ {0,3}:{3,}\s*include(?:\s+(.*))?$/;

/** A partial name: `footer`, `blocks/legal`, `promo.v2`. */
const NAME_RE = /^[\w][\w./-]*$/;

/** Fence opener/closer: up to 3 spaces of indent, then 3+ backticks or tildes. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse `key="value with spaces"` and `key=value` pairs from an include line. */
function parseIncludeParams(rest: string): Record<string, string> {
  const params: Record<string, string> = {};
  const re = /([A-Za-z_][\w-]*)=(?:"([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    params[m[1]] = m[2] ?? m[3];
  }
  return params;
}

/**
 * Fill `{{key}}` placeholders in a partial body from include parameters.
 * Single pass over the passed keys only — substituted values are never
 * rescanned, and unknown tokens pass through for the app's template layer.
 */
function substituteParams(body: string, params: Record<string, string>): string {
  const keys = Object.keys(params);
  if (keys.length === 0) return body;
  const re = new RegExp(`\\{\\{\\s*(${keys.map(escapeRegExp).join('|')})\\s*\\}\\}`, 'g');
  return body.replace(re, (_, key: string) => params[key]);
}

/**
 * Expand `::: include` directives in a markdown document using the given map
 * of partial name → markdown. Include lines inside fenced or indented code
 * blocks are left alone. Problems (unknown names, cycles, excessive nesting)
 * never throw — the line is dropped and a warning collected instead.
 */
export function expandPartials(
  content: string,
  partials: Record<string, string>,
  warnings: RenderWarning[],
  stack: string[] = [],
): string {
  // Fast path: nothing that could be an include line.
  if (!/^ {0,3}:{3,}\s*include(?:\s|$)/m.test(content)) return content;

  const out: string[] = [];
  let fence: { char: string; len: number } | null = null;

  for (const line of content.split('\n')) {
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { char: marker[0], len: marker.length };
        out.push(line);
        continue;
      }
      if (marker[0] === fence.char && marker.length >= fence.len && fenceMatch[2].trim() === '') {
        fence = null;
        out.push(line);
        continue;
      }
    }
    if (fence) {
      out.push(line);
      continue;
    }

    const includeMatch = INCLUDE_RE.exec(line);
    if (!includeMatch) {
      out.push(line);
      continue;
    }

    const rest = (includeMatch[1] ?? '').trim();
    const name = rest.split(/\s+/)[0] ?? '';
    if (!name || !NAME_RE.test(name)) {
      warnings.push({
        stage: 'content',
        message: 'The include directive needs a partial name — e.g. "::: include footer".',
      });
      continue;
    }
    if (!(name in partials)) {
      warnings.push({
        stage: 'content',
        message: `Unknown partial "${name}" — skipping. Provide it via the "partials" render option.`,
      });
      continue;
    }
    if (stack.includes(name)) {
      warnings.push({
        stage: 'content',
        message: `Partial "${name}" includes itself (${[...stack, name].join(' → ')}) — skipping.`,
      });
      continue;
    }
    if (stack.length >= MAX_DEPTH) {
      warnings.push({
        stage: 'content',
        message: `Partials nested more than ${MAX_DEPTH} levels deep — skipping "${name}".`,
      });
      continue;
    }

    let body = partials[name];
    if (/^---\r?\n/.test(body)) {
      warnings.push({
        stage: 'content',
        message: `Partial "${name}" contains frontmatter — ignored. Frontmatter belongs on the document.`,
      });
      body = extractFrontmatter(body).content;
    }
    body = substituteParams(body, parseIncludeParams(rest.slice(name.length)));
    // Blank-line padding keeps the partial a block of its own even when the
    // author writes the include flush against surrounding text.
    out.push('', expandPartials(body, partials, warnings, [...stack, name]), '');
  }

  return out.join('\n');
}
