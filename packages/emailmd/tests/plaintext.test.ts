import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

describe('plain text output', async () => {
  it('returns text property on render result', async () => {
    const { text } = await render('# Hello\n\nWorld.');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('converts headings to uppercase', async () => {
    const { text } = await render('# Welcome Back');
    expect(text).toContain('WELCOME BACK');
  });

  it('preserves Handlebars/Mustache token case in headings', async () => {
    const { text } = await render('# Hello {{user_name}}');
    expect(text).toContain('HELLO {{user_name}}');
    expect(text).not.toContain('{{USER_NAME}}');
  });

  it('preserves ERB/EJS token case in headings', async () => {
    const { text } = await render('# Order <%= order_id %>');
    expect(text).toContain('ORDER');
    expect(text).toContain('order_id');
    expect(text).not.toContain('ORDER_ID');
  });

  it('preserves double-percent tokens in headings', async () => {
    const { text } = await render('# Status: %%account_status%%');
    expect(text).toContain('STATUS: %%account_status%%');
  });

  it('preserves multiple tokens in a single heading', async () => {
    const { text } = await render('# {{greeting}}, {{user_name}}!');
    expect(text).toContain('{{greeting}}');
    expect(text).toContain('{{user_name}}');
  });

  it('decodes entities in uppercased headings', async () => {
    const { text } = await render('# Q&A: "Tips" for 5 < 6');
    expect(text).toContain('Q&A: "TIPS" FOR 5 < 6');
  });

  it('pads table columns by decoded width', async () => {
    const { text } = await render('| A & B | C |\n|---|---|\n| x | 1 |');
    expect(text).toContain('A & B   C\n-----   -\nx       1');
  });

  it('decodes numeric and named entities from raw HTML', async () => {
    const { text } = await render('<img src="https://x.com/a.png" alt="Grid &#183; one &middot; two">');
    expect(text).toContain('[Image: Grid · one · two]');
  });

  it('decodes entities only once', async () => {
    const { text } = await render('Write &amp;lt; for a less-than sign');
    expect(text).toContain('Write &lt; for');
  });

  it('leaves bare ampersands in URLs alone', async () => {
    const { text } = await render('See https://x.com/?a=1&copy=2');
    expect(text).toContain('https://x.com/?a=1&copy=2');
  });

  it('skips elements hidden with display:none', async () => {
    const md = [
      '<img src="https://x.com/a.png" alt="Grid">',
      '<div style="display:none;mso-hide:all"><img src="https://x.com/a.png" alt="Grid"><div>phone</div></div>',
      '',
      'After',
    ].join('\n');
    const { text } = await render(md);
    expect(text.match(/\[Image: Grid\]/g)).toHaveLength(1);
    expect(text).not.toContain('phone');
    expect(text).toContain('After');
  });

  it('keeps a caption set on an image link', async () => {
    const { text } = await render('[![Shop](https://x.com/s.png)](https://x.com/shop){caption="Shop now"}');
    expect(text).toContain('[Image: Shop] (https://x.com/shop)\nShop now');
  });

  it('preserves paragraph content', async () => {
    const { text } = await render('This is a paragraph.');
    expect(text).toContain('This is a paragraph.');
  });

  it('converts links to text (url) format', async () => {
    const { text } = await render('Visit [our site](https://example.com) for more.');
    expect(text).toContain('our site (https://example.com)');
  });

  it('converts buttons to label: url format', async () => {
    const { text } = await render('[Get Started](https://example.com/start){button}');
    expect(text).toContain('Get Started: https://example.com/start');
  });

  it('converts secondary buttons to label: url format', async () => {
    const { text } = await render('[Learn More](https://example.com/more){button.secondary}');
    expect(text).toContain('Learn More: https://example.com/more');
  });

  it('strips directive wrappers but preserves inner text', async () => {
    const { text } = await render('::: callout\nImportant notice here.\n:::');
    expect(text).toContain('Important notice here.');
    expect(text).not.toContain('callout');
    expect(text).not.toContain('EMAILMD');
  });

  it('preserves highlight directive content', async () => {
    const { text } = await render('::: highlight\nSpecial offer!\n:::');
    expect(text).toContain('Special offer!');
  });

  it('preserves centered directive content', async () => {
    const { text } = await render('::: centered\nThank you.\n:::');
    expect(text).toContain('Thank you.');
  });

  it('converts images to [Image: alt] format', async () => {
    const { text } = await render('![Logo](https://example.com/logo.png)');
    expect(text).toContain('[Image: Logo]');
  });

  it('preserves unordered list formatting', async () => {
    const { text } = await render('- First item\n- Second item\n- Third item');
    expect(text).toContain('- First item');
    expect(text).toContain('- Second item');
    expect(text).toContain('- Third item');
  });

  it('preserves ordered list formatting', async () => {
    const { text } = await render('1. Step one\n2. Step two\n3. Step three');
    expect(text).toContain('1. Step one');
    expect(text).toContain('2. Step two');
    expect(text).toContain('3. Step three');
  });

  it('converts nested unordered lists with indentation', async () => {
    const { text } = await render('- Item one\n- Item two\n  - Nested one\n  - Nested two\n- Item three');
    expect(text).toContain('- Item one');
    expect(text).toContain('- Item two');
    expect(text).toContain('  - Nested one');
    expect(text).toContain('  - Nested two');
    expect(text).toContain('- Item three');
  });

  it('converts nested ordered lists with independent numbering', async () => {
    const { text } = await render('1. First\n2. Second\n   1. Sub one\n   2. Sub two\n3. Third');
    expect(text).toContain('1. First');
    expect(text).toContain('2. Second');
    expect(text).toContain('  1. Sub one');
    expect(text).toContain('  2. Sub two');
    expect(text).toContain('3. Third');
  });

  it('converts mixed nested lists (ol inside ul)', async () => {
    const { text } = await render('- Item A\n- Item B\n  1. Numbered one\n  2. Numbered two\n- Item C');
    expect(text).toContain('- Item A');
    expect(text).toContain('- Item B');
    expect(text).toContain('  1. Numbered one');
    expect(text).toContain('  2. Numbered two');
    expect(text).toContain('- Item C');
  });

  it('converts mixed nested lists (ul inside ol)', async () => {
    const { text } = await render('1. First\n2. Second\n   - Sub A\n   - Sub B\n3. Third');
    expect(text).toContain('1. First');
    expect(text).toContain('2. Second');
    expect(text).toContain('  - Sub A');
    expect(text).toContain('  - Sub B');
    expect(text).toContain('3. Third');
  });

  it('handles deeply nested lists (3 levels)', async () => {
    const { text } = await render('- Level 1\n  - Level 2\n    - Level 3');
    expect(text).toContain('- Level 1');
    expect(text).toContain('  - Level 2');
    expect(text).toContain('    - Level 3');
  });

  it('contains no HTML tags in nested list output', async () => {
    const { text } = await render('- Item\n  - Nested\n    - Deep');
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('converts blockquotes', async () => {
    const { text } = await render('> This is a quote');
    expect(text).toContain('> This is a quote');
  });

  it('converts multi-line blockquotes', async () => {
    const { text } = await render('> Line one\n> Line two');
    expect(text).toContain('> Line one');
    expect(text).toContain('> Line two');
  });

  it('converts nested blockquotes with double prefix', async () => {
    const { text } = await render('> Outer\n>\n> > Inner');
    expect(text).toContain('> Outer');
    expect(text).toMatch(/> > Inner/);
  });

  it('does not leave dangling blockquote tags for nested quotes', async () => {
    const { text } = await render('> Outer\n>\n> > Inner');
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('converts horizontal rules', async () => {
    const { text } = await render('Above\n\n***\n\nBelow');
    expect(text).toContain('---');
    expect(text).toContain('Above');
    expect(text).toContain('Below');
  });

  it('strips bold/italic markup from text output', async () => {
    const { text } = await render('**bold** and *italic*');
    expect(text).toContain('bold');
    expect(text).toContain('italic');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('<em>');
  });

  it('converts inline code to backtick-wrapped text', async () => {
    const { text } = await render('Use the `render()` function.');
    expect(text).toContain('`render()`');
    expect(text).not.toContain('<code>');
  });

  it('converts fenced code blocks to indented text', async () => {
    const { text } = await render('Example:\n\n```\nconst x = 1;\nconsole.log(x);\n```');
    expect(text).toContain('    const x = 1;');
    expect(text).toContain('    console.log(x);');
    expect(text).not.toContain('<pre>');
    expect(text).not.toContain('<code>');
  });

  it('preserves HTML entities in code block plain text', async () => {
    const { text } = await render('Example:\n\n```\n<div class="foo">\n```');
    expect(text).toContain('    <div class="foo">');
  });

  it('handles code blocks alongside other content', async () => {
    const { text } = await render('# Example\n\nHere is code:\n\n```\nfoo()\n```\n\nAnd more text.');
    expect(text).toContain('EXAMPLE');
    expect(text).toContain('Here is code:');
    expect(text).toContain('    foo()');
    expect(text).toContain('And more text.');
  });

  it('contains no HTML tags', async () => {
    const { text } = await render('# Hello\n\n**Bold** text with a [link](https://example.com).\n\n::: callout\nA callout\n:::');
    expect(text).not.toMatch(/<[^>]+>/);
  });
});

describe('render result meta', async () => {
  it('returns frontmatter values in meta', async () => {
    const md = `---
preheader: Preview text
custom_key: custom_value
---

# Hello`;
    const { meta } = await render(md);
    expect(meta.preheader).toBe('Preview text');
    expect(meta.custom_key).toBe('custom_value');
  });

  it('returns empty meta when no frontmatter', async () => {
    const { meta } = await render('# Hello');
    expect(meta).toEqual({});
  });

  it('preserves footer directive content in plain text', async () => {
    const { text } = await render('# Hello\n\n::: footer\n**Acme Corp**\n:::');
    expect(text).toContain('Acme Corp');
    expect(text).not.toContain('EMAILMD');
  });
});
