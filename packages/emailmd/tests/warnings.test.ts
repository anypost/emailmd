import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import type { WrapperFn } from '../src/index.js';

describe('warnings pipeline', () => {
  it('omits warnings entirely for a clean render', async () => {
    const { warnings } = await render('# Hello\n\nA paragraph.');
    expect(warnings).toBeUndefined();
  });

  it('reports frontmatter parse errors with stage "frontmatter"', async () => {
    const md = '---\npreheader: "unclosed\n---\n\n# Hello';
    const { warnings } = await render(md);
    expect(warnings?.some(w => w.stage === 'frontmatter')).toBe(true);
  });

  it('reports invalid directive values with stage "content"', async () => {
    const { warnings } = await render('::: callout bg=nope;nope\nHi\n:::');
    expect(warnings?.some(w => w.stage === 'content')).toBe(true);
  });

  it('reports invalid theme values with stage "theme"', async () => {
    const md = '---\nbrand_color: \'"><img src=x>\'\n---\n\n# Hello';
    const { warnings } = await render(md);
    expect(warnings?.some(w => w.stage === 'theme')).toBe(true);
  });

  it('reports an unknown frontmatter theme name with stage "theme"', async () => {
    const { warnings } = await render('---\ntheme: solarized\n---\n\n# Hello');
    expect(warnings?.some(w => w.stage === 'theme' && w.message.includes('solarized'))).toBe(true);
  });

  it('does not warn for valid theme names', async () => {
    for (const t of ['light', 'dark']) {
      const { warnings } = await render(`---\ntheme: ${t}\n---\n\n# Hello`);
      expect(warnings).toBeUndefined();
    }
  });

  it('surfaces MJML compilation errors with stage "mjml"', async () => {
    // mj-text directly inside mj-body is invalid MJML.
    const badWrapper: WrapperFn = () =>
      '<mjml><mj-body><mj-text>hi</mj-text></mj-body></mjml>';
    const { warnings } = await render('# Hello', { wrapper: badWrapper });
    expect(warnings?.some(w => w.stage === 'mjml')).toBe(true);
  });

  it('collects warnings from multiple stages in one render', async () => {
    const md = `---
brand_color: '"bad'
---

::: callout bg=also;bad
Hi
:::`;
    const { warnings } = await render(md);
    const stages = new Set(warnings?.map(w => w.stage));
    expect(stages.has('theme')).toBe(true);
    expect(stages.has('content')).toBe(true);
  });

  it('still renders valid html when warnings are present', async () => {
    const { html } = await render('::: callout bg=nope;nope\nHi\n:::');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Hi');
  });
});
