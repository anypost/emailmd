import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const HOWTO = `::: steps
1. Create your account: Takes about a minute.
2. Connect your data: Point us at your warehouse.
3. Invite your team
:::`;

const TRACKER = `::: steps
- [x] Order placed: 12 Mar
- [x] Shipped: 14 Mar
- [ ] Out for delivery
- [ ] Delivered: Expected 16 Mar
:::`;

/** Step titles, in document order. */
function titles(html: string): string[] {
  return [...html.matchAll(/class="emd-step-title[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].trim());
}

/** Each title cell as `<classes>|<text>`, for reading a step's state off it. */
function titleTones(html: string): string[] {
  return [...html.matchAll(/class="(emd-step-title[^"]*)"[^>]*>([\s\S]*?)<\/td>/g)]
    .map((m) => `${m[1]}|${m[2].trim()}`);
}

/** Each marker as `<background>|<glyph>`, in document order. */
function markers(html: string): string[] {
  return [...html.matchAll(/class="emd-step-marker[^"]*"[^>]*background-color:([^;]+);[^>]*>([^<]*)</g)]
    .map((m) => `${m[1]}|${m[2]}`);
}

/** Background color of each length of connector, in document order. */
function rails(html: string): string[] {
  return [...html.matchAll(/class="emd-step-rail[^"]*"[^>]*background-color:([^;]+);/g)].map((m) => m[1]);
}

describe('steps directive', () => {
  it('numbers a list that tracks nothing', async () => {
    const { html, warnings } = await render(HOWTO);
    expect(warnings).toBeUndefined();
    expect(titles(html)).toEqual(['Create your account', 'Connect your data', 'Invite your team']);
    expect(markers(html)).toEqual(['#18181b|1', '#18181b|2', '#18181b|3']);
  });

  it('splits a step on its first colon', async () => {
    const { html } = await render(HOWTO);
    expect(html).toContain('>Takes about a minute.</td>');
    expect(html).toContain('>Point us at your warehouse.</td>');
  });

  it('leaves a colon with no space after it inside the title', async () => {
    const { html } = await render(`::: steps
1. Read https://example.com/docs first
:::`);
    // The colon in the scheme is followed by a slash, not a space, so it is
    // not a split point and the step keeps its one title.
    expect(titles(html)).toHaveLength(1);
    expect(titles(html)[0]).toContain('</a> first');
  });

  it('splits a two-paragraph step on its paragraph break', async () => {
    const { html } = await render(`::: steps
1. Pick a plan: monthly or yearly

   Yearly saves you two months.
:::`);
    // The structural split wins, so the colon in the headline is left alone.
    expect(titles(html)).toEqual(['Pick a plan: monthly or yearly']);
    expect(html).toContain('>Yearly saves you two months.</td>');
  });

  it('turns a ticked list into a tracker', async () => {
    const { html, warnings } = await render(TRACKER);
    expect(warnings).toBeUndefined();
    expect(markers(html)).toEqual(['#18181b|&#10003;', '#18181b|&#10003;', '#f4f4f5|3', '#f4f4f5|4']);
    expect(titles(html)).toEqual(['Order placed', 'Shipped', 'Out for delivery', 'Delivered']);
  });

  it('leaves every unticked step ahead of the reader', async () => {
    const { html } = await render(TRACKER);
    // Nothing is promoted to "you are here" — an unticked box says the step
    // has not happened, and both of these are unticked.
    expect(titleTones(html).slice(2)).toEqual([
      'emd-step-title emd-step-muted|Out for delivery',
      'emd-step-title emd-step-muted|Delivered',
    ]);
    expect(markers(html).slice(2)).toEqual(['#f4f4f5|3', '#f4f4f5|4']);
  });

  it('draws the current step at full weight once one is named', async () => {
    const { html } = await render(`::: steps
- [x] Order placed
- [ ] Out for delivery {state=current}
- [ ] Delivered
:::`);
    expect(html).toContain('font-weight:700;color:#09090b;">Out for delivery</td>');
    expect(markers(html)).toEqual(['#18181b|&#10003;', '#18181b|2', '#f4f4f5|3']);
    expect(titleTones(html)[2]).toBe('emd-step-title emd-step-muted|Delivered');
  });

  it('honours an explicit state over the checkbox', async () => {
    const { html } = await render(`::: steps
- [ ] Draft {state=done}
- [ ] Review {state=current}
- [ ] Ship
:::`);
    expect(markers(html)).toEqual(['#18181b|&#10003;', '#18181b|2', '#f4f4f5|3']);
  });

  it('draws a failed step in the danger tone with a cross', async () => {
    const { html } = await render(`::: steps
- [x] Card charged
- [ ] Payment confirmed {state=failed}
:::`);
    expect(markers(html)[1]).toBe('#dc2626|&#10005;');
    expect(titleTones(html)[1]).toBe('emd-step-title|Payment confirmed');
    expect(html).toContain('color:#dc2626;">Payment confirmed</td>');
  });

  it('lights the connector over ground already covered and leaves the rest neutral', async () => {
    const { html } = await render(TRACKER);
    // Two lengths behind the reader, one ahead — and none past the last marker.
    expect(rails(html)).toEqual(['#18181b', '#18181b', '#f4f4f5']);
  });

  it('runs the connector the length of a block that has no markers', async () => {
    const { html } = await render(`::: steps marker=none
1. Draft the copy
2. Send a test
:::`);
    expect(html).not.toContain('emd-step-marker');
    // A length beside each title, plus the one reaching from the first step to
    // the second. The bar ends where the last step's text does.
    expect(rails(html)).toHaveLength(3);
  });

  it('starts the numbering where the list does', async () => {
    const { html } = await render(`::: steps
4. Draft the copy
5. Send a test
:::`);
    expect(markers(html)).toEqual(['#18181b|4', '#18181b|5']);
  });

  it('lets start override the list', async () => {
    const { html } = await render(`::: steps start=10
1. Draft the copy
2. Send a test
:::`);
    expect(markers(html)).toEqual(['#18181b|10', '#18181b|11']);
  });

  it('draws bare discs for a timeline', async () => {
    const { html, warnings } = await render(`::: timeline
- [x] Signed up: Jan 2024
- [x] Upgraded: Mar 2024
:::`);
    expect(warnings).toBeUndefined();
    expect(markers(html)).toEqual(['#18181b|&#160;', '#18181b|&#160;']);
    expect(html).toContain('width:14px;height:14px;');
  });

  it('drops the connector on rail=none', async () => {
    const { html } = await render(`::: steps rail=none
1. One
2. Two
:::`);
    expect(rails(html)).toEqual([]);
  });

  it('colors the markers and gives up the dark hook when the author picks a color', async () => {
    const { html } = await render(`::: steps color=#2563eb
1. One
2. Two
:::`);
    expect(markers(html)).toEqual(['#2563eb|1', '#2563eb|2']);
    expect(html).not.toContain('emd-step-marker-themed');
  });

  it('sizes the markers', async () => {
    const { html } = await render(`::: steps size=40
1. One
:::`);
    expect(html).toContain('width:40px;height:40px;');
  });

  it('keeps the intro above the steps', async () => {
    const { html } = await render(`::: steps
Your order is on its way.

- [x] Order placed
- [ ] Delivered
:::`);
    expect(html).toContain('Your order is on its way.');
    expect(html.indexOf('Your order is on its way.')).toBeLessThan(html.indexOf('Order placed'));
  });

  it('keeps inline markup inside a step', async () => {
    const { html } = await render(`::: steps
1. **Ship it**: see the [changelog](https://example.com)
:::`);
    expect(titles(html)[0]).toBe('<strong>Ship it</strong>');
    expect(html).toContain('href="https://example.com"');
  });

  it('escapes HTML written into a step when raw HTML is off', async () => {
    const { html } = await render(`::: steps
1. <script>alert(1)</script>: careful
:::`, { allowHtml: false });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('puts the markers after the text in an RTL document', async () => {
    const { html } = await render(`---
dir: rtl
---

::: steps
1. One
2. Two
:::`);
    const title = html.indexOf('>One</td>');
    const marker = html.indexOf('>1</td>');
    expect(title).toBeGreaterThan(-1);
    expect(marker).toBeGreaterThan(title);
  });

  it('renders a block with no list as regular text, with a warning', async () => {
    const { html, warnings } = await render('::: steps\nNothing to walk through.\n:::');
    expect(html).toContain('Nothing to walk through.');
    expect(html).not.toContain('emd-steps');
    expect(warnings?.[0].message).toContain('no list items');
  });

  it('warns about an unreadable marker, size, gap, start, and state', async () => {
    const { warnings } = await render(`::: steps marker=blob size=huge gap=wide start=x
1. One {state=maybe}
:::`);
    const messages = (warnings ?? []).map((w) => w.message).join('\n');
    expect(messages).toContain('Invalid marker "blob"');
    expect(messages).toContain('Invalid size "huge"');
    expect(messages).toContain('Invalid gap "wide"');
    expect(messages).toContain('Invalid start "x"');
    expect(messages).toContain('Invalid state "maybe"');
  });

  it('carries the step hooks into the dark palette', async () => {
    const { html } = await render(`---\ntheme: auto\n---\n\n${HOWTO}`);
    expect(html).toContain('.emd-step-marker-themed');
    expect(html).toContain('.emd-step-rail-lit');
    expect(html).toContain('.emd-step-title-themed');
  });
});

describe('steps plain text', () => {
  it('numbers a list that tracks nothing and indents its detail', async () => {
    const { text } = await render(HOWTO, { text: true });
    expect(text).toContain('1. Create your account\n   Takes about a minute.');
    expect(text).toContain('3. Invite your team');
  });

  it('marks a tracker with ticks, an arrow, and empty boxes', async () => {
    const { text } = await render(TRACKER, { text: true });
    expect(text).toContain('[✓] Order placed\n    12 Mar');
    expect(text).toContain('[ ] Out for delivery');
    expect(text).toContain('[ ] Delivered\n    Expected 16 Mar');
  });

  it('marks a named current step with an arrow', async () => {
    const { text } = await render(`::: steps
- [x] Order placed
- [ ] Out for delivery {state=current}
:::`, { text: true });
    expect(text).toContain('[→] Out for delivery');
  });

  it('spells out a link inside a step', async () => {
    const { text } = await render(`::: steps
1. Read the [docs](https://example.com)
:::`, { text: true });
    expect(text).toContain('1. Read the docs (https://example.com)');
  });

  it('leaves the block alone when it holds no steps', async () => {
    const { text } = await render('::: steps\nNothing to walk through.\n:::', { text: true });
    expect(text).toContain('Nothing to walk through.');
  });
});

describe('steps states', () => {
  const EXPECTED = ['#18181b|&#10003;', '#18181b|2', '#f4f4f5|3'];

  it('reads the same walk written three ways', async () => {
    // `current` is the position a checkbox has no room for, so a stated step
    // needs no box — and a block may drop boxes entirely.
    const forms = [
      '- [x] Order placed\n- [ ] Out for delivery {state=current}\n- [ ] Delivered',
      '- [x] Order placed\n- Out for delivery {state=current}\n- [ ] Delivered',
      '- Order placed {state=done}\n- Out for delivery {state=current}\n- Delivered',
    ];
    for (const form of forms) {
      const { html } = await render(`::: steps\n${form}\n:::`);
      expect(markers(html)).toEqual(EXPECTED);
    }
  });
});
