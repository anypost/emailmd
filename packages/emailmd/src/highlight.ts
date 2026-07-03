import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

/**
 * Syntax highlighting for fenced code blocks, powered by highlight.js core
 * with a curated grammar set (each grammar registers its own aliases: `js`,
 * `jsx`, `ts`, `sh`, `html`, `yml`, …). Highlighting emits `hljs-*` classed
 * spans; the token colors live in the head CSS built by mjml.ts, so they are
 * theme-aware and get dark-mode overrides like every other element.
 */

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('php', php);
hljs.registerLanguage('python', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

/**
 * Highlight a fenced code block. Returns hljs-classed, HTML-escaped markup,
 * or the empty string for unknown/absent languages — markdown-it then falls
 * back to its own plain escaping, so an unrecognized fence renders exactly
 * as it does today.
 */
export function highlightCode(code: string, lang: string): string {
  if (!lang || !hljs.getLanguage(lang)) return '';
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}
