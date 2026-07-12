import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import taskLists from 'markdown-it-task-lists';
import { full as emoji } from 'markdown-it-emoji';
import deflist from 'markdown-it-deflist';
import mark from 'markdown-it-mark';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import { registerDirectives } from './directives/index.js';
import { highlightCode } from './highlight.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: highlightCode,
});
md.use(attrs);
md.use(taskLists);
md.use(emoji);
md.use(deflist);
md.use(mark);
md.use(sub);
md.use(sup);
registerDirectives(md);

// User-authored HTML comments that mimic internal segmentation markers
// (<!--EMAILMD:...-->) could confuse the segmenter, since `html: true`
// passes comments through verbatim. EMAILMD: is our reserved namespace, so
// drop such comments — including any attacker-controlled payload inside.
// Code spans and fences are untouched — markdown-it entity-escapes those.
md.core.ruler.push('neutralize_internal_markers', (state) => {
  const neutralize = (s: string) => s.replace(/<!--EMAILMD:[\s\S]*?(?:-->|$)/g, '');
  for (const token of state.tokens) {
    if (token.type === 'html_block') {
      token.content = neutralize(token.content);
    } else if (token.type === 'inline' && token.children) {
      for (const child of token.children) {
        if (child.type === 'html_inline') {
          child.content = neutralize(child.content);
        }
      }
    }
  }
  return true;
});

// Matches template tags that should pass through markdown-it untouched.
// Matches template tags that could break markdown-it link/URL parsing.
// Excludes ERB/EJS (<% %>) since markdown-it HTML-encodes those safely.
//
// Note: this shielding protects tags from *markdown-it's* linkify/URL parsing,
// which runs before MJML ever sees the document. MJML 5's `templateSyntax`
// option (set in mjml.ts) protects `{{ }}` from MJML's PostCSS pass. The two
// layers are complementary — both are needed to preserve `[text]({{ url }})`
// end-to-end through the pipeline.
const TEMPLATE_TAG_RE = /(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\$\{[\s\S]*?\}|%%[\s\S]*?%%)/g;

function shieldTemplateTags(input: string): { text: string; tags: string[]; prefix: string } {
  // Pick a placeholder prefix that does not occur in the source, so a literal
  // "EMAILMDTPL0ENDTPL" typed by the user can never be mistaken for (or
  // cross-substituted with) a shielded template tag.
  let prefix = 'EMAILMDTPL';
  while (input.includes(prefix)) prefix += 'X';

  const tags: string[] = [];
  const text = input.replace(TEMPLATE_TAG_RE, (match) => {
    const idx = tags.length;
    tags.push(match);
    return `${prefix}${idx}ENDTPL`;
  });
  return { text, tags, prefix };
}

function restoreTemplateTags(html: string, tags: string[], prefix: string): string {
  if (tags.length === 0) return html;
  const re = new RegExp(`${prefix}(\\d+)ENDTPL`, 'g');
  return html.replace(re, (_, idx) => tags[parseInt(idx, 10)] ?? _);
}

export interface ParseOptions {
  /** Render single newlines as `<br>` (markdown-it `breaks` mode). Default: `false`. */
  breaks?: boolean;
  /**
   * Allow raw HTML in the Markdown source (markdown-it `html` mode). Default: `true`.
   * When `false`, raw tags are escaped to text instead of passed through — see the note
   * on {@link RenderOptions.html}.
   */
  html?: boolean;
}

export function parseMarkdown(markdown: string, options?: ParseOptions): string {
  // The instance is a module-level singleton, so set the options every call
  // rather than only when enabled.
  md.set({ breaks: options?.breaks ?? false, html: options?.html ?? true });
  const { text: shielded, tags, prefix } = shieldTemplateTags(markdown);
  let html = md.render(shielded);
  html = restoreTemplateTags(html, tags, prefix);

  // Replace <input> checkboxes with Unicode characters for email safety
  // (email clients strip <input> elements)
  html = html.replace(
    /<input class="task-list-item-checkbox" checked="" disabled="" type="checkbox">/g,
    '\u2611 ',
  );
  html = html.replace(
    /<input class="task-list-item-checkbox" disabled="" type="checkbox">/g,
    '\u2610 ',
  );

  return html;
}
