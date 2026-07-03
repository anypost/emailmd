import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const TS_FENCE = '```ts\nconst greeting: string = "hello";\n// a comment\n```';

describe('code block syntax highlighting', async () => {
  it('emits hljs token spans for a known language', async () => {
    const { html, warnings } = await render(TS_FENCE);
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-string');
    expect(html).toContain('hljs-comment');
    expect(warnings).toBeUndefined();
  });

  it('styles the tokens with the light palette on a light theme', async () => {
    const { html } = await render(TS_FENCE);
    expect(html).toContain('pre .hljs-keyword');
    expect(html).toContain('#cf222e');
  });

  it('uses the dark palette when the code background is dark', async () => {
    const { html } = await render(`---\ntheme: dark\n---\n\n${TS_FENCE}`);
    expect(html).toContain('#ff7b72');
    expect(html).not.toContain('#cf222e');
  });

  it('adds !important dark-mode overrides under theme: auto', async () => {
    const { html } = await render(`---\ntheme: auto\n---\n\n${TS_FENCE}`);
    expect(html).toMatch(/pre \.hljs-keyword[^{]*\{[^}]*#ff7b72 !important/);
    expect(html).toMatch(/\[data-ogsc\] pre \.hljs-keyword/);
  });

  it('leaves unknown languages as plain escaped code', async () => {
    const { html } = await render('```brainfuck\n+++[->+<]\n```');
    expect(html).not.toContain('<span class="hljs-');
    expect(html).toContain('+++[-&gt;+&lt;]');
  });

  it('leaves language-less fences untouched', async () => {
    const { html } = await render('```\nplain text here\n```');
    expect(html).not.toContain('<span class="hljs-');
    expect(html).toContain('plain text here');
  });

  it('resolves language aliases like js', async () => {
    const { html } = await render('```js\nconst x = 1;\n```');
    expect(html).toContain('hljs-keyword');
  });

  it('escapes HTML inside highlighted code', async () => {
    const { html } = await render('```js\nconst s = "<script>alert(1)</script>";\n```');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('preserves template tokens inside highlighted fences', async () => {
    const { html } = await render('```js\nconst url = "{{tracking_url}}";\n```');
    expect(html).toContain('{{tracking_url}}');
    expect(html).not.toContain('EMAILMDTPL');
  });

  it('keeps the plain text output free of highlight markup', async () => {
    const { text } = await render(TS_FENCE);
    expect(text).toContain('const greeting: string = "hello";');
    expect(text).not.toContain('hljs');
    expect(text).not.toContain('<span');
  });
});
