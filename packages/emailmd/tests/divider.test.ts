import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

describe('divider directive', () => {
  it('renders a styled divider with custom color', async () => {
    const { html } = await render('Above\n\n::: divider color=#dc2626\n\nBelow');
    expect(html).toContain('border-top:solid 1px #dc2626');
    expect(html).not.toContain('EMAILMD');
  });

  it('supports thickness and width', async () => {
    const { html } = await render('A\n\n::: divider thickness=3 width=50%\n\nB');
    expect(html).toContain('border-top:solid 3px');
    expect(html).toContain('width:50%');
  });

  it('supports alignment', async () => {
    const { html } = await render('A\n\n::: divider width=40% left\n\nB');
    expect(html).toMatch(/margin:0px(?! auto)/);
  });

  it('plain --- uses the dividerColor theme key', async () => {
    const { html } = await render('---\ndivider_color: "#00ff00"\n---\nAbove\n\n***\n\nBelow');
    expect(html).toContain('border-top:solid 1px #00ff00');
  });

  it('warns on invalid divider color', async () => {
    const { warnings } = await render('A\n\n::: divider color=#zzz\n\nB');
    expect(warnings.some((w) => w.message.includes('Invalid color'))).toBe(true);
  });

  it('works inside columns cells', async () => {
    const { html } = await render(
      ':::: columns\n::: column\nTop\n\n::: divider color=#0000ff\n\nBottom\n:::\n::: column\nOther\n:::\n::::',
    );
    expect(html).toContain('#0000ff');
    expect(html).not.toContain('EMAILMD');
  });

  it('reads as a rule in plain text', async () => {
    const { text } = await render('Above\n\n::: divider color=#dc2626\n\nBelow');
    expect(text).toContain('---');
    expect(text).not.toContain('EMAILMD');
    expect(text).not.toContain('dc2626');
  });
});
