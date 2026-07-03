import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

describe('columns directive', () => {
  it('renders two equal columns side by side', async () => {
    const { html } = await render(
      ':::: columns\n::: column\nLeft cell\n:::\n::: column\nRight cell\n:::\n::::',
    );
    expect(html).toContain('Left cell');
    expect(html).toContain('Right cell');
    // MJML emits a responsive width class per column
    expect(html).toContain('mj-column-per-50');
    // Left column appears before right
    expect(html.indexOf('Left cell')).toBeLessThan(html.indexOf('Right cell'));
  });

  it('supports explicit widths (bare number = percent)', async () => {
    const { html } = await render(
      ':::: columns\n::: column 30\nNarrow\n:::\n::: column 70\nWide\n:::\n::::',
    );
    expect(html).toContain('mj-column-per-30');
    expect(html).toContain('mj-column-per-70');
  });

  it('supports width=NN%', async () => {
    const { html } = await render(
      ':::: columns\n::: column width=25%\nQuarter\n:::\n::: column width=75%\nRest\n:::\n::::',
    );
    expect(html).toContain('mj-column-per-25');
    expect(html).toContain('mj-column-per-75');
  });

  it('renders markdown inside cells', async () => {
    const { html } = await render(
      ':::: columns\n::: column\n**Bold** and [a link](https://example.com)\n:::\n::: column\nPlain\n:::\n::::',
    );
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('href="https://example.com"');
  });

  it('renders a block image inside a column as mj-image output', async () => {
    const { html } = await render(
      ':::: columns\n::: column\n![Product](https://example.com/shot.png)\n:::\n::: column\nCaption text\n:::\n::::',
    );
    expect(html).toContain('https://example.com/shot.png');
    expect(html).toContain('alt="Product"');
    // mj-image output wraps the img in a width-constrained table, not a <p>
    expect(html).not.toMatch(/<p>\s*<img[^>]*shot\.png/);
  });

  it('renders buttons inside columns with per-cell placement', async () => {
    const { html } = await render(
      ':::: columns\n::: column\nFirst\n\n[Go](https://example.com/a){button}\n:::\n::: column\nSecond\n:::\n::::',
    );
    expect(html).toContain('href="https://example.com/a"');
    // The button belongs to the first cell: it must appear before "Second"
    expect(html.indexOf('https://example.com/a')).toBeLessThan(html.indexOf('Second'));
    // Button styling applied (default buttonColor)
    expect(html).toContain('#18181b');
  });

  it('applies cell align and bg', async () => {
    const { html } = await render(
      ':::: columns\n::: column center bg=#eff6ff\nCard cell\n:::\n::: column\nPlain cell\n:::\n::::',
    );
    expect(html).toContain('Card cell');
    expect(html).toContain('#eff6ff');
    expect(html).toContain('text-align:center');
  });

  it('keeps columns side-by-side on mobile with stack=false', async () => {
    const { html } = await render(
      ':::: columns stack=false\n::: column\nA\n:::\n::: column\nB\n:::\n::::',
    );
    // Inside mj-group, columns get a fixed inline width (width:50%) instead
    // of the stacking width:100% + media-query pattern.
    expect(html).toMatch(/display:inline-block;[^"]*width:50%/);
  });

  it('stacks columns on mobile by default (inline width:100%)', async () => {
    const { html } = await render(
      ':::: columns\n::: column\nA\n:::\n::: column\nB\n:::\n::::',
    );
    expect(html).toMatch(/display:inline-block;[^"]*width:100%/);
  });

  it('treats a columns block with no column children as a single cell', async () => {
    const { html } = await render(':::: columns\nJust some content\n::::');
    expect(html).toContain('Just some content');
    expect(html).not.toContain('EMAILMD');
  });

  it('warns and drops an invalid column width', async () => {
    const { html, warnings } = await render(
      ':::: columns\n::: column width=banana\nA\n:::\n::: column\nB\n:::\n::::',
    );
    expect(html).toContain('mj-column-per-50');
    expect(warnings.some((w) => w.message.includes('Invalid width'))).toBe(true);
  });

  it('strips nested directive markers inside a cell but keeps content', async () => {
    const { html } = await render(
      ':::: columns\n::: column\n::: callout\nNested note\n:::\n:::\n::: column\nOther\n:::\n::::',
    );
    expect(html).toContain('Nested note');
    expect(html).not.toContain('EMAILMD');
  });

  it('flattens columns sequentially in plain text', async () => {
    const { text } = await render(
      ':::: columns\n::: column\nLeft cell\n:::\n::: column\nRight cell\n:::\n::::',
    );
    expect(text).toContain('Left cell');
    expect(text).toContain('Right cell');
    expect(text).not.toContain('EMAILMD');
  });

  it('renders no output for an empty columns block, with a warning', async () => {
    const { warnings } = await render('Before\n\n:::: columns\n::::\n\nAfter');
    expect(warnings.some((w) => w.message.includes('Empty columns'))).toBe(true);
  });
});
