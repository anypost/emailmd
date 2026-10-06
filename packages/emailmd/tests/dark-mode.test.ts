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

describe('dark mode buttons', () => {
  /** shadcn neutral: the button flips from near-black to near-white. */
  const LIGHT = { buttonColor: '#171717', buttonTextColor: '#fafafa' };
  const DARK = { buttonColor: '#e5e5e5', buttonTextColor: '#171717', contentColor: '#171717', brandColor: '#e5e5e5' };

  /**
   * Every CSS rule whose selector list names `selector`, bare or behind an
   * Outlook.com prefix, as `<matched selector> {<declarations>}`.
   */
  function rulesFor(html: string, selector: string): string[] {
    const out: string[] = [];
    for (const [, selectors, body] of html.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of selectors.split(',').map((s) => s.trim())) {
        if (sel === selector || sel.replace(/^\[data-og[sbc]+\] /, '') === selector) out.push(`${sel} {${body}}`);
      }
    }
    return out;
  }

  it('repaints a themed button so it stays visible in both schemes', async () => {
    const { html } = await render('[Go](https://x.com){button}', { theme: LIGHT, darkTheme: DARK });
    // Light: as written
    expect(html).toMatch(/class="emd-btn emd-btn-primary"/);
    expect(html).toMatch(/bgcolor="#171717"[^>]*background:#171717/);
    expect(html).toMatch(/background:#171717;color:#fafafa/);
    // Dark: fill and text from the dark theme, under the media query and both Outlook.com prefixes
    const fills = rulesFor(html, '.emd-btn.emd-btn-primary td');
    expect(fills).toHaveLength(2);
    expect(fills.every((r) => r.includes('background-color: #e5e5e5 !important'))).toBe(true);
    expect(fills.some((r) => r.startsWith('[data-ogsb]'))).toBe(true);
    const text = rulesFor(html, '.emd-btn.emd-btn-primary a').filter((r) => r.includes(' color:'));
    expect(text).toHaveLength(2);
    expect(text.every((r) => r.includes('color: #171717 !important'))).toBe(true);
    expect(text.some((r) => r.startsWith('[data-ogsc]'))).toBe(true);
  });

  it('outranks the link rule on button text', async () => {
    const { html } = await render('[Go](https://x.com){button}', { theme: LIGHT, darkTheme: DARK });
    const media = html.slice(html.indexOf('@media (prefers-color-scheme: dark)'));
    // .emd-btn.emd-btn-primary a is (0,2,1) and beats .emd-s div a (0,1,2) on
    // specificity; it also comes later, so it would win on order alone.
    expect(media.indexOf('.emd-btn.emd-btn-primary a { color')).toBeGreaterThan(media.indexOf('.emd-s div a {'));
  });

  it('gives every variant its dark colors', async () => {
    const md = [
      '[A](https://x.com){button.secondary}',
      '[B](https://x.com){button.success}',
      '[C](https://x.com){button.danger}',
      '[D](https://x.com){button.warning}',
    ].join('\n\n');
    const dark = { secondaryColor: '#111111', secondaryTextColor: '#222222', successColor: '#333333', dangerColor: '#444444', warningColor: '#555555' };
    const { html } = await render(md, { darkTheme: dark });
    for (const name of ['secondary', 'success', 'danger', 'warning']) {
      expect(html).toContain(`class="emd-btn emd-btn-${name}"`);
    }
    expect(rulesFor(html, '.emd-btn.emd-btn-secondary td')[0]).toContain('border-color: #111111 !important');
    expect(rulesFor(html, '.emd-btn.emd-btn-secondary a')[0]).toContain('color: #222222 !important');
    expect(rulesFor(html, '.emd-btn.emd-btn-success td')[0]).toContain('#333333');
    expect(rulesFor(html, '.emd-btn.emd-btn-danger td')[0]).toContain('#444444');
    expect(rulesFor(html, '.emd-btn.emd-btn-warning td')[0]).toContain('#555555');
  });

  it('keeps an explicitly colored button as written, text included', async () => {
    const { html } = await render('[Go](https://x.com){button color=#7c3aed}', { darkTheme: true });
    expect(html).toContain('class="emd-btn emd-btn-custom"');
    expect(rulesFor(html, '.emd-btn.emd-btn-custom td')).toHaveLength(0);
    expect(rulesFor(html, '.emd-btn.emd-btn-custom a')[0]).toContain('color: #ffffff !important');
    expect(html).not.toContain('#7c3aed !important');
  });

  it('covers buttons in groups and columns', async () => {
    const { html } = await render(
      '[A](https://x.com){button} [B](https://y.com){button.secondary}\n\n::: columns\n[C](https://z.com){button}\n:::',
      { darkTheme: true },
    );
    expect(html.match(/class="emd-btn emd-btn-primary"/g)?.length).toBe(2);
    expect(html).toContain('class="emd-btn emd-btn-secondary"');
  });
});
