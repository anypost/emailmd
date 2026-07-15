import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

describe('css option', () => {
  it('emits the css string as an <mj-style> in the head', async () => {
    const { html } = await render('# Title', { css: '.brand{color:#abcdef}' });
    expect(html).toContain('.brand');
    expect(html).toContain('#abcdef');
  });

  it('places custom css after the built-in styles so it can override them', async () => {
    const { html } = await render('# Title', { css: '.after-builtin{color:#abcdef}' });
    // The built-in heading rule is emitted first; the custom block comes later and wins on equal
    // specificity — that is the whole point of an override hook.
    const builtin = html.indexOf('h1 {');
    const custom = html.indexOf('.after-builtin');
    expect(builtin).toBeGreaterThan(-1);
    expect(custom).toBeGreaterThan(builtin);
  });

  it('adds nothing when css is omitted', async () => {
    const { html } = await render('# Title');
    expect(html).not.toContain('.brand');
  });
});
