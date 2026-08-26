import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const KPIS = `::: stats
- Revenue: $48,200 (+12%)
- New customers: 340 (+8%)
- Churn: 2.1% (-0.4pt) {good=down}
:::`;

/** Tile values, in document order. */
function values(html: string): string[] {
  return [...html.matchAll(/class="emd-stat-value[^"]*"[^>]*>([^<]*)</g)].map((m) => m[1]);
}

/** Tile labels, in document order. */
function labels(html: string): string[] {
  return [...html.matchAll(/class="emd-stat-label"[^>]*>([^<]*)</g)].map((m) => m[1]);
}

/** Each tile's change cell as `<color>|<text>`, in document order. */
function deltas(html: string): string[] {
  return [...html.matchAll(/class="emd-stat-delta[^"]*"[^>]*color:([^;]+);[^>]*>([^<]*)</g)]
    .map((m) => `${m[1]}|${m[2].replace(/&#160;/g, ' ')}`);
}

/** Widths of the tile columns, from the Outlook conditional track. */
function tileWidths(html: string): string[] {
  return [...html.matchAll(/class="mj-column-per-([\d-]+) mj-outlook-group-fix(?! emd-gap)/g)].map((m) => m[1]);
}

describe('stats directive', () => {
  it('renders a tile per list item', async () => {
    const { html, warnings } = await render(KPIS);
    expect(warnings).toBeUndefined();
    expect(labels(html)).toEqual(['Revenue', 'New customers', 'Churn']);
    expect(values(html)).toEqual(['$48,200', '340', '2.1%']);
  });

  it('reads a signed parenthetical as the change and marks its direction', async () => {
    const { html } = await render(KPIS);
    expect(deltas(html)).toEqual([
      '#16a34a|▲ 12%',
      '#16a34a|▲ 8%',
      // good=down on the item, so a fall reads as a win.
      '#16a34a|▼ 0.4pt',
    ]);
  });

  it('colors a move against the block direction as a loss', async () => {
    const { html } = await render(`::: stats
- Signups: 340 (-8%)
:::`);
    // Nothing said otherwise, so up is the win and a fall is a loss.
    expect(deltas(html)).toEqual(['#dc2626|▼ 8%']);
  });

  it('takes good on the block and lets an item override it', async () => {
    const { html } = await render(`::: stats good=down
- Cost per lead: $18 (-12%)
- Signups: 340 (-8%) {good=up}
:::`);
    expect(deltas(html)).toEqual(['#16a34a|▼ 12%', '#dc2626|▼ 8%']);
  });

  it('drops the judgement but keeps the arrow when good=neutral', async () => {
    const { html } = await render(`::: stats good=neutral
- Headcount: 218 (+14)
:::`);
    expect(deltas(html)).toEqual(['#71717a|▲ 14']);
    expect(html).toContain('emd-stat-delta-themed');
  });

  it('leaves an unsigned parenthetical as part of the value', async () => {
    const { html } = await render(`::: stats
- Revenue: $48,200 (last 30 days)
:::`);
    expect(values(html)).toEqual(['$48,200 (last 30 days)']);
    expect(deltas(html)).toEqual([]);
  });

  it('accepts a non-numeric value', async () => {
    const { html, warnings } = await render(`::: stats
- Plan: Enterprise
- Renews: 14 Mar 2027
:::`);
    expect(warnings).toBeUndefined();
    expect(values(html)).toEqual(['Enterprise', '14 Mar 2027']);
  });

  it('splits on the last colon, so a label may contain one', async () => {
    const { html } = await render(`::: stats
- Q1: revenue: $48,200 (+12%)
:::`);
    expect(labels(html)).toEqual(['Q1: revenue']);
    expect(values(html)).toEqual(['$48,200']);
  });

  it('lays four tiles out two across rather than three and an orphan', async () => {
    const { html } = await render(`::: stats
- A: 1
- B: 2
- C: 3
- D: 4
:::`);
    // 2 across: (100 - one 2.98% gap) / 2
    expect(tileWidths(html)).toEqual(['48-51', '48-51', '48-51', '48-51']);
  });

  it('honours an explicit column count', async () => {
    const { html } = await render(`::: stats columns=1
- A: 1
- B: 2
:::`);
    expect(tileWidths(html)).toEqual(['100', '100']);
  });

  it('honours a column count wider than the block, so it lines up with its neighbours', async () => {
    const { html } = await render(`::: stats columns=3
- A: 1
- B: 2
:::`);
    expect(tileWidths(html)).toEqual(['31-34', '31-34']);
  });

  it('warns on an out-of-range column count and falls back', async () => {
    const { html, warnings } = await render(`::: stats columns=9
- A: 1
- B: 2
:::`);
    expect(warnings?.[0].message).toContain('Invalid columns "9" for stats');
    expect(tileWidths(html)).toEqual(['48-51', '48-51']);
  });

  it('fills a short last row so its tiles line up under the row above', async () => {
    const { html } = await render(`::: stats
- A: 1
- B: 2
- C: 3
- D: 4
- E: 5
:::`);
    // Three across; the two-tile row is padded out to a full 100%.
    expect(tileWidths(html)).toEqual(['31-34', '31-34', '31-34', '31-34', '31-34']);
    // One tile's width plus its gap, so the row still adds up to 100%.
    expect(html).toContain('mj-column-per-34-32 mj-outlook-group-fix emd-gap');
  });

  it('draws tiles as themed cards by default', async () => {
    const { html } = await render(KPIS);
    expect(html).toContain('emd-card');
    expect(html).toContain('background-color:#f4f4f5');
  });

  it('drops the card with bg=none', async () => {
    const { html } = await render(`::: stats bg=none
- A: 1
:::`);
    expect(html).not.toContain('emd-card');
    expect(html).not.toContain('background-color:#f4f4f5');
  });

  it('keeps an explicit background out of the dark-mode override', async () => {
    const { html } = await render(`::: stats bg=#eff6ff
- A: 1
:::`);
    expect(html).toContain('background-color:#eff6ff');
    expect(html).not.toContain('emd-card');
  });

  it('keeps an explicit value color out of the dark-mode override', async () => {
    const { html } = await render(`::: stats color=#1e40af
- A: 1
:::`);
    expect(html).toContain('color:#1e40af');
    expect(html).not.toContain('emd-stat-value-themed');
  });

  it('recolors a single tile', async () => {
    const { html } = await render(`::: stats
- A: 1 {color=#dc2626}
- B: 2
:::`);
    expect(html).toMatch(/emd-stat-value"[^>]*color:#dc2626/);
    expect(html).toMatch(/emd-stat-value emd-stat-value-themed[^>]*color:#09090b/);
  });

  it('scales the type with the theme and takes a size override', async () => {
    const { html: base } = await render(KPIS);
    expect(base).toContain('font-size:28px');
    const { html } = await render(`::: stats size=34
- A: 1
:::`);
    expect(html).toContain('font-size:34px');
  });

  it('renders intro text above the tiles', async () => {
    const { html } = await render(`::: stats
Last 30 days.

- A: 1
:::`);
    expect(html.indexOf('Last 30 days.')).toBeLessThan(html.indexOf('emd-stat-label'));
  });

  it('skips list items with no "Label: value" shape', async () => {
    const { html, warnings } = await render(`::: stats
- Revenue: $48,200
- just a note
:::`);
    expect(labels(html)).toEqual(['Revenue']);
    expect(warnings?.[0].message).toContain('1 stat had no "Label: value" shape');
  });

  it('degrades to regular text when the block has no list', async () => {
    const { html, warnings } = await render(`::: stats
Nothing to see here.
:::`);
    expect(warnings?.[0].message).toContain('no "Label: value" list items');
    expect(html).toContain('Nothing to see here.');
    expect(html).not.toContain('emd-stat-label');
  });

  it('warns on an invalid good and treats up as good', async () => {
    const { html, warnings } = await render(`::: stats good=sideways
- A: 1 (+5%)
:::`);
    expect(warnings?.[0].message).toContain('Invalid good "sideways" for stats');
    expect(deltas(html)).toEqual(['#16a34a|▲ 5%']);
  });

  it('mirrors the tile order in RTL documents', async () => {
    const { html } = await render(`---
dir: rtl
---

::: stats
- A: 1
- B: 2
- C: 3
:::`);
    expect(labels(html)).toEqual(['C', 'B', 'A']);
    expect(html).toContain('align="right"');
  });

  it('leads a short RTL row with the leftover width', async () => {
    const { html } = await render(`---
dir: rtl
---

::: stats
- A: 1
- B: 2
- C: 3
- D: 4
- E: 5
:::`);
    // The filler leads the row, so its tiles sit against the right edge.
    const filler = html.indexOf('mj-column-per-34-32');
    expect(filler).toBeGreaterThan(0);
    expect(html.indexOf('>D<')).toBeGreaterThan(filler);
  });
});

describe('stats plain text', () => {
  it('lines the tiles up as columns', async () => {
    const { text } = await render(KPIS, { text: true });
    expect(text).toContain('Revenue        $48,200  ▲ 12%');
    expect(text).toContain('New customers  340      ▲ 8%');
    expect(text).toContain('Churn          2.1%     ▼ 0.4pt');
  });

  it('leaves no trailing padding when no tile has a change', async () => {
    const { text } = await render(`::: stats
- Plan: Enterprise
- Seats: 240
:::`, { text: true });
    expect(text).toContain('Plan   Enterprise\nSeats  240');
  });

  it('keeps the intro above the columns', async () => {
    const { text } = await render(`::: stats
Last 30 days.

- Revenue: $48,200 (+12%)
:::`, { text: true });
    expect(text).toContain('Last 30 days.');
    expect(text.indexOf('Last 30 days.')).toBeLessThan(text.indexOf('Revenue'));
  });

  it('leaves the block alone when it holds no tiles', async () => {
    const { text } = await render(`::: stats
Nothing to see here.
:::`, { text: true });
    expect(text).toContain('Nothing to see here.');
  });
});
