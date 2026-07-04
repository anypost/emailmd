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

  // Every column's rendered width, in percent (per-48-51 → 48.51). Inline-block
  // columns wrap to the next line if a row's widths sum past 100%.
  const columnWidths = (html: string): number[] =>
    [...html.matchAll(/class="mj-column-per-([\d-]+) /g)].map((m) =>
      parseFloat(m[1].replace('-', '.')));

  it('separates adjacent bg cards with a spacer column sized to gap', async () => {
    const { html } = await render(
      ':::: columns gap=40\n::: column bg=#f3e7d8\nA\n:::\n::: column bg=#e7d3bd\nB\n:::\n::::',
    );
    expect(html).toContain('emd-gap');
    // Outlook fallback td carries the exact pixel gap
    expect(html).toContain('width:40px');
    // The inner mj-spacer keeps the gap when columns stack on mobile
    expect(html).toMatch(/height:40px/);
    // Cards get explicit widths so MJML's equal split doesn't count the spacer
    expect(html).toContain('mj-column-per-46-27');
    expect(html).not.toContain('mj-column-per-33');
  });

  it('separates cards with the default 16px gap', async () => {
    const { html } = await render(
      ':::: columns\n::: column bg=#f3e7d8\nA\n:::\n::: column bg=#e7d3bd\nB\n:::\n::::',
    );
    expect(html).toContain('emd-gap');
    expect(html).toMatch(/height:16px/);
    // Widths must never sum past 100% or the cards wrap instead of sitting
    // side by side (2.985% must floor to 2.98, not round up to 2.99).
    const widths = columnWidths(html);
    expect(widths).toHaveLength(3);
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100);
  });

  it('keeps three cards with gaps on one row', async () => {
    const { html } = await render(
      ':::: columns\n::: column bg=#eee\nA\n:::\n::: column bg=#eee\nB\n:::\n::: column bg=#eee\nC\n:::\n::::',
    );
    const widths = columnWidths(html);
    expect(widths).toHaveLength(5); // 3 cards + 2 spacers
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100);
  });

  it('renders cards flush with gap=0', async () => {
    const { html } = await render(
      ':::: columns gap=0\n::: column bg=#f3e7d8\nA\n:::\n::: column bg=#e7d3bd\nB\n:::\n::::',
    );
    expect(html).not.toContain('emd-gap');
  });

  it('uses a spacer column between a plain column and a card', async () => {
    const { html } = await render(
      ':::: columns gap=40\n::: column\nPlain\n:::\n::: column bg=#e7d3bd\nCard\n:::\n::::',
    );
    expect(html).toContain('emd-gap');
    // The plain neighbor drops its gutter half; the spacer carries the full gap
    expect(html).toContain('padding:0 0px 0 0px');
  });

  it('honors explicit widths alongside card gaps', async () => {
    const { html } = await render(
      ':::: columns gap=40\n::: column width=30% bg=#f3e7d8\nA\n:::\n::: column\nB\n:::\n::::',
    );
    expect(html).toContain('mj-column-per-30');
    expect(html).toContain('emd-gap');
  });

  it('warns when explicit widths plus gaps exceed 100%', async () => {
    const { warnings } = await render(
      ':::: columns gap=40\n::: column width=99% bg=#f3e7d8\nA\n:::\n::: column\nB\n:::\n::::',
    );
    expect(warnings.some((w) => w.message.includes('exceed 100%'))).toBe(true);
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
