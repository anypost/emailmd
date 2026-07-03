import { describe, it, expect } from 'vitest';
import { extractFrontmatter, frontmatterToThemeOverrides, render, darkTheme } from '../src/index.js';

describe('extractFrontmatter', async () => {
  it('extracts frontmatter and content', async () => {
    const input = `---
preheader: Hello
---

# Title`;
    const { meta, content } = extractFrontmatter(input);
    expect(meta.preheader).toBe('Hello');
    expect(content.trim()).toBe('# Title');
  });

  it('returns empty meta for markdown without frontmatter', async () => {
    const { meta, content } = extractFrontmatter('# Just markdown');
    expect(meta).toEqual({});
    expect(content.trim()).toBe('# Just markdown');
  });

  it('returns empty meta and an error when frontmatter contains invalid YAML', async () => {
    const input = `---
button_text_color: "#09090b":smiley::100::grin:
---

# Title`;
    const { meta, content, error } = extractFrontmatter(input);
    expect(meta).toEqual({});
    expect(content.trim()).toBe('# Title');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('frontmatterToThemeOverrides', async () => {
  it('converts snake_case keys to camelCase theme overrides', async () => {
    const meta = { button_color: '#FF0000', preheader: 'test' };
    const overrides = frontmatterToThemeOverrides(meta);
    expect(overrides).toEqual({ buttonColor: '#FF0000' });
  });

  it('converts multiple theme keys', async () => {
    const meta = {
      background_color: '#000',
      button_text_color: '#FFF',
      font_family: 'Georgia',
    };
    const overrides = frontmatterToThemeOverrides(meta);
    expect(overrides).toEqual({
      backgroundColor: '#000',
      buttonTextColor: '#FFF',
      fontFamily: 'Georgia',
    });
  });

  it('maps button_color to buttonColor theme override', async () => {
    const meta = { button_color: '#dc2626' };
    const overrides = frontmatterToThemeOverrides(meta);
    expect(overrides.buttonColor).toBe('#dc2626');
  });

  it('converts button variant color keys', async () => {
    const meta = {
      secondary_color: '#6366f1',
      secondary_text_color: '#312e81',
      success_color: '#059669',
      success_text_color: '#000000',
      danger_color: '#b91c1c',
      danger_text_color: '#000000',
      warning_color: '#b45309',
      warning_text_color: '#000000',
    };
    const overrides = frontmatterToThemeOverrides(meta);
    expect(overrides).toEqual({
      secondaryColor: '#6366f1',
      secondaryTextColor: '#312e81',
      successColor: '#059669',
      successTextColor: '#000000',
      dangerColor: '#b91c1c',
      dangerTextColor: '#000000',
      warningColor: '#b45309',
      warningTextColor: '#000000',
    });
  });

  it('converts border_radius to borderRadius', async () => {
    const meta = { border_radius: '12px' };
    const overrides = frontmatterToThemeOverrides(meta);
    expect(overrides).toEqual({ borderRadius: '12px' });
  });

  it('ignores unknown keys', async () => {
    const meta = { preheader: 'text', unknown_key: 'value' };
    const overrides = frontmatterToThemeOverrides(meta);
    expect(overrides).toEqual({});
  });
});

describe('numeric theme lengths', async () => {
  it('appends px to unitless border_radius, font_size and content_width', async () => {
    const md = `---\nborder_radius: 14\nfont_size: 15\ncontent_width: 640\n---\n\n::: callout\nHi\n:::`;
    const { html, warnings } = await render(md);
    expect(warnings).toBeUndefined();
    expect(html).toMatch(/border-radius:\s*14px/);
    expect(html).toMatch(/font-size:\s*15px/);
    expect(html).toMatch(/640px/);
    // The old behavior emitted the bare number, which clients drop as invalid CSS.
    expect(html).not.toMatch(/border-radius:\s*14[^p]/);
  });

  it('keeps numeric line_height unitless', async () => {
    const { html } = await render(`---\nline_height: 1.8\n---\n\nHello`);
    expect(html).toMatch(/line-height:\s*1.8/);
  });
});

describe('render() warnings', async () => {
  it('surfaces invalid frontmatter as a warning without throwing', async () => {
    const input = `---
button_text_color: "#09090b":smiley::100::grin:
---

# Title`;
    const result = await render(input);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].stage).toBe('frontmatter');
    expect(result.warnings?.[0].cause).toBeInstanceOf(Error);
    expect(result.html).toContain('Title');
  });

  it('omits warnings when frontmatter parses cleanly', async () => {
    const result = await render(`---\npreheader: Hi\n---\n\n# Ok`);
    expect(result.warnings).toBeUndefined();
  });
});

describe('theme frontmatter shortcut', async () => {
  it('applies dark theme via theme: dark in frontmatter', async () => {
    const { html } = await render(`---\ntheme: dark\n---\n\n# Hello`);
    expect(html).toContain(darkTheme.backgroundColor);
    expect(html).toContain(darkTheme.contentColor);
  });

  it('allows individual overrides on top of theme: dark', async () => {
    const { html } = await render(`---\ntheme: dark\nbrand_color: "#e11d48"\n---\n\n# Hello`);
    expect(html).toContain(darkTheme.backgroundColor);
    expect(html).toContain('#e11d48');
  });
});

describe('lang and dir frontmatter', async () => {
  it('emits lang and dir on the html tag', async () => {
    const { html, warnings } = await render(`---\nlang: ar\ndir: rtl\n---\n\n# Hello`);
    expect(html).toMatch(/<html[^>]* lang="ar"/);
    expect(html).toMatch(/<html[^>]* dir="rtl"/);
    expect(warnings).toBeUndefined();
  });

  it('accepts region subtags', async () => {
    const { html } = await render(`---\nlang: pt-BR\n---\n\n# Olá`);
    expect(html).toMatch(/<html[^>]* lang="pt-BR"/);
  });

  it('falls back to MJML defaults (lang="und" dir="auto") when unset', async () => {
    const { html } = await render('# Hello');
    expect(html).toMatch(/<html[^>]* lang="und"/);
    expect(html).toMatch(/<html[^>]* dir="auto"/);
  });

  it('warns on an invalid lang and falls back to the default', async () => {
    const { html, warnings } = await render(`---\nlang: 'en"><script>'\n---\n\n# Hello`);
    expect(warnings?.[0].stage).toBe('frontmatter');
    expect(warnings?.[0].message).toContain('lang');
    expect(html).not.toContain('<script>');
    expect(html).toMatch(/<html[^>]* lang="und"/);
  });

  it('warns on an invalid dir and falls back to the default', async () => {
    const { warnings, html } = await render(`---\ndir: sideways\n---\n\n# Hello`);
    expect(warnings?.[0].message).toContain('dir');
    expect(html).toMatch(/<html[^>]* dir="auto"/);
  });
});

describe('hard line breaks', async () => {
  const TWO_LINES = 'line one\nline two';

  it('keeps standard markdown behavior by default', async () => {
    const { html } = await render(TWO_LINES);
    expect(html).not.toMatch(/line one<br/);
  });

  it('renders single newlines as <br> with the breaks option', async () => {
    const { html } = await render(TWO_LINES, { breaks: true });
    expect(html).toMatch(/line one<br/);
  });

  it('enables breaks via frontmatter', async () => {
    const { html } = await render(`---\nbreaks: true\n---\n\n${TWO_LINES}`);
    expect(html).toMatch(/line one<br/);
  });

  it('frontmatter breaks: false overrides the render option', async () => {
    const { html } = await render(`---\nbreaks: false\n---\n\n${TWO_LINES}`, { breaks: true });
    expect(html).not.toMatch(/line one<br/);
  });

  it('does not leak the setting into the next render', async () => {
    await render(TWO_LINES, { breaks: true });
    const { html } = await render(TWO_LINES);
    expect(html).not.toMatch(/line one<br/);
  });

  it('warns on a non-boolean breaks value', async () => {
    const { warnings } = await render(`---\nbreaks: sometimes\n---\n\n# Hi`);
    expect(warnings?.[0].stage).toBe('frontmatter');
    expect(warnings?.[0].message).toContain('breaks');
  });
});

describe('rtl rendering', async () => {
  const RTL_DOC = `---
dir: rtl
---

مرحبا بكم

> اقتباس

::: callout
ملاحظة
:::

- بند واحد`;

  it('flips the default text alignment to right', async () => {
    const { html } = await render(RTL_DOC);
    expect(html).toMatch(/text-align:right[^>]*>\s*<p>مرحبا/);
  });

  it('flips directive default alignment', async () => {
    const { html } = await render(RTL_DOC);
    expect(html).toMatch(/text-align:right[^>]*>\s*<p[^>]*>ملاحظة/);
  });

  it('flips blockquote bars and list indents', async () => {
    const { html } = await render(RTL_DOC);
    expect(html).toMatch(/border-right:\s*3px solid/);
    expect(html).toMatch(/padding-right:\s*24px/);
  });

  it('keeps explicit alignment overrides', async () => {
    const md = `---\ndir: rtl\n---\n\n::: callout center\nوسط\n:::`;
    const { html } = await render(md);
    expect(html).toMatch(/text-align:center[^>]*>\s*<p[^>]*>وسط/);
  });

  it('does not flip ltr documents', async () => {
    const { html } = await render('Hello\n\n> quote');
    expect(html).toMatch(/border-left:\s*3px solid/);
    expect(html).not.toMatch(/text-align:right[^>]*>\s*<p>Hello/);
  });
});
