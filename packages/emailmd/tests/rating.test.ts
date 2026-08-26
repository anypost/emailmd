import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const BREAKDOWN = `::: rating
- Comfort: 4.5
- Value for money: 3.5
- Customer service: 5
- Noise: 2
:::`;

/** Every glyph as `<color>|<character>`, in document order. */
function glyphs(html: string): string[] {
  return [...html.matchAll(/<td[^>]*font-size:\d+px;line-height:\d+px;color:([^;]+);[^>]*>([^<]+)</g)]
    .map((m) => `${m[1]}|${m[2]}`);
}

/** Just the characters, joined — the shape of the row. */
function row(html: string): string {
  return glyphs(html).map((g) => g.split('|')[1]).join('');
}

/** The class hook on each glyph cell, in document order. */
function hooks(html: string): string[] {
  return [...html.matchAll(/<td class="(emd-rating-[\w-]+)"[^>]*font-size:\d+px;line-height:\d+px/g)].map((m) => m[1]);
}

/** Each readout, in document order. */
function readouts(html: string): string[] {
  return [...html.matchAll(/class="emd-rating-value"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
}

function labels(html: string): string[] {
  return [...html.matchAll(/class="emd-rating-label"[^>]*>([^<]*)</g)].map((m) => m[1].trim());
}

describe('rating directive', () => {
  it('draws a headline score written on one line', async () => {
    const { html } = await render(`::: rating\nOverall: 4\n:::`);
    expect(row(html)).toBe('★★★★☆');
    expect(labels(html)).toEqual(['Overall']);
    expect(readouts(html)).toEqual(['4']);
  });

  it('draws a list as one row per criterion', async () => {
    const { html } = await render(BREAKDOWN);
    expect(labels(html)).toEqual(['Comfort', 'Value for money', 'Customer service', 'Noise']);
    expect(readouts(html)).toEqual(['4.5', '3.5', '5', '2']);
  });

  it('reads a score with no label at all', async () => {
    const { html } = await render(`::: rating\n3\n:::`);
    expect(row(html)).toBe('★★★☆☆');
    expect(labels(html)).toEqual([]);
    expect(readouts(html)).toEqual(['3']);
  });

  it('splits the label on the last colon, as the other data blocks do', async () => {
    const { html } = await render(`::: rating\nQ1: overall score: 5\n:::`);
    expect(labels(html)).toEqual(['Q1: overall score']);
  });

  it('scales to max', async () => {
    const { html } = await render(`::: rating max=10\nWould recommend: 8\n:::`);
    expect(row(html)).toBe('★★★★★★★★☆☆');
  });

  it('takes the icon it is asked for', async () => {
    for (const [icon, shape] of [['heart', '♥︎♥︎♡︎'], ['circle', '●●○'], ['square', '■■□']] as const) {
      const { html } = await render(`::: rating max=3 icon=${icon}\nScore: 2\n:::`);
      expect(row(html)).toBe(shape);
    }
  });

  it('hides the readout on values=false', async () => {
    const { html } = await render(`::: rating values=false\nOverall: 4\n:::`);
    expect(readouts(html)).toEqual([]);
    expect(row(html)).toBe('★★★★☆');
  });

  it('renders text above and below the scores', async () => {
    const { html } = await render(`::: rating\nBased on 1,284 reviews.\n\n- Comfort: 4\n\nRatings update nightly.\n:::`);
    expect(html).toContain('Based on 1,284 reviews.');
    expect(html).toContain('Ratings update nightly.');
    expect(labels(html)).toEqual(['Comfort']);
  });

  it('degrades a block with no number to regular text', async () => {
    const { html, warnings } = await render(`::: rating\nWe loved it.\n:::`, { warnings: true });
    expect(row(html)).toBe('');
    expect(html).toContain('We loved it.');
    expect(warnings.map((w) => w.message)).toContain(
      'Rating block has no numeric score — rendering its content as regular text.',
    );
  });

  it('skips list items carrying no number', async () => {
    const { html, warnings } = await render(`::: rating\n- Comfort: 4\n- Not rated yet\n:::`, { warnings: true });
    expect(labels(html)).toEqual(['Comfort']);
    expect(warnings.map((w) => w.message)).toContain('1 rating item had no number and was skipped.');
  });
});

describe('rating halves', () => {
  it('draws a half score as a filled glyph faded into the page', async () => {
    const { html } = await render(`::: rating\nOverall: 3.5\n:::`);
    // Three lit, one half-lit — still a filled star, not a hollow one — then
    // one unlit. The half takes a color between the lit one and the page.
    expect(row(html)).toBe('★★★★☆');
    expect(glyphs(html)).toEqual([
      '#d97706|★', '#d97706|★', '#d97706|★', '#ecbb83|★', '#71717a|☆',
    ]);
  });

  it('rounds to the nearest half', async () => {
    const { html } = await render(`::: rating\nOverall: 4.3\n:::`);
    expect(glyphs(html).map((g) => g.split('|')[0])).toEqual([
      '#d97706', '#d97706', '#d97706', '#d97706', '#ecbb83',
    ]);
  });

  it('rounds to whole glyphs on precision=full, keeping the exact readout', async () => {
    const { html } = await render(`::: rating precision=full\nOverall: 4.3\n:::`);
    expect(glyphs(html)).toEqual([
      '#d97706|★', '#d97706|★', '#d97706|★', '#d97706|★', '#71717a|☆',
    ]);
    expect(readouts(html)).toEqual(['4.3']);
  });

  it('falls back to a hollow lit glyph when the colors cannot be mixed', async () => {
    const { html } = await render(`::: rating color=rgb(220,38,38)\nOverall: 3.5\n:::`);
    expect(glyphs(html)[3]).toBe('rgb(220,38,38)|☆');
  });
});

describe('rating colors', () => {
  it('hooks the theme colors for dark mode and leaves an authored one alone', async () => {
    const { html } = await render(`::: rating max=2\nOverall: 1\n:::`);
    expect(hooks(html)).toEqual(['emd-rating-on-themed', 'emd-rating-off-themed']);

    const authored = await render(`::: rating max=2 color=#2563eb track=#e5e7eb\nOverall: 1\n:::`);
    expect(hooks(authored.html)).toEqual([]);
    expect(glyphs(authored.html)).toEqual(['#2563eb|★', '#e5e7eb|☆']);
  });

  it('keeps the half hook tied to the lit color alone', async () => {
    const themed = await render(`::: rating track=#e5e7eb\nOverall: 3.5\n:::`);
    expect(hooks(themed.html)).toContain('emd-rating-half-themed');

    const authored = await render(`::: rating color=#2563eb\nOverall: 3.5\n:::`);
    expect(hooks(authored.html)).not.toContain('emd-rating-half-themed');
  });

  it('carries a dark palette for the lit, half-lit and unlit glyphs', async () => {
    const { html } = await render(`---\ntheme: auto\n---\n\n::: rating\nOverall: 3.5\n:::`);
    expect(html).toContain('.emd-rating-on-themed { color: #d97706 !important; }');
    expect(html).toContain('.emd-rating-off-themed { color: #a1a1aa !important; }');
    // Faded into the dark page rather than the light one it was drawn against.
    expect(html).toContain('.emd-rating-half-themed { color: #794811 !important; }');
  });
});

describe('rating bounds', () => {
  it('clamps a score above the scale and says so', async () => {
    const { html, warnings } = await render(`::: rating\nOverall: 7\n:::`, { warnings: true });
    expect(row(html)).toBe('★★★★★');
    expect(readouts(html)).toEqual(['5']);
    expect(warnings.map((w) => w.message)).toContain(
      'Rating 7 for "Overall" is outside the 0–5 scale — clamping.',
    );
  });

  it('clamps a negative score to none lit', async () => {
    const { html } = await render(`::: rating\nOverall: -2\n:::`);
    expect(row(html)).toBe('☆☆☆☆☆');
  });

  it('rejects a scale that is not a whole number of glyphs', async () => {
    const { html, warnings } = await render(`::: rating max=0\nOverall: 3\n:::`, { warnings: true });
    expect(row(html)).toBe('★★★☆☆');
    expect(warnings.map((w) => w.message)).toContain(
      'Invalid max "0" for rating — expected a whole number from 1 to 10; using 5.',
    );
  });

  it('does not mistake a name off Object.prototype for an icon', async () => {
    const { html, warnings } = await render(`::: rating icon=constructor\nOverall: 3\n:::`, { warnings: true });
    expect(row(html)).toBe('★★★☆☆');
    expect(warnings.map((w) => w.message)).toContain(
      'Invalid icon "constructor" for rating — expected star, heart, circle, square; using star.',
    );
  });

  it('warns on an unknown icon, precision and size', async () => {
    const { warnings } = await render(
      `::: rating icon=triangle precision=quarter size=200\nOverall: 3\n:::`,
      { warnings: true },
    );
    const messages = warnings.map((w) => w.message);
    expect(messages).toContain('Invalid icon "triangle" for rating — expected star, heart, circle, square; using star.');
    expect(messages).toContain('Invalid precision "quarter" for rating — expected half or full; using half.');
    expect(messages).toContain('Invalid size "200" for rating — expected a whole number of pixels from 10 to 64; using 20.');
  });
});

describe('rating layout', () => {
  it('mirrors the row in a right-to-left document', async () => {
    const { html } = await render(`---\ndir: rtl\n---\n\n::: rating\nالتقييم: 4\n:::`);
    // The lit glyphs lead from the right, so the row reads inward from the edge.
    expect(row(html)).toBe('☆★★★★');
    // …and the readout keeps its gap on the side facing them.
    expect(html).toMatch(/class="emd-rating-value"[^>]*padding:0 7px /);
  });

  it('centres on two equal slack cells rather than one', async () => {
    const { html } = await render(`::: rating align=center\nOverall: 4\n:::`);
    expect([...html.matchAll(/<td width="50%"/g)]).toHaveLength(2);
  });
});

describe('rating plain text', () => {
  it('draws the same glyphs, with the scale spelled out', async () => {
    const { text } = await render(BREAKDOWN);
    expect(text).toContain('Comfort           ★★★★☆  4.5 / 5');
    expect(text).toContain('Value for money   ★★★☆☆  3.5 / 5');
    expect(text).toContain('Customer service  ★★★★★  5 / 5');
    expect(text).toContain('Noise             ★★☆☆☆  2 / 5');
  });

  it('drops the label column when nothing is labelled', async () => {
    const { text } = await render(`::: rating\n3\n:::`);
    expect(text).toContain('★★★☆☆  3 / 5');
  });

  it('follows the icon and the scale', async () => {
    const { text } = await render(`::: rating icon=circle max=3\nScore: 2\n:::`);
    expect(text).toContain('Score  ●●○  2 / 3');
  });

  it('drops the readout on values=false', async () => {
    const { text } = await render(`::: rating values=false\nOverall: 4\n:::`);
    expect(text).toContain('Overall  ★★★★☆');
    expect(text).not.toContain('/ 5');
  });
});
