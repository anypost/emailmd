import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const SIGNUPS = `::: sparkline
Weekly signups: 12, 19, 15, 27, 24, 31, 38
:::`;

/** Heights of the column fills, in document order. */
function columnHeights(html: string): number[] {
  return [...html.matchAll(/class="emd-sparkline-bar[^"]*"[^>]*height="(\d+)"/g)].map((m) => Number(m[1]));
}

/** Heights of the groove above each column, where one is drawn. */
function trackHeights(html: string): number[] {
  return [...html.matchAll(/class="emd-sparkline-track[^"]*"[^>]*height="(\d+)"/g)].map((m) => Number(m[1]));
}

describe('sparkline directive', () => {
  it('draws one column per point', async () => {
    const { html, warnings } = await render(SIGNUPS);
    expect(warnings).toBeUndefined();
    expect(columnHeights(html)).toHaveLength(7);
    expect(html).toContain('Weekly signups');
  });

  it('scales columns from zero against the largest point', async () => {
    const { html } = await render(`::: sparkline
0, 50, 100
:::`);
    // A 36px plot: nothing, half, full — with a stub standing in for nothing.
    expect(columnHeights(html)).toEqual([2, 18, 36]);
  });

  it('opens up a clustered series with min', async () => {
    const { html } = await render(`::: sparkline min=90
Uptime: 95, 98, 100
:::`);
    expect(columnHeights(html)).toEqual([18, 29, 36]);
  });

  it('pins the ceiling with max', async () => {
    const { html } = await render(`::: sparkline max=100
25, 50
:::`);
    expect(columnHeights(html)).toEqual([9, 18]);
  });

  it('warns and keeps the data range for an unusable min or max', async () => {
    const { html, warnings } = await render(`::: sparkline min=nope max=0
10, 20
:::`);
    expect(columnHeights(html)).toEqual([18, 36]);
    expect(warnings?.some((w) => w.message.includes('min'))).toBe(true);
    expect(warnings?.some((w) => w.message.includes('max'))).toBe(true);
  });

  it('draws no groove by default and one when track is set', async () => {
    const { html: plain } = await render(SIGNUPS);
    expect(plain).not.toContain('emd-sparkline-track');

    const { html: grooved } = await render(`::: sparkline track=#e4e4e7
10, 20
:::`);
    // Only the short column has room above it; the tallest fills its cell.
    expect(trackHeights(grooved)).toEqual([18]);
    expect(grooved).toContain('background-color:#e4e4e7');
  });

  it('rounds only the tops of the columns, and squares them on request', async () => {
    const { html } = await render(SIGNUPS);
    expect(html).toContain('border-radius:2px 2px 0 0');

    const { html: square } = await render(`::: sparkline border-radius=0
10, 20
:::`);
    expect(square).not.toMatch(/emd-sparkline-bar[^>]*border-radius/);
  });

  it('takes a pixel plot height and warns about anything else', async () => {
    const { html } = await render(`::: sparkline height=60
50, 100
:::`);
    expect(columnHeights(html)).toEqual([30, 60]);

    const { html: bad, warnings } = await render(`::: sparkline height=2rem
50, 100
:::`);
    expect(columnHeights(bad)).toEqual([18, 36]);
    expect(warnings?.some((w) => w.message.includes('height'))).toBe(true);
  });

  it('sizes the plot to the series, and fills the width once it is long enough', async () => {
    // Seven columns at 18px with a 2px gap between them.
    const { html: short } = await render(SIGNUPS);
    expect(short).toContain('width="138"');

    const series = Array.from({ length: 40 }, (_, i) => i + 1).join(', ');
    const { html: long } = await render(`::: sparkline\n${series}\n:::`);
    expect(long).toContain('style="width:100%;table-layout:fixed');
  });

  it('takes an explicit width in pixels or percent, and warns about anything else', async () => {
    const { html: pixels } = await render(`::: sparkline width=240
10, 20
:::`);
    expect(pixels).toContain('style="width:240px;table-layout:fixed');

    const { html: percent } = await render(`::: sparkline width=100%
10, 20
:::`);
    expect(percent).toContain('style="width:100%;table-layout:fixed');

    const { html: bad, warnings } = await render(`::: sparkline width=wide
10, 20
:::`);
    expect(bad).toContain('style="width:38px;table-layout:fixed');
    expect(warnings?.some((w) => w.message.includes('width'))).toBe(true);
  });

  it('applies a column color and drops the dark-mode hook for it', async () => {
    const { html } = await render(`::: sparkline color=#2563eb
10, 20
:::`);
    expect(html).toContain('background-color:#2563eb');
    expect(html).not.toContain('emd-sparkline-bar-themed');
  });

  it('reads commas as thousands separators only inside a number', async () => {
    const { html: grouped } = await render(`::: sparkline
Revenue: 12,000 13,500
:::`);
    expect(columnHeights(grouped)).toHaveLength(2);
    expect(grouped).toContain('13,500');

    const { html: listed } = await render(`::: sparkline
12,19,15
:::`);
    expect(columnHeights(listed)).toHaveLength(3);
  });

  it('trims a very long series to its most recent points', async () => {
    const series = Array.from({ length: 70 }, (_, i) => i + 1).join(', ');
    const { html, warnings } = await render(`::: sparkline
${series}
:::`);
    expect(columnHeights(html)).toHaveLength(60);
    expect(warnings?.some((w) => w.message.includes('70 points'))).toBe(true);
    // The trend is measured on the window that was drawn, not the whole series.
    expect(html).toContain('70');
  });

  it('renders trailing commentary below the sparkline', async () => {
    const { html } = await render(`::: sparkline
Weekly signups: 12, 38
Steady climb since the spring campaign.
:::`);
    expect(html).toContain('Steady climb since the spring campaign.');
    expect(html).not.toContain('campaign. ');
    expect(html.indexOf('emd-sparkline-bar')).toBeLessThan(html.indexOf('Steady climb'));
  });

  it('degrades to regular text when there are fewer than two numbers', async () => {
    const { html, warnings } = await render(`::: sparkline
Just a note, no data.
:::`);
    expect(html).toContain('Just a note, no data.');
    expect(html).not.toContain('emd-sparkline-bar');
    expect(warnings?.some((w) => w.message.includes('two numbers'))).toBe(true);
  });

  it('strips tags from labels and leaks no markers', async () => {
    const { html } = await render(`::: sparkline
Signups <img src=x onerror=alert(1)>: 10, 20
:::`);
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('EMAILMD:SPARKLINE');
  });

  it('mirrors the column order in RTL documents', async () => {
    const { html } = await render(`---
dir: rtl
---
::: sparkline
Signups: 0, 100
:::`);
    // The DOM stays LTR, so the series is walked backwards to start on the right.
    expect(columnHeights(html)).toEqual([36, 2]);
    // The readout precedes the plot, so it lands on the plot's left edge.
    expect(html).toMatch(/emd-sparkline-value[\s\S]*?emd-sparkline-bar/);
  });

  it('puts the readout beside a narrow plot and on the caption row at full width', async () => {
    // A seven-point plot leaves most of the row free, so the number sits next
    // to the shape rather than across the email from it.
    const { html: narrow } = await render(SIGNUPS);
    expect(narrow).toMatch(/emd-sparkline-bar[\s\S]*?emd-sparkline-value/);
    expect(narrow).not.toMatch(/emd-sparkline-value[\s\S]*?emd-sparkline-bar/);

    // A full-width plot has no room beside it, so the readout stays pinned to
    // the far edge the way a chart's values are.
    const { html: full } = await render(`::: sparkline width=100%
Weekly signups: 12, 19, 15, 27, 24, 31, 38
:::`);
    expect(full).toMatch(/emd-sparkline-value[\s\S]*?emd-sparkline-bar/);
    expect(full).toContain('align="right"');
  });

  it('keeps a long label from stretching the plot column', async () => {
    const { html } = await render(`::: sparkline
Signups from the paid acquisition channel: 12, 19, 15, 27, 24, 31, 38
:::`);
    // The label spans the row, so the plot column stays the width of the plot.
    expect(html).toMatch(/emd-sparkline-label[^>]*colspan="2"/);
    expect(html).toContain('width="138"');
  });

  it('emits dark-mode rules for themed columns only', async () => {
    const { html } = await render(`---
theme: auto
---
${SIGNUPS}`);
    expect(html).toContain('.emd-sparkline-bar-themed');
    expect(html).toContain('.emd-sparkline-label');
    expect(html).toContain('.emd-sparkline-value');
  });

  it('hides the readout with values=false', async () => {
    const { html } = await render(`::: sparkline values=false
Weekly signups: 12, 38
:::`);
    expect(html).not.toContain('emd-sparkline-value');
    expect(html).toContain('Weekly signups');
    expect(columnHeights(html)).toHaveLength(2);
  });
});

describe('trend indicator', () => {
  it('renders the readout without any columns', async () => {
    const { html, warnings } = await render(`::: trend
Signups: 12, 38
:::`);
    expect(warnings).toBeUndefined();
    expect(html).toContain('emd-sparkline-value');
    expect(html).not.toContain('emd-sparkline-bar');
    expect(html).toContain('38');
  });

  it('measures the change across the whole series', async () => {
    const { html } = await render(`::: trend
Signups: 12, 19, 15, 38
:::`);
    // 12 → 38 is +217%, whatever happened in between.
    expect(html).toContain('217%');
    expect(html).toContain('▲');
  });

  it('colors a rise as a win by default', async () => {
    const { html } = await render(`::: trend
Signups: 12, 38
:::`);
    expect(html).toMatch(/emd-sparkline-delta[^>]*color:#16a34a/);
  });

  it('flips the reading with good=down', async () => {
    const { html } = await render(`::: trend good=down
Churn: 4.1, 3.2
:::`);
    expect(html).toContain('▼');
    expect(html).toMatch(/emd-sparkline-delta[^>]*color:#16a34a/);

    const { html: worse } = await render(`::: trend good=down
Churn: 3.2, 4.1
:::`);
    expect(worse).toMatch(/emd-sparkline-delta[^>]*color:#dc2626/);
  });

  it('stays neutral for good=neutral and for a flat series', async () => {
    const { html: neutral } = await render(`::: trend good=neutral
Headcount: 40, 52
:::`);
    expect(neutral).toContain('emd-sparkline-delta-themed');

    const { html: flat } = await render(`::: trend
Headcount: 52, 52, 52
:::`);
    expect(flat).toContain('▬');
    expect(flat).toContain('0%');
    expect(flat).toContain('emd-sparkline-delta-themed');
  });

  it('reports an absolute move when a percentage would be meaningless', async () => {
    const { html: fromZero } = await render(`::: trend
Referrals: 0, 5, 12
:::`);
    // Percentages need a positive starting point to mean anything, so a rise
    // from zero reports the move itself.
    expect(fromZero).toMatch(/emd-sparkline-delta[^>]*>▲&#160;12<\/span>/);

    const { html: fromNegative } = await render(`::: trend
Margin: -4, 6
:::`);
    expect(fromNegative).toMatch(/emd-sparkline-delta[^>]*>▲&#160;10<\/span>/);
  });

  it('warns about an unusable good value', async () => {
    const { warnings } = await render(`::: trend good=sideways
Signups: 12, 38
:::`);
    expect(warnings?.some((w) => w.message.includes('good'))).toBe(true);
  });

  it('degrades to text when nothing is left to show', async () => {
    const { html, warnings } = await render(`::: trend values=false
12, 38
:::`);
    expect(html).not.toContain('emd-sparkline-value');
    expect(warnings?.some((w) => w.message.includes('no label and no readout'))).toBe(true);
  });
});

describe('sparkline plain text', () => {
  it('draws the series with block characters', async () => {
    const { text } = await render(`::: sparkline
0, 50, 100
:::`);
    expect(text).toContain('▁▅█');
  });

  it('closes the line with the same readout the HTML shows', async () => {
    const { text } = await render(SIGNUPS);
    expect(text).toContain('Weekly signups');
    expect(text).toMatch(/[▁-█]+ {2}38 {2}▲ 217%/);
    expect(text).not.toContain('EMAILMD');
  });

  it('puts a trend indicator on one line', async () => {
    const { text } = await render(`::: trend good=down
Churn: 4.1, 3.2
:::`);
    expect(text).toContain('Churn  3.2  ▼ 22%');
    expect(text).not.toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it('drops the readout with values=false', async () => {
    const { text } = await render(`::: sparkline values=false
Weekly signups: 12, 38
:::`);
    expect(text).toContain('Weekly signups');
    expect(text).not.toContain('▲');
    expect(text).toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it('falls back to the block text when there is no series', async () => {
    const { text } = await render(`::: sparkline
Just a note, no data.
:::`);
    expect(text).toContain('Just a note, no data.');
    expect(text).not.toMatch(/[▁▂▃▄▅▆▇█]/);
  });
});
