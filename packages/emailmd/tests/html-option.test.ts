import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

/**
 * The `html` render option. Default `true` passes raw HTML through; `false`
 * escapes raw HTML so a document from an untrusted source cannot inject markup
 * or script into the email.
 */

/** True when the rendered body contains a genuinely live tag or event handler. */
function hasLiveHtml(html: string): boolean {
  const body = html.split('<body')[1] ?? html;
  return (
    /<(script|svg|iframe|object|embed|style|form|link|meta|base)\b/i.test(body) ||
    /<[a-z][^>]*\son[a-z]+\s*=/i.test(body)
  );
}

describe('html option: default (true)', () => {
  it('passes raw inline HTML through, unchanged', async () => {
    const { html } = await render('This is <span style="color:red">red</span>.');
    expect(html).toContain('<span style="color:red">red</span>');
  });

  it('passes a raw block through', async () => {
    const { html } = await render('Before\n\n<div style="text-align:center">Mid</div>\n\nAfter');
    expect(html).toContain('<div style="text-align:center">Mid</div>');
  });

  it('is the behaviour when html is set explicitly to true', async () => {
    const { html } = await render('<u>underline</u>', { allowHtml: true });
    expect(html).toContain('<u>underline</u>');
  });
});

describe('html option: false escapes raw HTML', () => {
  const vectors: Record<string, string> = {
    script: '<script>alert(document.cookie)</script>',
    imageOnerror: '<img src=x onerror=alert(1)>',
    svgOnload: '<svg onload=alert(1)></svg>',
    iframe: '<iframe src="https://evil.example"></iframe>',
    styleBlock: '<style>*{background:url(https://evil.example)}</style>',
    inlineEvent: 'hi <b onclick=alert(1)>x</b>',
    blockDiv: 'Before\n\n<div onclick=alert(1)>x</div>\n\nAfter',
    unclosedTag: 'text <img src=x onerror=alert(1)',
  };

  for (const [name, source] of Object.entries(vectors)) {
    it(`neutralizes: ${name}`, async () => {
      const { html } = await render(source, { allowHtml: false });
      expect(hasLiveHtml(html), html).toBe(false);
    });
  }

  it('escapes to visible text rather than dropping the content', async () => {
    const { html } = await render('<script>alert(1)</script>', { allowHtml: false });
    expect(html).toContain('&lt;script&gt;');
  });

  it('neutralizes a forged internal marker comment', async () => {
    const { html } = await render('<!--EMAILMD:btn0-->', { allowHtml: false });
    expect(hasLiveHtml(html)).toBe(false);
    expect(html).not.toContain('<!--EMAILMD:');
  });
});

describe('html option: false neutralizes {attr=…} injection', () => {
  // The `{key=value}` (markdown-it-attrs) syntax attaches attributes to the
  // generated element without going through markdown-it's raw-HTML lexer, so it
  // is a second injection path that `allowHtml: false` must also close.
  const vectors: Record<string, string> = {
    handlerOnHeading: '# Hi {onmouseover=alert(1)}',
    handlerOnLink: '[click me](https://ok.example){onclick=alert(1)}',
    handlerOnEmphasis: 'hi *x*{onmouseover=alert(1)}',
    styleOnEmphasis: 'text *em*{style="background:url(https://evil.example)"}',
  };

  for (const [name, source] of Object.entries(vectors)) {
    it(`strips the sink: ${name}`, async () => {
      const { html } = await render(source, { allowHtml: false });
      expect(hasLiveHtml(html), html).toBe(false);
    });
  }

  it('strips a javascript: href override while keeping the safe href', async () => {
    const { html } = await render('[x](https://ok.example){href="javascript:alert(1)"}', {
      allowHtml: false,
    });
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toMatch(/href="https:\/\/ok\.example"/);
  });

  it('keeps benign attributes (class, id, data-*)', async () => {
    const { html } = await render('text *em*{.fancy #lead data-track=1}', { allowHtml: false });
    expect(html).toMatch(/<em[^>]*class="fancy"/);
    expect(html).toMatch(/<em[^>]*id="lead"/);
    expect(html).toMatch(/<em[^>]*data-track="1"/);
  });

  it('leaves {attr=…} injection alone in the default (trusted) mode', async () => {
    // Tightening is opt-in — trusted templates keep their current behaviour.
    const { html } = await render('# Hi {onmouseover=alert(1)}', { allowHtml: true });
    expect(html).toMatch(/<h1[^>]*onmouseover=/);
  });
});

describe('html option: false neutralizes raw HTML inside template tags', () => {
  const vectors: Record<string, string> = {
    scriptInBraces: 'hello {{<script>alert(1)</script>}} world',
    imgInDollar: 'a ${<img src=x onerror=alert(1)>} b',
    svgInPercent: 'x %%<svg onload=alert(1)>%% y',
  };

  for (const [name, source] of Object.entries(vectors)) {
    it(`escapes it: ${name}`, async () => {
      const { html } = await render(source, { allowHtml: false });
      expect(hasLiveHtml(html), html).toBe(false);
    });
  }

  it('leaves a legitimate template variable untouched', async () => {
    const { html } = await render('Hello [profile]({{ profile_url }})', { allowHtml: false });
    expect(html).toMatch(/href="\{\{ profile_url \}\}"/);
  });

  it('passes raw HTML in template tags through in the default (trusted) mode', async () => {
    const { html } = await render('hello {{<script>alert(1)</script>}} world', { allowHtml: true });
    expect(hasLiveHtml(html)).toBe(true);
  });
});

describe('html option: false preserves every Markdown feature', () => {
  it('keeps headings, emphasis, links, lists, quotes and tables', async () => {
    const { html } = await render(
      '# Heading\n\n**bold** *italic* `code` [link](https://ok.example)\n\n> quote\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |',
      { allowHtml: false },
    );
    expect(html).toMatch(/<h1[^>]*>Heading/);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toMatch(/href="https:\/\/ok\.example"/);
    expect(html).toMatch(/<blockquote/);
    expect(html).toMatch(/<li[^>]*>a/);
    expect(html).toMatch(/<table/);
  });

  it('keeps directives, buttons and Markdown images', async () => {
    const { html } = await render(
      '![logo](https://cdn.example/logo.png)\n\n::: callout\nCallout body\n:::\n\n[Go](https://e.example){button}',
      { allowHtml: false },
    );
    expect(html).toMatch(/<img[^>]+src="https:\/\/cdn\.example\/logo\.png"/);
    expect(html).toContain('Callout body');
    expect(html).toContain('Go');
  });

  it('still blocks javascript: URLs in Markdown links (unchanged from default)', async () => {
    const { html } = await render('[click](javascript:alert(1))', { allowHtml: false });
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it('produces sensible plain text (raw HTML is inert literal text there)', async () => {
    // The text/plain part is never executed by a mail client, so escaped tags
    // simply appear as the literal characters the author typed.
    const { text } = await render('# Hi\n\nthanks', { allowHtml: false });
    expect(text.toLowerCase()).toContain('hi');
    expect(text).toContain('thanks');
  });
});
