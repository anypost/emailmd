import { describe, it, expect } from 'vitest';
import { render, defaultTheme } from '../src/index.js';

/**
 * Hostile-input tests: values that try to break out of the attribute, CSS,
 * or markup context they are interpolated into. Rendering must never let
 * them through raw, and must keep producing a valid document.
 */
describe('injection: preheader', () => {
  it('escapes markup in the preheader', async () => {
    const md = `---
preheader: '</mj-preview><script>alert(1)</script>'
---

# Hello`;
    const { html } = await render(md);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes quotes in the preheader', async () => {
    const md = `---
preheader: 'She said "hi" & left'
---

# Hello`;
    const { html } = await render(md);
    expect(html).toContain('She said &quot;hi&quot; &amp; left');
  });
});

describe('injection: directive params', () => {
  it('rejects a CSS-breakout value in callout bg', async () => {
    const md = '::: callout bg=red;background:url(evil)\nHi\n:::';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('url(evil');
    expect(html).toContain(defaultTheme.cardColor);
    expect(warnings?.some(w => w.stage === 'content' && w.message.includes('callout bg'))).toBe(true);
  });

  it('accepts valid hex, named, and functional colors', async () => {
    for (const bg of ['#ff0000', 'tomato', 'rgb(255,0,0)']) {
      const { html, warnings } = await render(`::: callout bg=${bg}\nHi\n:::`);
      expect(html).toContain(bg);
      expect(warnings).toBeUndefined();
    }
  });

  it('rejects an invalid align value', async () => {
    const md = '::: callout align=foo\nHi\n:::';
    const { html, warnings } = await render(md);
    expect(html).toContain('align="left"');
    expect(warnings?.some(w => w.message.includes('alignment'))).toBe(true);
  });

  it('rejects an invalid border-radius', async () => {
    const md = '::: callout border-radius=8px;position:fixed\nHi\n:::';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('position:fixed');
    expect(warnings?.some(w => w.message.includes('border-radius'))).toBe(true);
  });

  it('allows template tokens in directive colors', async () => {
    const md = '::: callout bg={{brand_color}}\nHi\n:::';
    const { html, warnings } = await render(md);
    expect(html).toContain('{{brand_color}}');
    expect(warnings).toBeUndefined();
  });
});

describe('injection: hero', () => {
  it('drops a javascript: hero background URL', async () => {
    const md = '::: hero javascript:alert(1)\n# Big\n:::';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('javascript:alert');
    expect(warnings?.some(w => w.stage === 'content' && w.message.includes('hero background'))).toBe(true);
  });

  it('drops a data: hero background URL', async () => {
    const md = '::: hero data:text/html,x\n# Big\n:::';
    const { html } = await render(md);
    expect(html).not.toContain('data:text/html');
  });

  it('keeps a normal https hero URL with query params', async () => {
    const md = '::: hero https://example.com/bg.jpg?w=1200&h=600\n# Big\n:::';
    const { html, warnings } = await render(md);
    expect(html).toContain('https://example.com/bg.jpg?w=1200');
    expect(warnings).toBeUndefined();
  });

  it('rejects an invalid hero text color without styling headings', async () => {
    const md = '::: hero https://example.com/bg.jpg color=red;x:y\n# Big\n:::';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('red;x:y');
    expect(warnings?.some(w => w.message.includes('hero color'))).toBe(true);
  });
});

describe('injection: buttons', () => {
  it('does not render a javascript: link as a button', async () => {
    const md = '[Click](javascript:alert(1)){button}';
    const { html } = await render(md);
    expect(html).not.toMatch(/href="javascript:/);
  });

  it('rejects an invalid custom button color', async () => {
    const md = '[Go](https://example.com){button color="#zzz"}';
    const { html, warnings } = await render(md);
    expect(html).toContain(defaultTheme.buttonColor);
    expect(html).not.toContain('#zzz');
    expect(warnings?.some(w => w.message.includes('button'))).toBe(true);
  });

  it('rejects an invalid button border-radius', async () => {
    const md = '[Go](https://example.com){button border-radius="8px;top:0"}';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('top:0');
    expect(warnings?.some(w => w.message.includes('border-radius'))).toBe(true);
  });

  it('keeps entity-escaped quotes in link text intact', async () => {
    const md = '["Quoted" label](https://example.com){button}';
    const { html } = await render(md);
    expect(html).toContain('&quot;Quoted&quot; label');
  });
});

describe('injection: images', () => {
  it('keeps escaped quotes in alt text inside the attribute', async () => {
    const md = '![a"b](https://example.com/i.png)';
    const { html } = await render(md);
    expect(html).toContain('a&quot;b');
    expect(html).not.toMatch(/alt="a"b"/);
  });

  it('ignores an invalid image width', async () => {
    const md = '![pic](https://example.com/i.png){width="10;x"}';
    const { html, warnings } = await render(md);
    expect(html).not.toContain('10;x');
    expect(warnings?.some(w => w.message.includes('width'))).toBe(true);
  });
});

describe('injection: theme and fonts', () => {
  it('replaces a frontmatter theme value that contains markup', async () => {
    const md = `---
button_color: '#fff"><script>alert(1)</script>'
---

[Go](https://example.com){button}`;
    const { html, warnings } = await render(md);
    expect(html).not.toContain('<script>');
    expect(html).toContain(defaultTheme.buttonColor);
    expect(warnings?.some(w => w.stage === 'theme' && w.message.includes('buttonColor'))).toBe(true);
  });

  it('drops a font entry with an unsafe URL', async () => {
    const md = `---
fonts:
  Evil: javascript:alert(1)
---

# Hello`;
    const { html, warnings } = await render(md);
    expect(html).not.toContain('javascript:alert');
    expect(warnings?.some(w => w.stage === 'theme' && w.message.includes('Evil'))).toBe(true);
  });

  it('keeps a valid custom font', async () => {
    const md = `---
fonts:
  Inter: https://fonts.googleapis.com/css2?family=Inter
---

# Hello`;
    const { html, warnings } = await render(md);
    expect(html).toContain('fonts.googleapis.com');
    expect(warnings).toBeUndefined();
  });
});
