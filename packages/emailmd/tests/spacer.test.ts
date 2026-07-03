import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

describe('spacer directive', () => {
  it('renders default 24px spacer without a closing fence', async () => {
    const { html } = await render('Above\n\n::: spacer\n\nBelow');
    expect(html).toContain('Above');
    expect(html).toContain('Below');
    expect(html).toContain('height:24px');
    expect(html).not.toContain('EMAILMD');
  });

  it('renders custom height (bare number = px)', async () => {
    const { html } = await render('Above\n\n::: spacer 48\n\nBelow');
    expect(html).toContain('height:48px');
  });

  it('accepts explicit units', async () => {
    const { html } = await render('A\n\n::: spacer 2em\n\nB');
    expect(html).toContain('height:2em');
  });

  it('warns and falls back on invalid height', async () => {
    const { html, warnings } = await render('A\n\n::: spacer banana\n\nB');
    expect(html).toContain('height:24px');
    expect(warnings.some((w) => w.message.includes('Invalid height'))).toBe(true);
  });

  it('works inside columns cells', async () => {
    const { html } = await render(
      ':::: columns\n::: column\nTop\n\n::: spacer 40\n\nBottom\n:::\n::: column\nOther\n:::\n::::',
    );
    expect(html).toContain('height:40px');
    expect(html).toContain('Top');
    expect(html).toContain('Bottom');
    expect(html).not.toContain('EMAILMD');
  });

  it('can interrupt a paragraph', async () => {
    const { html } = await render('Line one\n::: spacer 32\nLine two');
    expect(html).toContain('height:32px');
    expect(html).toContain('Line one');
    expect(html).toContain('Line two');
  });

  it('leaves no trace in plain text output', async () => {
    const { text } = await render('Above\n\n::: spacer 48\n\nBelow');
    expect(text).toContain('Above');
    expect(text).toContain('Below');
    expect(text).not.toContain('spacer');
    expect(text).not.toContain('EMAILMD');
  });
});
