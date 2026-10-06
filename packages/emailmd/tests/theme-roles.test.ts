import { describe, expect, it } from 'vitest';
import { render, lightTheme, darkTheme } from '../src/index.js';
import { rulesFor } from './helpers/css.js';

const has = (warnings: Array<{ message: string }> | undefined, text: string) =>
  warnings?.some((w) => w.message.includes(text)) ?? false;

/** Inline color of the first element carrying `cls`. */
function colorOf(html: string, cls: string): string | undefined {
  const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*?color:\\s?(#[0-9a-fA-F]{3,8})`);
  return re.exec(html)?.[1];
}

/** Background of the first bar cell carrying `cls`. */
function fillOf(html: string, cls: string): string | undefined {
  return new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*bgcolor="([^"]+)"`).exec(html)?.[1];
}

const DATA = `::: stats
- Revenue: $48,200 (+12%)
- Churn: 2.1% (+0.4pt) {good=down}
- Seats: 40 (+2) {good=neutral}
:::

::: chart
- Direct: 4,200
- Search: 3,100
:::

::: progress max=100
Quota: 72
:::

::: sparkline
Signups: 12, 19, 15, 27
:::

![Chart](https://example.com/c.png){caption="Weekly signups"}

::: footer
Acme · [Unsubscribe](https://example.com/u)
:::`;

