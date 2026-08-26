import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const TRAFFIC = `::: chart
- Direct: 4,200
- Organic search: 3,100
- Social: 640
:::`;

/** Widths of the bar-fill cells, in document order. */
function barWidths(html: string): string[] {
  return [...html.matchAll(/class="emd-chart-bar[^"]*"[^>]*width="([^"]*)"/g)].map((m) => m[1]);
}

describe('chart directive', () => {
  it('renders a labelled bar per list item', async () => {
    const { html, warnings } = await render(TRAFFIC);
    expect(warnings).toBeUndefined();
    expect(html).toContain('Direct');
    expect(html).toContain('Organic search');
    expect(html).toContain('4,200');
    expect(barWidths(html)).toHaveLength(3);
  });

  it('scales bars against the largest value', async () => {
    const { html } = await render(TRAFFIC);
    // 4200 is the max, so it fills the track; the rest are proportional.
    expect(barWidths(html)).toEqual(['100%', '73.81%', '15.24%']);
  });

  it('scales percentages against 100, not the largest value', async () => {
    const { html } = await render(`::: chart
- Very satisfied: 46%
- Satisfied: 31%
:::`);
    expect(barWidths(html)).toEqual(['46%', '31%']);
  });

  it('honours an explicit max', async () => {
    const { html } = await render(`::: chart max=10000
- Q1: 8,400
:::`);
    expect(barWidths(html)).toEqual(['84%']);
  });

  it('warns and falls back to the largest value for an unusable max', async () => {
    const { html, warnings } = await render(`::: chart max=nope
- Q1: 8,400
:::`);
    expect(barWidths(html)).toEqual(['100%']);
    expect(warnings?.some((w) => w.message.includes('max'))).toBe(true);
  });

  it('renders a zero value as an empty track with no fill cell', async () => {
    const { html } = await render(`::: chart max=100
- Nothing yet: 0
:::`);
    expect(barWidths(html)).toEqual([]);
    expect(html).toContain('emd-chart-track');
  });

  it('hides the value column with values=false', async () => {
    const { html } = await render(`::: chart values=false
- TypeScript: 95
:::`);
    expect(html).not.toContain('emd-chart-value');
    expect(html).toContain('emd-chart-label');
    expect(html).toContain('TypeScript');
  });

  it('applies block-level color and track params', async () => {
    const { html } = await render(`::: chart color=#2563eb track=#e4e4e7
- One: 50
- Two: 25
:::`);
    expect(html).toContain('background-color:#2563eb');
    expect(html).toContain('background-color:#e4e4e7');
  });

  it('recolors a single bar from a list-item attribute', async () => {
    const { html } = await render(`::: chart
- Engineering: 52 {color=#16a34a}
- Marketing: 24
:::`);
    expect(html).toContain('background-color:#16a34a');
    // Only the bar left at the theme color opts into dark-mode recoloring.
    expect([...html.matchAll(/emd-chart-bar-themed/g)]).toHaveLength(1);
  });

  it('falls back to the theme color for an invalid bar color', async () => {
    const { html, warnings } = await render(`::: chart
- Engineering: 52 {color=javascript:alert(1)}
:::`);
    expect(html).not.toContain('javascript:alert');
    expect(warnings?.some((w) => w.message.includes('chart bar'))).toBe(true);
  });

  it('renders intro text above the chart', async () => {
    const { html } = await render(`::: chart
Where your visitors came from:

- Direct: 4,200
:::`);
    const introIdx = html.indexOf('Where your visitors came from');
    const barIdx = html.indexOf('emd-chart-bar');
    expect(introIdx).toBeGreaterThan(-1);
    expect(barIdx).toBeGreaterThan(introIdx);
  });

  it('degrades to regular text with a warning when no item has a value', async () => {
    const { html, warnings } = await render(`::: chart
Just a paragraph, no data.
:::`);
    expect(html).toContain('Just a paragraph, no data.');
    expect(html).not.toContain('emd-chart-bar');
    expect(warnings?.some((w) => w.message.includes('Chart'))).toBe(true);
  });

  it('skips malformed items with a warning but keeps the rest', async () => {
    const { html, warnings } = await render(`::: chart
- Direct: 4,200
- no value here
:::`);
    expect(barWidths(html)).toHaveLength(1);
    expect(warnings?.some((w) => w.message.includes('skipped'))).toBe(true);
  });

  it('splits on the last colon so labels may contain one', async () => {
    const { html } = await render(`::: chart
- Q1: revenue: 400
:::`);
    expect(html).toContain('Q1: revenue');
    expect(barWidths(html)).toEqual(['100%']);
  });

  it('strips tags from labels and leaks no markers', async () => {
    const { html } = await render(`::: chart
- Direct <img src=x onerror=alert(1)>: 100
:::`);
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('EMAILMD:CHART');
  });

  it('mirrors captions and bar growth in RTL documents', async () => {
    const { html } = await render(`---
dir: rtl
---
::: chart
- Direct: 4,200
- Social: 640
:::`);
    // The value cell comes first so it lands on the left edge, and the groove
    // precedes the fill so the bar grows from the right.
    expect(html).toMatch(/emd-chart-value[\s\S]*?emd-chart-label/);
    expect(html).toMatch(/emd-chart-track[\s\S]*?emd-chart-bar/);
  });

  it('emits dark-mode rules for themed bars only', async () => {
    const { html } = await render(`---
theme: auto
---
${TRAFFIC}`);
    expect(html).toContain('.emd-chart-bar-themed');
    expect(html).toContain('.emd-chart-track-themed');
    expect(html).toContain('.emd-chart-label');
  });
});

describe('chart plain text', () => {
  it('draws ASCII bars scaled the same way as the HTML', async () => {
    const { text } = await render(TRAFFIC);
    const lines = text.split('\n').filter((l) => l.includes('█'));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Direct');
    expect(lines[0]).toContain('4,200');
    // Direct is the max (24 blocks); Social is 15% of it (4 blocks).
    expect((lines[0].match(/█/g) ?? []).length).toBe(24);
    expect((lines[2].match(/█/g) ?? []).length).toBe(4);
  });

  it('aligns labels and values into columns', async () => {
    const { text } = await render(TRAFFIC);
    const lines = text.split('\n').filter((l) => l.includes('█'));
    const barStarts = lines.map((l) => l.indexOf('█'));
    expect(new Set(barStarts).size).toBe(1);
  });

  it('keeps intro text and drops the markers', async () => {
    const { text } = await render(`::: chart
Where your visitors came from:

- Direct: 4,200
:::`);
    expect(text).toContain('Where your visitors came from:');
    expect(text).not.toContain('EMAILMD');
  });

  it('falls back to a plain list when there is no chart data', async () => {
    const { text } = await render(`::: chart
- just an item
:::`);
    expect(text).toContain('- just an item');
    expect(text).not.toContain('█');
  });
});

describe('chart border-radius', () => {
  it('derives a pill radius from the bar height by default', async () => {
    const { html } = await render(`::: chart height=14
- One: 50
- Two: 25
:::`);
    expect(html).toContain('border-radius:7px 0 0 7px');
  });

  it('squares the bars with border-radius=0', async () => {
    const { html } = await render(`::: chart border-radius=0
- One: 50
- Two: 25
:::`);
    // The head's code/pre styles always carry one, so scope to the bar cells.
    expect(html).not.toMatch(/emd-chart-(?:bar|track)[^>]*border-radius/);
  });

  it('accepts an explicit radius', async () => {
    const { html } = await render(`::: chart border-radius=2
- One: 50
- Two: 25
:::`);
    expect(html).toContain('border-radius:2px 0 0 2px');
  });

  it('warns and keeps the derived radius for an invalid value', async () => {
    const { html, warnings } = await render(`::: chart border-radius=huge
- One: 50
- Two: 25
:::`);
    expect(warnings?.some((w) => w.message.includes('chart border-radius'))).toBe(true);
    expect(html).toContain('border-radius:5px 0 0 5px');
  });
});
