import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { rulesFor } from './helpers/css.js';

const RANKED = `::: breakdown
1. Checkout: $4,210 (+12%)
   p95 182 ms
2. Search: $3,980 (-3%) {good=down}
3. Product page: $2,104
:::`;

const PALETTE = `chart_colors: ["#2563eb", "#16a34a", "#d97706"]`;

/** The first cell of each class, in document order, by its text. */
function cells(html: string, cls: string): string[] {
  return [...html.matchAll(new RegExp(`<td class="${cls}[^"]*"[^>]*>([\\s\\S]*?)</td>`, 'g'))].map((m) => m[1]);
}

/** Full class lists of each cell of a class. */
function classes(html: string, cls: string): string[] {
  return [...html.matchAll(new RegExp(`<td class="(${cls}[^"]*)"`, 'g'))].map((m) => m[1]);
}

describe('breakdown directive', () => {
  it('renders a row per list item: label, value and change', async () => {
    const { html, warnings } = await render(RANKED);
    expect(warnings).toBeUndefined();
    expect(cells(html, 'emd-breakdown-label').map((c) => c.replace(/<br>[\s\S]*/, ''))).toEqual(['Checkout', 'Search', 'Product page']);
    expect(cells(html, 'emd-breakdown-value')).toEqual(['$4,210', '$3,980', '$2,104']);
    expect(cells(html, 'emd-breakdown-delta')).toEqual(['▲&#160;12%', '▼&#160;3%', '']);
    expect(html).toContain('class="emd-breakdown"');
  });

  it('ranks the rows of an ordered list, from its start number', async () => {
    const { html } = await render(RANKED);
    expect(cells(html, 'emd-breakdown-rank')).toEqual(['1', '2', '3']);

    const later = await render(RANKED.replace('1. Checkout', '4. Checkout'));
    expect(cells(later.html, 'emd-breakdown-rank')).toEqual(['4', '5', '6']);

    const plain = await render('::: breakdown\n- A: 1\n- B: 2\n:::');
    expect(plain.html).not.toContain('emd-breakdown-rank');
  });

  it('keeps a skipped item\'s rank, so each row keeps the number written beside it', async () => {
    const { html, warnings } = await render('::: breakdown\n1. A: 1\n2. no colon here\n3. C: 3\n:::');
    expect(cells(html, 'emd-breakdown-rank')).toEqual(['1', '3']);
    expect(warnings?.map((w) => w.message)).toContain('1 row had no "Label: value" shape and was skipped.');
  });

  it('puts the lines under an item in a muted sub-label', async () => {
    const { html } = await render(RANKED);
    expect(cells(html, 'emd-breakdown-label')[0]).toBe('Checkout<br><span class="emd-breakdown-sub emd-muted" style="font-size:14px;color:#71717a;">p95 182 ms</span>');
  });

  it('reads {good=…} on the first line of a two-line item', async () => {
    const { html } = await render(`::: breakdown
- Errors: 12 (+4) {good=down}
  last 24 hours
:::`);
    expect(classes(html, 'emd-breakdown-delta')[0]).toContain('emd-bad');
    expect(cells(html, 'emd-breakdown-label')[0]).toContain('last 24 hours');
    expect(html).not.toContain('{good=down}');
  });

  it('colors changes by good, on the block and per row', async () => {
    const { html } = await render(`::: breakdown good=down
- Bounce rate: 41% (-3pt)
- Pages per visit: 3.2 (+0.4) {good=up}
- Headcount: 12 (+1) {good=neutral}
:::`);
    const tones = classes(html, 'emd-breakdown-delta');
    expect(tones[0]).toContain('emd-good');
    expect(tones[1]).toContain('emd-good');
    expect(tones[2]).toContain('emd-muted');
    expect(html).toContain('color:#16a34a;white-space:nowrap;">▼&#160;3pt');
  });

  it('leaves out the change column when no row has a change', async () => {
    const { html } = await render('::: breakdown\n- A: 1\n- B: 2\n:::');
    expect(html).not.toContain('emd-breakdown-delta');
  });

  it('wraps labels between words, and keeps values and changes on one line', async () => {
    const { html } = await render(RANKED);
    expect(html).toMatch(/<td class="emd-breakdown-label[^"]*" align="left" width="100%" style="[^"]*word-break:normal;/);
    expect(html).toMatch(/<td class="emd-breakdown-value[^"]*"[^>]*white-space:nowrap;/);
    expect(html).toMatch(/<td class="emd-breakdown-delta[^"]*"[^>]*white-space:nowrap;/);
  });

  it('draws a hairline divider between rows, in the theme divider color', async () => {
    const { html } = await render(RANKED);
    const ruled = classes(html, 'emd-breakdown-label');
    expect(ruled).toEqual(['emd-breakdown-label', 'emd-breakdown-label emd-breakdown-rule', 'emd-breakdown-label emd-breakdown-rule']);
    expect(html).toContain('border-top:1px solid #f4f4f5;');

    const bare = await render(RANKED.replace('::: breakdown', '::: breakdown dividers=false'));
    expect(bare.html).not.toContain('emd-breakdown-rule');
    expect(bare.html).not.toContain('border-top:1px solid');
  });

  it('colors swatches from the palette by position', async () => {
    const { html, warnings } = await render(`---
${PALETTE}
---

::: breakdown swatches=true
- A: 1
- B: 2
- C: 3
- D: 4
- E: 5 {color=chart-1}
:::`);
    expect(warnings).toBeUndefined();
    expect(classes(html, 'emd-breakdown-swatch')).toEqual([
      'emd-breakdown-swatch emd-c1', 'emd-breakdown-swatch emd-c2 emd-breakdown-rule', 'emd-breakdown-swatch emd-c3 emd-breakdown-rule',
      'emd-breakdown-swatch emd-c1 emd-breakdown-rule', 'emd-breakdown-swatch emd-c1 emd-breakdown-rule',
    ]);
    expect(cells(html, 'emd-breakdown-swatch')[0]).toBe('&#9679;');
    expect(html).toMatch(/emd-breakdown-swatch emd-c2[^"]*" style="[^"]*color:#16a34a;/);
  });

  it('gives every swatch the block color when there is one', async () => {
    const { html } = await render(`---
${PALETTE}
---

::: breakdown swatches=true color=chart-2
- A: 1
- B: 2
:::`);
    expect(classes(html, 'emd-breakdown-swatch').map((c) => c.split(' ')[1])).toEqual(['emd-c2', 'emd-c2']);
  });

  it('warns when swatches have no palette to tell rows apart', async () => {
    const { html, warnings } = await render('::: breakdown swatches=true\n- A: 1\n- B: 2\n:::');
    expect(warnings?.map((w) => w.message)).toContain('Breakdown swatches take their colors from the theme\'s chart_colors, which it doesn\'t set — every swatch is the default data color.');
    expect(classes(html, 'emd-breakdown-swatch')[0]).toBe('emd-breakdown-swatch emd-breakdown-swatch-themed');
  });

  it('draws a bar under each row, scaled to the largest value, in the row color', async () => {
    const { html, warnings } = await render(`---
${PALETTE}
---

::: breakdown swatches=true bars=true
- A: 400
- B: 100
:::`);
    expect(warnings).toBeUndefined();
    expect(html).toContain('class="emd-breakdown-bar emd-c1-bg" bgcolor="#2563eb" width="100%"');
    expect(html).toContain('class="emd-breakdown-bar emd-c2-bg" bgcolor="#16a34a" width="25%"');
    expect(html).toContain('class="emd-breakdown-track emd-breakdown-track-themed" bgcolor="#f4f4f5" width="75%"');
    // The bar spans the label, value and (here absent) change columns, under a
    // blank cell for the swatch.
    expect(html).toContain('<tr><td style="padding:0;"></td><td colspan="2" style="padding:6px 0 10px 0;">');
  });

  it('scales percentages against 100 and takes max=', async () => {
    const pct = await render('::: breakdown bars=true\n- A: 40%\n- B: 20%\n:::');
    expect(pct.html).toContain('class="emd-breakdown-bar emd-breakdown-bar-themed" bgcolor="#18181b" width="40%"');

    const capped = await render('::: breakdown bars=true max=1000\n- A: 400\n:::');
    expect(capped.html).toContain('width="40%"');
  });

  it('skips the bar for a value with no number, with a warning', async () => {
    const { html, warnings } = await render('::: breakdown bars=true\n- A: 400\n- B: n/a\n:::');
    expect(html.match(/class="emd-breakdown-bar/g)).toHaveLength(1);
    expect(warnings?.map((w) => w.message)).toContain('1 row has no number in its value to draw a bar for.');
  });

  it('warns on a flag that is not true or false', async () => {
    const { warnings } = await render('::: breakdown bars=yes\n- A: 1\n:::');
    expect(warnings?.map((w) => w.message)).toContain('Invalid bars "yes" for breakdown — expected "true" or "false"; using false.');
  });

  it('mirrors the columns in RTL documents', async () => {
    const { html } = await render(`---
dir: rtl
---

${RANKED}`);
    const row = /<tr>([\s\S]*?)<\/tr>/.exec(html.slice(html.indexOf('emd-breakdown')))![1];
    const order = [...row.matchAll(/<td class="(emd-breakdown-\w+)/g)].map((m) => m[1]);
    expect(order).toEqual(['emd-breakdown-delta', 'emd-breakdown-value', 'emd-breakdown-label', 'emd-breakdown-rank']);
    expect(html).toMatch(/emd-breakdown-label" align="right"/);
  });

  it('renders intro text above the rows', async () => {
    const { html } = await render('::: breakdown\nTop pages.\n\n- A: 1\n:::');
    expect(html.indexOf('Top pages.')).toBeLessThan(html.indexOf('emd-breakdown-label'));
  });

  it('degrades to regular text when the block has no list', async () => {
    const { html, warnings } = await render('::: breakdown\nNothing here.\n:::');
    expect(html).toContain('Nothing here.');
    expect(warnings?.map((w) => w.message)).toContain('Breakdown block contains no "Label: value" list items — rendering its content as regular text.');
  });
});

describe('breakdown dark mode', () => {
  const dark = (md: string) => render(`---
theme: auto
${PALETTE}
---

${md}`);

  it('follows the dark palette for text, swatches, bars, tracks and dividers', async () => {
    const { html } = await dark(RANKED);
    expect(rulesFor(html, '.emd-breakdown-label')[0]).toContain('color: #fafafa !important;');
    expect(rulesFor(html, '.emd-breakdown-value')[0]).toContain('color: #fafafa !important;');
    expect(rulesFor(html, '.emd-breakdown-rule')[0]).toContain('border-color: #27272a !important;');
    expect(rulesFor(html, '.emd-breakdown-bar-themed')[0]).toContain('background-color: #2563eb !important;');
    expect(rulesFor(html, '.emd-breakdown-track-themed')[0]).toContain('background-color: #27272a !important;');
    expect(rulesFor(html, '.emd-breakdown-swatch-themed')[0]).toContain('color: #2563eb !important;');
  });

  it('keeps an explicit track out of the dark-mode override', async () => {
    const { html } = await dark('::: breakdown bars=true track=#eeeeee\n- A: 2\n- B: 1\n:::');
    expect(html).toContain('class="emd-breakdown-track" bgcolor="#eeeeee"');
  });
});

describe('breakdown plain text', () => {
  it('lines up rank, label, value and change, with the sub-label under its label', async () => {
    const { text } = await render(RANKED, { text: true });
    expect(text).toContain([
      '1.  Checkout      $4,210  ▲ 12%',
      '    p95 182 ms',
      '2.  Search        $3,980  ▼ 3%',
      '3.  Product page  $2,104',
    ].join('\n'));
  });

  it('right-aligns values and draws bars between label and value', async () => {
    const { text } = await render('::: breakdown bars=true\n- Direct: 4,200\n- Referral: 840\n:::', { text: true });
    expect(text).toContain(`Direct    ${'█'.repeat(24)}  4,200`);
    expect(text).toContain(`Referral  ${'█'.repeat(5)}${' '.repeat(19)}    840`);
  });

  it('leaves the block alone when it holds no rows', async () => {
    const { text } = await render('::: breakdown\nNothing here.\n:::', { text: true });
    expect(text).toContain('Nothing here.');
  });
});
