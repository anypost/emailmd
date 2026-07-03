import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

describe('render', async () => {
  it('produces a complete HTML document', async () => {
    const { html } = await render('# Hello');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html');
    expect(html).toContain('<body');
  });

  it('renders a heading in an h1 tag', async () => {
    const { html } = await render('# Hello');
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('renders bold text', async () => {
    const { html } = await render('**bold**');
    expect(html).toMatch(/<strong>bold<\/strong>|<b>bold<\/b>/);
  });

  it('applies theme defaults when no theme is passed', async () => {
    const { html } = await render('Hello');
    expect(html).toContain('#71717a'); // default bodyColor
  });

  it('renders with frontmatter overrides', async () => {
    const md = `---
button_color: "#FF0000"
---

# Test`;
    const { html } = await render(md);
    expect(html).toContain('<h1>Test</h1>');
    expect(html).not.toContain('button_color');
  });

  it('renders with frontmatter preheader', async () => {
    const md = `---
preheader: Don't miss our biggest announcement
---

# Hello`;
    const { html } = await render(md);
    // The preheader is HTML-escaped on output, so the apostrophe becomes an entity.
    expect(html).toContain('Don&#39;t miss our biggest announcement');
  });

  it('contains no MJML tags in output', async () => {
    const { html } = await render('# Hello\n\nA paragraph.');
    expect(html).not.toMatch(/<mj-/);
  });

  it('strips frontmatter from output', async () => {
    const md = `---
preheader: Preview text
---

Hello`;
    const { html } = await render(md);
    expect(html).not.toContain('preheader:');
    expect(html).toContain('Hello');
  });

  it('returns html, text, and meta', async () => {
    const result = await render('# Hello\n\nWorld.');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('meta');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(typeof result.meta).toBe('object');
  });

  it('renders a horizontal rule as a divider', async () => {
    const { html } = await render('Above\n\n---\n\nBelow');
    expect(html).toContain('Above');
    expect(html).toContain('Below');
    expect(html).toContain('border');
  });

  it('renders inline code with monospace font styling', async () => {
    const { html } = await render('Use the `render()` function.');
    expect(html).toContain('<code>');
    expect(html).toContain('render()');
    expect(html).toContain('monospace');
  });

  it('renders fenced code blocks', async () => {
    const { html } = await render('```\nconst x = 1;\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('const x = 1;');
  });

  it('renders fenced code blocks with language class and highlighting', async () => {
    const { html } = await render('```typescript\nconst x: number = 1;\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('language-typescript');
    // Highlighting splits the line into token spans; the text survives intact.
    expect(html.replace(/<[^>]+>/g, '')).toContain('const x: number = 1;');
  });

  it('renders a blockquote with left border styling', async () => {
    const { html } = await render('> This is a quote');
    expect(html).toContain('border-left');
    expect(html).toContain('This is a quote');
  });

  it('renders blockquote text using theme body color, not hardcoded gray', async () => {
    const { html } = await render('> Quote text');
    expect(html).not.toContain('#6b7280');
  });

  it('renders nested blockquotes', async () => {
    const { html } = await render('> Outer\n>\n> > Inner');
    expect(html).toContain('Outer');
    expect(html).toContain('Inner');
    expect(html).toMatch(/blockquote.*blockquote/s);
  });

  it('renders unordered list with controlled spacing', async () => {
    const { html } = await render('- Item one\n- Item two');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('padding-left');
  });

  it('renders ordered list with controlled spacing', async () => {
    const { html } = await render('1. First\n2. Second');
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
    expect(html).toContain('padding-left');
  });

  it('renders nested unordered lists', async () => {
    const { html } = await render('- Item one\n- Item two\n  - Nested one\n  - Nested two\n- Item three');
    expect(html).toContain('Item one');
    expect(html).toContain('Nested one');
    expect(html).toMatch(/<ul[^>]*>[\s\S]*<ul[^>]*>/);
  });

  it('renders nested ordered lists', async () => {
    const { html } = await render('1. First\n2. Second\n   1. Sub one\n   2. Sub two\n3. Third');
    expect(html).toContain('First');
    expect(html).toContain('Sub one');
    expect(html).toMatch(/<ol[^>]*>[\s\S]*<ol[^>]*>/);
  });

  it('renders mixed nested lists (ul inside ol)', async () => {
    const { html } = await render('1. First\n2. Second\n   - Sub A\n   - Sub B\n3. Third');
    expect(html).toContain('First');
    expect(html).toContain('Sub A');
    expect(html).toMatch(/<ol[^>]*>[\s\S]*<ul[^>]*>/);
  });

  it('renders deeply nested lists without MJML errors', async () => {
    const { html } = await render('- Level 1\n  - Level 2\n    - Level 3');
    expect(html).toContain('Level 1');
    expect(html).toContain('Level 2');
    expect(html).toContain('Level 3');
    expect(html).not.toMatch(/<mj-/);
  });

  it('renders a block image without raw img tag', async () => {
    const { html } = await render('![Banner](https://example.com/banner.png)');
    expect(html).toContain('https://example.com/banner.png');
    expect(html).not.toMatch(/<mj-/);
    expect(html).not.toContain('EMAILMD:');
  });

  it('returns extracted frontmatter in meta', async () => {
    const md = `---
preheader: Preview
---

# Hello`;
    const { meta } = await render(md);
    expect(meta.preheader).toBe('Preview');
  });
});

describe('render options', () => {
  it('minify: true produces smaller output than the default', async () => {
    const md = '# Hello world\n\nA paragraph with some text.';
    const { html: baseline } = await render(md);
    const { html: minified } = await render(md, { minify: true });
    expect(minified.length).toBeLessThan(baseline.length);
    // Minified output should have fewer newlines between tags.
    expect(minified.split('\n').length).toBeLessThan(baseline.split('\n').length);
  });

  it('fonts option injects custom <mj-font> for the given family', async () => {
    const md = '# Hello';
    const { html } = await render(md, {
      fonts: { Inter: 'https://fonts.googleapis.com/css2?family=Inter' },
    });
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter');
  });

  it('fonts map in frontmatter injects custom <mj-font>', async () => {
    const md = `---
fonts:
  Inter: "https://fonts.googleapis.com/css2?family=Inter"
  Roboto: "https://fonts.googleapis.com/css2?family=Roboto"
---
# Hello`;
    const { html } = await render(md);
    // MJML only injects <link> tags for fonts referenced in the compiled CSS.
    // Both Inter and Roboto are in the default font stack.
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(html).toContain('fonts.googleapis.com/css2?family=Roboto');
  });

  it('frontmatter fonts take precedence over options fonts on matching keys', async () => {
    const md = `---
fonts:
  Inter: "https://frontmatter.example/Inter"
---
# Hello`;
    const { html } = await render(md, {
      fonts: {
        Inter: 'https://options.example/Inter',
        Roboto: 'https://options.example/Roboto',
      },
    });
    expect(html).toContain('frontmatter.example/Inter');
    expect(html).not.toContain('options.example/Inter');
    // Non-overlapping keys from options still apply
    expect(html).toContain('options.example/Roboto');
  });

  it('beautify: true produces more structured output than the default', async () => {
    const md = '# Hello world\n\nA paragraph with some text.';
    const { html: baseline } = await render(md);
    const { html: beautified } = await render(md, { beautify: true });
    expect(beautified.split('\n').length).toBeGreaterThan(baseline.split('\n').length);
  });

  it('validationLevel: "strict" renders valid markdown without throwing', async () => {
    const md = '# Hello\n\nA paragraph.';
    const { html } = await render(md, { validationLevel: 'strict' });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Hello');
  });

  it('sanitizeStyles: true renders without throwing when combined with minify', async () => {
    const md = '# Hello\n\nA paragraph.';
    const { html } = await render(md, { minify: true, sanitizeStyles: true });
    expect(html).toContain('Hello');
  });

  it('templateSyntax accepts custom delimiters without throwing', async () => {
    const md = '# Hello\n\nA paragraph.';
    const { html } = await render(md, {
      templateSyntax: [{ prefix: '<%', suffix: '%>' }],
    });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Hello');
  });
});