describe('mutedColor', () => {
  it('falls back to bodyColor', async () => {
    const { html } = await render(DATA);
    expect(colorOf(html, 'emd-stat-label')).toBe(lightTheme.bodyColor);
    expect(colorOf(html, 'emd-chart-label')).toBe(lightTheme.bodyColor);
  });

  it('colors secondary text, and leaves body text alone', async () => {
    const { html, warnings } = await render(`---\nmuted_color: "#737373"\nbody_color: "#0a0a0a"\n---\nBody copy.\n\n${DATA}`);
    expect(warnings).toBeUndefined();
    for (const cls of ['emd-stat-label', 'emd-chart-label', 'emd-progress-label', 'emd-sparkline-label', 'emd-stat-delta-themed']) {
      expect(colorOf(html, cls)).toBe('#737373');
    }
    // Caption and footer are mj-text blocks: the class sits on the cell, the color on the div inside
    expect(html).toMatch(/class="emd-muted"[^>]*>\s*<div[^>]*color:#737373[^>]*>Weekly signups/);
    expect(html).toMatch(/class="emd-muted"[^>]*>\s*<div[^>]*color:#737373[^>]*>(?:<p>)?Acme/);
    expect(html).toMatch(/color:#0a0a0a[^>]*>\s*<p>Body copy/);
  });

  it('follows dark mode, falling back to the dark bodyColor', async () => {
    const custom = await render(`---\ntheme: auto\ndark:\n  muted_color: "#a3a3a3"\n---\n${DATA}`);
    expect(rulesFor(custom.html, '.emd-stat-label')[0]).toContain('color: #a3a3a3 !important');
    expect(rulesFor(custom.html, '.emd-s .emd-muted div')[0]).toContain('color: #a3a3a3 !important');
    expect(rulesFor(custom.html, '.emd-s .emd-muted div').some((r) => r.startsWith('[data-ogsc]'))).toBe(true);

    const fallback = await render(`---\ntheme: auto\n---\n${DATA}`);
    expect(rulesFor(fallback.html, '.emd-muted')[0]).toContain(`color: ${darkTheme.bodyColor} !important`);
  });

  it('leaves a footer given its own color= out of the muted class', async () => {
    const { html } = await render('::: footer color=#123456\nAcme\n:::');
    expect(html).not.toContain('emd-muted');
    expect(html).toContain('color:#123456');
  });

  it('drops an invalid value with a warning', async () => {
    const { html, warnings } = await render(`---\nmuted_color: "red; x"\n---\n${DATA}`);
    expect(has(warnings, 'mutedColor')).toBe(true);
    expect(colorOf(html, 'emd-stat-label')).toBe(lightTheme.bodyColor);
  });
});

describe('chartColors', () => {
  const PALETTE = '---\ntheme: auto\nbrand_color: "#171717"\nchart_colors: ["#2563eb", "#16a34a", "#d97706"]\n---\n';

  it('leaves bars on brandColor when unset', async () => {
    const { html } = await render(DATA);
    expect(fillOf(html, 'emd-chart-bar-themed')).toBe(lightTheme.brandColor);
  });

  it('makes the first color the default bar color', async () => {
    const { html, warnings } = await render(`${PALETTE}${DATA}`);
    expect(warnings).toBeUndefined();
    expect(fillOf(html, 'emd-chart-bar-themed')).toBe('#2563eb');
    expect(fillOf(html, 'emd-progress-bar-themed')).toBe('#2563eb');
    expect(fillOf(html, 'emd-sparkline-bar-themed')).toBe('#2563eb');
    expect(html).not.toMatch(/bgcolor="#171717"/);
  });

  it('accepts a comma-separated string, keeping rgb() whole', async () => {
    const { html, warnings } = await render('---\nchart_colors: "rgb(37, 99, 235), #16a34a"\n---\n::: chart color=chart-2\n- A: 1\n:::');
    expect(warnings).toBeUndefined();
    expect(fillOf(html, 'emd-c2-bg')).toBe('#16a34a');
  });

  it('lets directives name a palette entry, with a class dark mode follows', async () => {
    const md = `${PALETTE}::: chart color=chart-2
- Direct: 4,200
- Search: 3,100 {color=chart-3}
- Social: 640 {color=#ff0000}
:::

::: progress color=chart-3 max=100
Quota: 72
:::

::: sparkline color=chart-2
Signups: 12, 19, 15, 27
:::

::: stats color=chart-1
- Revenue: $48,200
- Churn: 2.1% {color=chart-3}
:::`;
    const { html, warnings } = await render(md);
    expect(warnings).toBeUndefined();
    const bars = [...html.matchAll(/class="(emd-chart-bar[^"]*)"[^>]*bgcolor="([^"]+)"/g)].map((m) => `${m[1]}|${m[2]}`);
    expect(bars).toEqual([
      'emd-chart-bar emd-c2-bg|#16a34a',
      'emd-chart-bar emd-c3-bg|#d97706',
      'emd-chart-bar|#ff0000',
    ]);
    expect(fillOf(html, 'emd-progress-bar')).toBe('#d97706');
    expect(html).toMatch(/class="emd-progress-bar emd-c3-bg"/);
    expect(html).toMatch(/class="emd-sparkline-bar emd-c2-bg"/);
    expect(html).toMatch(/class="emd-stat-value emd-c1"[^>]*color:#2563eb/);
    expect(html).toMatch(/class="emd-stat-value emd-c3"[^>]*color:#d97706/);
  });

  it('carries the light palette into dark mode unless dark sets its own', async () => {
    const inherited = await render(`${PALETTE}::: chart\n- A: 1\n:::`);
    expect(rulesFor(inherited.html, '.emd-chart-bar-themed')[0]).toContain('#2563eb');
    expect(rulesFor(inherited.html, '.emd-c2-bg')[0]).toContain('background-color: #16a34a !important');

    const own = await render(
      '---\ntheme: auto\nchart_colors: ["#2563eb", "#16a34a", "#d97706"]\ndark:\n  chart_colors: ["#60a5fa", "#4ade80"]\n---\n::: chart\n- A: 1\n:::',
    );
    expect(rulesFor(own.html, '.emd-chart-bar-themed')[0]).toContain('#60a5fa');
    expect(rulesFor(own.html, '.emd-c2-bg')[0]).toContain('#4ade80');
    expect(rulesFor(own.html, '.emd-c3-bg')).toHaveLength(0);
    expect(rulesFor(own.html, '.emd-s div.emd-c2')[0]).toContain('color: #4ade80 !important');
  });

  it('falls back with a warning for an entry the palette lacks', async () => {
    const short = await render(`${PALETTE}::: chart color=chart-7\n- A: 1\n:::`);
    expect(has(short.warnings, 'No chart color 7')).toBe(true);
    expect(fillOf(short.html, 'emd-chart-bar-themed')).toBe('#2563eb');

    const none = await render('::: progress color=chart-1 max=10\nA: 5\n:::');
    expect(has(none.warnings, 'no chart_colors')).toBe(true);
    expect(fillOf(none.html, 'emd-progress-bar-themed')).toBe(lightTheme.brandColor);
  });

  it('replaces an invalid entry without shifting the ones after it', async () => {
    const { html, warnings } = await render('---\nchart_colors: ["#2563eb", "nope;", "#d97706"]\n---\n::: chart color=chart-3\n- A: 1\n:::');
    expect(has(warnings, 'Invalid chart color 2')).toBe(true);
    expect(fillOf(html, 'emd-c3-bg')).toBe('#d97706');
  });

  it('is accepted from RenderOptions', async () => {
    const { html } = await render('::: chart\n- A: 1\n:::', { theme: { chartColors: ['#0ea5e9'] } });
    expect(fillOf(html, 'emd-chart-bar-themed')).toBe('#0ea5e9');
  });
});

describe('positiveColor / negativeColor', () => {
  it('fall back to the success and danger colors', async () => {
    const { html } = await render(DATA);
    expect(colorOf(html, 'emd-good')).toBe(lightTheme.successColor);
    expect(colorOf(html, 'emd-bad')).toBe(lightTheme.dangerColor);
  });

  it('color a change by its tone, apart from the button fills', async () => {
    const md = `---\ntheme: auto\npositive_color: "#15803d"\nnegative_color: "#b91c1c"\ndark:\n  positive_color: "#4ade80"\n---\n${DATA}\n\n::: sparkline good=down\nErrors: 30, 20, 25, 10\n:::`;
    const { html, warnings } = await render(md);
    expect(warnings).toBeUndefined();
    expect(html).toMatch(/class="emd-stat-delta emd-good"[^>]*color:#15803d/);
    expect(html).toMatch(/class="emd-stat-delta emd-bad"[^>]*color:#b91c1c/);
    expect(html).toMatch(/class="emd-sparkline-delta emd-good"[^>]*color:#15803d/);
    expect(html).toMatch(/class="emd-stat-delta emd-stat-delta-themed"/);
    // Success buttons are untouched
    expect(lightTheme.successColor).not.toBe('#15803d');
    // Dark: the override, and the dark danger color as the fallback
    expect(rulesFor(html, '.emd-good')[0]).toContain('color: #4ade80 !important');
    expect(rulesFor(html, '.emd-bad')[0]).toContain(`color: ${darkTheme.dangerColor} !important`);
  });
});

describe('oklch() and hsl() theme values', () => {
  it('are written as hex, in light and dark themes and the chart palette', async () => {
    const md = `---
theme: auto
brand_color: "oklch(0.205 0 0)"
body_color: "hsl(0 0% 9%)"
muted_color: "oklch(0.556 0 0)"
chart_colors: ["oklch(0.646 0.222 41.116)", "hsl(221.2 83.2% 53.3%)"]
dark:
  content_color: "oklch(0.205 0 0)"
  button_color: "oklch(0.922 0 0)"
---
Hi.

::: chart color=chart-2
- A: 1
:::

::: stats
- Seats: 40
:::

[Go](https://x.com){button}`;
    const { html, warnings } = await render(md);
    expect(warnings).toBeUndefined();
    expect(html).not.toMatch(/oklch|hsl\(/i);
    expect(html).toContain('a { color: #171717; }');
    expect(colorOf(html, 'emd-stat-label')).toBe('#737373');
    expect(fillOf(html, 'emd-c2-bg')).toBe('#2563eb');
    expect(rulesFor(html, '.emd-bg')[0]).toContain('#171717');
    expect(rulesFor(html, '.emd-btn.emd-btn-primary td')[0]).toContain('#e5e5e5');
  });

  it('keeps translucency as rgba()', async () => {
    const { html, warnings } = await render('---\ntheme: auto\ndark:\n  divider_color: "oklch(1 0 0 / 10%)"\n---\n---\n');
    expect(warnings).toBeUndefined();
    expect(html).toContain('rgba(255, 255, 255, 0.1)');
  });

  it('are accepted from RenderOptions', async () => {
    const { html } = await render('[Go](https://x.com){button}', { theme: { buttonColor: 'oklch(0.205 0 0)' } });
    expect(html).toContain('background:#171717');
  });
});
