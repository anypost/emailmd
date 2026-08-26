import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const GOAL = `::: progress max=10,000
Raised so far: 8,400
:::`;

/** Widths of the fill cells, in document order. */
function fillWidths(html: string): string[] {
  return [...html.matchAll(/class="emd-progress-bar[^"]*"[^>]*width="([^"]*)"/g)].map((m) => m[1]);
}

/** Widths of the groove cells, in document order. */
function trackWidths(html: string): string[] {
  return [...html.matchAll(/class="emd-progress-track[^"]*"[^>]*width="([^"]*)"/g)].map((m) => m[1]);
}

describe('progress directive', () => {
  it('draws a bar and a readout against an explicit max', async () => {
    const { html, warnings } = await render(GOAL);
    expect(warnings).toBeUndefined();
    expect(fillWidths(html)).toEqual(['84%']);
    expect(trackWidths(html)).toEqual(['16%']);
    expect(html).toContain('Raised so far');
    expect(html).toContain('8,400 / 10,000');
  });

  it('scales a bare number against 100', async () => {
    const { html } = await render(`::: progress
Profile complete: 72
:::`);
    expect(fillWidths(html)).toEqual(['72%']);
    // The readout prints the value as authored, with no denominator to add.
    expect(html).toContain('>72<');
  });

  it('takes a percentage as written', async () => {
    const { html } = await render(`::: progress
Profile complete: 72%
:::`);
    expect(fillWidths(html)).toEqual(['72%']);
    expect(html).toContain('72%');
  });

  it('accepts a bare value with no label', async () => {
    const { html } = await render(`::: progress
64%
:::`);
    expect(fillWidths(html)).toEqual(['64%']);
    expect(html).toContain('64%');
  });

  it('clamps a value past the max to a full bar', async () => {
    const { html } = await render(`::: progress max=100
Overachieving: 140
:::`);
    expect(fillWidths(html)).toEqual(['100%']);
    expect(trackWidths(html)).toEqual([]);
  });

  it('shows an empty track at zero', async () => {
    const { html } = await render(`::: progress
Nothing yet: 0
:::`);
    expect(fillWidths(html)).toEqual([]);
    expect(trackWidths(html)).toEqual(['100%']);
  });

  it('always shows the groove, unlike a chart bar at its maximum', async () => {
    const { html } = await render(`::: progress max=10,000
Raised so far: 8,400
:::`);
    expect(html).toContain('emd-progress-track');
  });

  it('warns and scales to 100 for an unusable max', async () => {
    const { html, warnings } = await render(`::: progress max=nope
Halfway: 50
:::`);
    expect(fillWidths(html)).toEqual(['50%']);
    expect(warnings?.some((w) => w.message.includes('max'))).toBe(true);
  });

  it('hides the readout with values=false', async () => {
    const { html } = await render(`::: progress values=false
Onboarding: 40%
:::`);
    expect(html).not.toContain('emd-progress-value');
    expect(html).toContain('Onboarding');
    expect(fillWidths(html)).toEqual(['40%']);
  });

  it('applies color and track params', async () => {
    const { html } = await render(`::: progress color=#2563eb track=#e4e4e7
Halfway: 50
:::`);
    expect(html).toContain('background-color:#2563eb');
    expect(html).toContain('background-color:#e4e4e7');
    // An explicit color opts out of dark-mode recoloring.
    expect(html).not.toContain('emd-progress-bar-themed');
  });

  it('falls back to the theme color for an invalid color', async () => {
    const { html, warnings } = await render(`::: progress color=javascript:alert(1)
Halfway: 50
:::`);
    expect(html).not.toContain('javascript:alert');
    expect(warnings?.some((w) => w.message.includes('progress color'))).toBe(true);
  });

  it('renders trailing content below the bar', async () => {
    const { html } = await render(`::: progress
Storage used: 91%
You're close to your plan limit.
:::`);
    const barIdx = html.indexOf('emd-progress-bar');
    const noteIdx = html.indexOf('close to your plan limit');
    expect(noteIdx).toBeGreaterThan(barIdx);
    // The commentary must not be read as part of the value.
    expect(html).not.toContain('plan limit. /');
  });

  it('degrades to regular text with a warning when there is no value', async () => {
    const { html, warnings } = await render(`::: progress
Just a note, no number.
:::`);
    expect(html).toContain('Just a note, no number.');
    expect(html).not.toContain('emd-progress-bar');
    expect(warnings?.some((w) => w.message.includes('Progress'))).toBe(true);
  });

  it('strips tags from the label and leaks no markers', async () => {
    const { html } = await render(`::: progress
Sneaky <img src=x onerror=alert(1)>: 50
:::`);
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('EMAILMD:PROGRESS');
  });

  it('mirrors the caption and bar growth in RTL documents', async () => {
    const { html } = await render(`---
dir: rtl
---
::: progress max=10,000
Raised so far: 8,400
:::`);
    expect(html).toMatch(/emd-progress-value[\s\S]*?emd-progress-label/);
    expect(html).toMatch(/emd-progress-track[\s\S]*?emd-progress-bar/);
  });

  it('emits dark-mode rules for themed bars only', async () => {
    const { html } = await render(`---
theme: auto
---
${GOAL}`);
    expect(html).toContain('.emd-progress-bar-themed');
    expect(html).toContain('.emd-progress-track-themed');
    expect(html).toContain('.emd-progress-label');
  });

  it('takes a height and derives a pill radius from it', async () => {
    const { html } = await render(`::: progress height=14
Halfway: 50
:::`);
    expect(html).toContain('height:14px');
    expect(html).toContain('border-radius:7px 0 0 7px');
  });

  it('squares the bar with border-radius=0', async () => {
    const { html } = await render(`::: progress border-radius=0
Halfway: 50
:::`);
    expect(html).not.toMatch(/emd-progress-(?:bar|track)[^>]*border-radius/);
  });
});

describe('progress steps', () => {
  it('draws one segment per step and fills the completed ones', async () => {
    const { html, warnings } = await render(`::: progress steps=4
Account setup: 2
:::`);
    expect(warnings).toBeUndefined();
    expect(fillWidths(html)).toEqual(['100%', '100%']);
    expect(trackWidths(html)).toEqual(['100%', '100%']);
    expect(html).toContain('2 / 4');
  });

  it('reverses the segment order in RTL so step one sits on the right', async () => {
    const { html } = await render(`---
dir: rtl
---
::: progress steps=4
Account setup: 2
:::`);
    // Grooves come first in the DOM, so the filled steps land on the right.
    expect(html).toMatch(/emd-progress-track[\s\S]*?emd-progress-bar/);
    expect(html).not.toMatch(/emd-progress-bar[\s\S]*?emd-progress-track/);
  });

  it('clamps a value past the step count', async () => {
    const { html } = await render(`::: progress steps=3
Done: 9
:::`);
    expect(fillWidths(html)).toHaveLength(3);
    expect(html).toContain('3 / 3');
  });

  it('warns and draws one continuous bar for an out-of-range step count', async () => {
    const { html, warnings } = await render(`::: progress steps=40
Halfway: 50
:::`);
    expect(warnings?.some((w) => w.message.includes('steps'))).toBe(true);
    expect(fillWidths(html)).toEqual(['50%']);
  });

  it('warns for a fractional step count', async () => {
    const { warnings } = await render(`::: progress steps=2.5
Halfway: 50
:::`);
    expect(warnings?.some((w) => w.message.includes('steps'))).toBe(true);
  });
});

describe('progress plain text', () => {
  it('draws the filled and empty parts of the track', async () => {
    const { text } = await render(GOAL);
    const bar = text.split('\n').find((l) => l.includes('█'))!;
    expect((bar.match(/█/g) ?? []).length).toBe(20);
    expect((bar.match(/░/g) ?? []).length).toBe(4);
    expect(bar).toContain('8,400 / 10,000');
  });

  it('puts the label on its own line above the bar', async () => {
    const { text } = await render(GOAL);
    const lines = text.split('\n');
    const barIdx = lines.findIndex((l) => l.includes('█'));
    expect(lines[barIdx - 1]).toBe('Raised so far');
    // The authored "Label: value" line is not repeated beside the meter.
    expect(text).not.toContain('Raised so far: 8,400');
  });

  it('draws stepped meters as separated groups', async () => {
    const { text } = await render(`::: progress steps=4
Account setup: 2
:::`);
    const bar = text.split('\n').find((l) => l.includes('█'))!;
    expect(bar).toContain('██████ ██████ ░░░░░░ ░░░░░░');
    expect(bar).toContain('2 / 4');
  });

  it('keeps trailing content after the meter', async () => {
    const { text } = await render(`::: progress
Storage used: 91%
You're close to your plan limit.
:::`);
    const lines = text.split('\n');
    const barIdx = lines.findIndex((l) => l.includes('█'));
    expect(text.indexOf('close to your plan limit')).toBeGreaterThan(text.indexOf(lines[barIdx]));
    expect(text).not.toContain('EMAILMD');
  });

  it('falls back to plain text when there is no value', async () => {
    const { text } = await render(`::: progress
Just a note, no number.
:::`);
    expect(text).toContain('Just a note, no number.');
    expect(text).not.toContain('█');
  });
});
