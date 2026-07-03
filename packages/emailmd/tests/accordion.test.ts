import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const FAQ = `::: accordion
### How do I reset my password?
Click **Forgot password** on the sign-in page.

### Where is my order?
Check the tracking link in your confirmation email.
:::`;

describe('accordion directive', async () => {
  it('renders each heading as a collapsible panel title', async () => {
    const { html, warnings } = await render(FAQ);
    expect(warnings).toBeUndefined();
    expect(html).toContain('How do I reset my password?');
    expect(html).toContain('Where is my order?');
    // Titles are not rendered as headings inside the accordion
    expect(html).not.toMatch(/<h3[^>]*>How do I reset/);
  });

  it('emits the interactive checkbox markup', async () => {
    const { html } = await render(FAQ);
    expect(html).toContain('mj-accordion-checkbox');
    expect(html).toContain('type="checkbox"');
  });

  it('keeps panel content with inline formatting', async () => {
    const { html } = await render(FAQ);
    expect(html).toContain('<strong>Forgot password</strong>');
    expect(html).toContain('tracking link');
  });

  it('renders intro text before the first heading above the accordion', async () => {
    const md = `::: accordion
Answers to common questions:

### One?
Yes.
:::`;
    const { html } = await render(md);
    const introIdx = html.indexOf('Answers to common questions');
    const panelIdx = html.indexOf('One?');
    expect(introIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeGreaterThan(introIdx);
  });

  it('degrades to regular text with a warning when there are no headings', async () => {
    const md = `::: accordion
Just a paragraph, no headings.
:::`;
    const { html, warnings } = await render(md);
    expect(html).toContain('Just a paragraph, no headings.');
    expect(html).not.toContain('mj-accordion-title');
    expect(warnings?.some((w) => w.message.includes('Accordion'))).toBe(true);
  });

  it('accepts custom icon URLs and rejects unsafe ones', async () => {
    const md = `::: accordion icon-wrapped=https://example.com/plus.png icon-unwrapped=https://example.com/minus.png
### Q?
A.
:::`;
    const { html } = await render(md);
    expect(html).toContain('https://example.com/plus.png');
    expect(html).toContain('https://example.com/minus.png');

    const bad = `::: accordion icon-wrapped=javascript:alert(1)
### Q?
A.
:::`;
    const result = await render(bad);
    expect(result.html).not.toContain('javascript:alert');
    expect(result.warnings?.some((w) => w.message.includes('icon-wrapped'))).toBe(true);
  });

  it('strips inline tags from titles', async () => {
    const md = `::: accordion
### A **bold** question?
Answer.
:::`;
    const { html } = await render(md);
    expect(html).toContain('A bold question?');
  });

  it('contains no markers or mj- tags in the output', async () => {
    const { html } = await render(FAQ);
    expect(html).not.toContain('EMAILMD:');
    expect(html).not.toMatch(/<mj-/);
  });

  it('flattens to headings and content in plain text', async () => {
    const { text } = await render(FAQ);
    expect(text).toContain('HOW DO I RESET MY PASSWORD?');
    expect(text).toContain('Forgot password');
    expect(text).not.toContain('EMAILMD');
  });

  it('includes dark-mode overrides for accordion colors when theme is auto', async () => {
    const md = `---
theme: auto
---

${FAQ}`;
    const { html } = await render(md);
    expect(html).toContain('.emd-acc');
  });
});
