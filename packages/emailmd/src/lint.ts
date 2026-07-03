import MarkdownIt from 'markdown-it';
import { extractFrontmatter } from './frontmatter.js';
import { render } from './index.js';

/**
 * Static quality checks for an email document. Unlike render warnings (which
 * report things emailmd had to repair or drop), lint findings flag content
 * that renders fine but is likely to hurt deliverability, accessibility, or
 * how the email reads in the inbox.
 */

/** A single issue reported by {@link lint}. */
export interface LintFinding {
  /** Machine-readable rule id, e.g. `image-alt` or `gmail-clip`. */
  rule: string;
  /** `warning` = likely a real problem; `suggestion` = advisory. */
  severity: 'warning' | 'suggestion';
  /** Human-readable message. */
  message: string;
  /** 1-based line in the source markdown, when the finding maps to one. */
  line?: number;
}

/** Options for {@link lint}. */
export interface LintOptions {
  /** Partials map, so included content is measured and rendered like in {@link render}. */
  partials?: Record<string, string>;
}

/** Gmail clips messages whose HTML exceeds ~102KB. */
const GMAIL_CLIP_BYTES = 102 * 1024;

/** Inbox preview text is typically truncated around 90–100 characters. */
const PREHEADER_MAX = 100;

const GENERIC_LINK_TEXT = new Set(['click here', 'here', 'this', 'link']);

const SPAM_PHRASES = [
  'act now',
  'buy now',
  'order now',
  'limited time offer',
  'risk-free',
  '100% free',
  'earn extra cash',
  'no obligation',
  'this is not spam',
  'dear friend',
  'double your',
  'get paid',
];

/** Opening delimiters of pass-through template tokens — URLs containing them are the app's responsibility. */
const TEMPLATE_DELIMITERS = ['{{', '{%', '${', '%%', '[['];

// Bare instance (no directive/attr plugins): lint only needs links, images,
// and line maps, and must not share state with the render parser.
const md = new MarkdownIt({ html: true, linkify: true });

function hasTemplateToken(url: string): boolean {
  return TEMPLATE_DELIMITERS.some((d) => url.includes(d));
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/**
 * Lint a markdown email for deliverability, accessibility, and readability
 * problems. Rendering still succeeds regardless of findings — this is advice,
 * not validation. Render warnings are folded in under the `render` rule so a
 * single call surfaces everything.
 */
export async function lint(markdown: string, options?: LintOptions): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];

  const { meta, content } = extractFrontmatter(markdown);
  // Token line numbers are relative to the frontmatter-stripped content.
  const contentStart = markdown.indexOf(content);
  const lineOffset = contentStart > 0 ? markdown.slice(0, contentStart).split('\n').length - 1 : 0;

  // --- Token-based checks (accurate source lines) ---
  const tokens = md.parse(content, {});
  for (const token of tokens) {
    if (token.type !== 'inline' || !token.children) continue;
    const line = (token.map?.[0] ?? 0) + 1 + lineOffset;

    for (let i = 0; i < token.children.length; i++) {
      const child = token.children[i];

      if (child.type === 'image') {
        const src = child.attrGet('src') ?? '';
        if (!child.content.trim()) {
          findings.push({
            rule: 'image-alt',
            severity: 'warning',
            message: 'Image is missing alt text — screen readers and blocked-image clients show nothing.',
            line,
          });
        }
        if (src.startsWith('http://') && !hasTemplateToken(src)) {
          findings.push({
            rule: 'insecure-link',
            severity: 'warning',
            message: `Image loads over http:// — many clients block or warn on mixed content (${src}).`,
            line,
          });
        }
      }

      if (child.type === 'link_open') {
        const href = child.attrGet('href') ?? '';
        if (href.startsWith('http://') && !hasTemplateToken(href)) {
          findings.push({
            rule: 'insecure-link',
            severity: 'warning',
            message: `Link uses http:// — use https:// (${href}).`,
            line,
          });
        }
        let text = '';
        for (let j = i + 1; j < token.children.length && token.children[j].type !== 'link_close'; j++) {
          if (token.children[j].type === 'text') text += token.children[j].content;
        }
        if (GENERIC_LINK_TEXT.has(text.trim().toLowerCase())) {
          findings.push({
            rule: 'link-text',
            severity: 'suggestion',
            message: `Link text "${text.trim()}" says nothing out of context — describe the destination instead.`,
            line,
          });
        }
      }
    }
  }

  // --- Frontmatter checks ---
  if (typeof meta.preheader === 'string' && meta.preheader.length > PREHEADER_MAX) {
    findings.push({
      rule: 'preheader-length',
      severity: 'suggestion',
      message: `Preheader is ${meta.preheader.length} characters — inbox previews truncate around ${PREHEADER_MAX}.`,
    });
  } else if (meta.preheader === undefined) {
    findings.push({
      rule: 'preheader-missing',
      severity: 'suggestion',
      message: 'No preheader set — without one, inboxes preview the first body text.',
    });
  }

  // --- Spam-phrase heuristics ---
  const lowered = content.toLowerCase();
  for (const phrase of SPAM_PHRASES) {
    const idx = lowered.indexOf(phrase);
    if (idx !== -1) {
      findings.push({
        rule: 'spam-words',
        severity: 'suggestion',
        message: `"${phrase}" is a common spam-filter trigger.`,
        line: lineOf(content, idx) + lineOffset,
      });
    }
  }

  // --- Render-based checks (size, unsubscribe, folded render warnings) ---
  const result = await render(markdown, { minify: true, partials: options?.partials });
  for (const w of result.warnings ?? []) {
    findings.push({ rule: 'render', severity: 'warning', message: w.message });
  }
  const bytes = new TextEncoder().encode(result.html).length;
  if (bytes > GMAIL_CLIP_BYTES) {
    findings.push({
      rule: 'gmail-clip',
      severity: 'warning',
      message: `Minified HTML is ${Math.round(bytes / 1024)}KB — Gmail clips messages over 102KB.`,
    });
  }
  if (!/unsub/i.test(result.html)) {
    findings.push({
      rule: 'unsubscribe',
      severity: 'suggestion',
      message: 'No unsubscribe link found — marketing email should always include one.',
    });
  }

  return findings.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
}
