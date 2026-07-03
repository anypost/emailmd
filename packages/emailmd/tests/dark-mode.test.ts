import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

const DOC = '# Hello\n\nSome body text.\n\n::: callout\nNote\n:::';

describe('dark mode', () => {
  it('is off by default', async () => {
    const { html } = await render(DOC);
    expect(html).not.toContain('prefers-color-scheme');
    expect(html).not.toContain('color-scheme');
  });

  it('theme: auto renders light with dark-mode overrides', async () => {
    const { html, warnings } = await render(`---\ntheme: auto\n---\n${DOC}`);
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('[data-ogsc]');
    expect(html).toContain('[data-ogsb]');
    expect(html).toContain('name="color-scheme"');
    expect(html).toContain('name="supported-color-schemes"');
    // Static render stays light; dark palette appears in the overrides
    expect(html).toContain('#ffffff');
    expect(html).toContain('#09090b');
    // auto is a valid theme value — no unknown-theme warning
    expect(warnings?.some((w) => w.message.includes('Unknown theme'))).toBeFalsy();
  });

  it('emits stable emd-* class hooks on rendered elements', async () => {
    const { html } = await render(`---\ntheme: auto\n---\n${DOC}`);
    expect(html).toContain('emd-root');
    expect(html).toContain('emd-s');
    expect(html).toContain('emd-bg');
    expect(html).toContain('emd-card');
  });

  it('a bare dark: override map implies theme: auto', async () => {
    const { html } = await render(`---\ndark:\n  background_color: "#111827"\n---\n${DOC}`);
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('#111827');
    // Other keys still come from the built-in dark palette
    expect(html).toContain('#18181b');
  });

  it('theme: auto combines with dark: overrides', async () => {
    const { html } = await render(
      `---\ntheme: auto\ndark:\n  brand_color: "#22d3ee"\n---\n${DOC}`,
    );
    expect(html).toContain('prefers-color-scheme');
    expect(html).toContain('#22d3ee');
  });

  it('enables via RenderOptions.darkTheme', async () => {
    const viaTrue = await render(DOC, { darkTheme: true });
    expect(viaTrue.html).toContain('prefers-color-scheme');

    const viaPartial = await render(DOC, { darkTheme: { brandColor: '#22d3ee' } });
    expect(viaPartial.html).toContain('#22d3ee');
  });

  it('a pinned theme renders static even when the app enables dark mode', async () => {
    const pinnedLight = await render(`---\ntheme: light\n---\n${DOC}`, { darkTheme: true });
    expect(pinnedLight.html).not.toContain('prefers-color-scheme');

    const pinnedDark = await render(`---\ntheme: dark\n---\n${DOC}`, { darkTheme: true });
    expect(pinnedDark.html).not.toContain('prefers-color-scheme');
  });

  it('warns when dark: overrides are combined with a pinned theme', async () => {
    const { html, warnings } = await render(
      `---\ntheme: dark\ndark:\n  brand_color: "#22d3ee"\n---\n${DOC}`,
    );
    expect(html).not.toContain('prefers-color-scheme');
    expect(warnings?.some((w) => w.message.includes('pinned'))).toBe(true);
  });

  it('warns on boolean dark: frontmatter and stays off', async () => {
    const { html, warnings } = await render(`---\ndark: true\n---\n${DOC}`);
    expect(warnings?.some((w) => w.message.includes('theme: auto'))).toBe(true);
    expect(html).not.toContain('prefers-color-scheme');
  });

  it('sanitizes context-breaking dark theme values', async () => {
    const { html, warnings } = await render(
      `---\ndark:\n  body_color: red"><script>alert(1)</script>\n---\n${DOC}`,
    );
    expect(html).not.toContain('<script>');
    expect(warnings?.some((w) => w.message.includes('Invalid theme value'))).toBe(true);
  });
});
