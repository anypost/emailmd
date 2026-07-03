import { describe, it, expect } from 'vitest';
import { render, expandPartials } from '../src/index.js';
import type { RenderWarning } from '../src/warnings.js';

describe('partials', async () => {
  it('splices a partial into the document', async () => {
    const { html, warnings } = await render('# Hi\n\n::: include signoff', {
      partials: { signoff: 'Cheers,\n**The Acme Team**' },
    });
    expect(html).toContain('The Acme Team');
    expect(warnings).toBeUndefined();
  });

  it('renders directives inside a partial', async () => {
    const { html } = await render('# Hi\n\n::: include legal', {
      partials: { legal: '::: footer\n**Acme Inc.** · [Unsubscribe](https://example.com/u)\n:::' },
    });
    expect(html).toContain('Acme Inc.');
    expect(html).toContain('https://example.com/u');
  });

  it('includes partial content in the plaintext output', async () => {
    const { text } = await render('# Hi\n\n::: include signoff', {
      partials: { signoff: 'Cheers, The Acme Team' },
    });
    expect(text).toContain('Cheers, The Acme Team');
  });

  it('works when written flush against surrounding text', async () => {
    const { html } = await render('Some intro text\n::: include signoff', {
      partials: { signoff: '## Standalone Heading' },
    });
    expect(html).toContain('<h2');
    expect(html).toContain('Standalone Heading');
  });

  it('warns and drops an unknown partial', async () => {
    const { html, warnings } = await render('# Hi\n\n::: include nope', {
      partials: { other: 'x' },
    });
    expect(warnings?.[0].stage).toBe('content');
    expect(warnings?.[0].message).toContain('nope');
    expect(html).not.toContain(':::');
  });

  it('warns on an include without any partials provided', async () => {
    const { warnings } = await render('::: include footer');
    expect(warnings?.[0].stage).toBe('content');
    expect(warnings?.[0].message).toContain('footer');
  });

  it('warns on an include with no name', async () => {
    const { warnings } = await render('::: include', { partials: { x: 'y' } });
    expect(warnings?.[0].message).toContain('needs a partial name');
  });

  it('allows path-like partial names', async () => {
    const { html, warnings } = await render('::: include blocks/legal-v2.1', {
      partials: { 'blocks/legal-v2.1': 'Fine print' },
    });
    expect(html).toContain('Fine print');
    expect(warnings).toBeUndefined();
  });
});

describe('partial parameters', async () => {
  it('substitutes passed keys including quoted values with spaces', async () => {
    const { html } = await render('::: include promo title="Summer sale" url=https://acme.com/sale', {
      partials: { promo: '**{{title}}**\n\n[Shop now]({{url}}){button}' },
    });
    expect(html).toContain('Summer sale');
    expect(html).toContain('https://acme.com/sale');
  });

  it('leaves tokens for unpassed keys untouched for the app template layer', async () => {
    const { html } = await render('::: include foot name="Dan"', {
      partials: { foot: 'Hi {{name}} — [Unsubscribe]({{unsubscribe_url}})' },
    });
    expect(html).toContain('Hi Dan');
    expect(html).toContain('{{unsubscribe_url}}');
  });

  it('accepts whitespace inside placeholder braces', async () => {
    const { html } = await render('::: include p title=Hello', {
      partials: { p: '{{ title }} world' },
    });
    expect(html).toContain('Hello world');
  });

  it('does not rescan substituted values for other placeholders', async () => {
    const { html } = await render('::: include p a="{{b}}" b="B"', {
      partials: { p: 'value: {{a}}' },
    });
    expect(html).toContain('value: {{b}}');
  });

  it('handles $-patterns and regex characters in values', async () => {
    const { html } = await render(`::: include p price="$1.50 (50% off) $&"`, {
      partials: { p: 'Now {{price}}' },
    });
    expect(html).toContain('Now $1.50 (50% off) $&amp;');
  });
});

describe('partial nesting and safety', async () => {
  it('expands nested includes', async () => {
    const { html, warnings } = await render('::: include outer', {
      partials: {
        outer: 'Outer start\n\n::: include inner',
        inner: 'Inner content',
      },
    });
    expect(html).toContain('Outer start');
    expect(html).toContain('Inner content');
    expect(warnings).toBeUndefined();
  });

  it('detects direct and mutual cycles without hanging', async () => {
    const { warnings } = await render('::: include a', {
      partials: { a: '::: include b', b: '::: include a' },
    });
    expect(warnings?.some((w) => w.message.includes('includes itself'))).toBe(true);
  });

  it('caps nesting depth with a warning', async () => {
    const partials: Record<string, string> = {};
    for (let i = 0; i < 15; i++) partials[`p${i}`] = `level ${i}\n\n::: include p${i + 1}`;
    partials.p15 = 'bottom';
    const { warnings } = await render('::: include p0', { partials });
    expect(warnings?.some((w) => w.message.includes('nested more than'))).toBe(true);
  });

  it('strips frontmatter inside a partial with a warning', async () => {
    const { html, warnings } = await render('::: include p', {
      partials: { p: '---\npreheader: sneaky\n---\n\nBody text' },
    });
    expect(html).toContain('Body text');
    expect(html).not.toContain('sneaky');
    expect(warnings?.[0].message).toContain('frontmatter');
  });

  it('leaves include lines inside code fences alone', async () => {
    const md = 'Example:\n\n```markdown\n::: include footer\n```\n\n::: include footer';
    const { html, warnings } = await render(md, { partials: { footer: 'Real footer' } });
    expect(html).toContain('::: include footer');
    expect(html).toContain('Real footer');
    expect(warnings).toBeUndefined();
  });

  it('ignores include lines indented as code', async () => {
    const { html, warnings } = await render('    ::: include footer', {
      partials: { footer: 'Real footer' },
    });
    expect(html).toContain('::: include footer');
    expect(html).not.toContain('Real footer');
    expect(warnings).toBeUndefined();
  });

  it('expands includes inside container directives', async () => {
    const { html } = await render('::: callout\n::: include note\n:::', {
      partials: { note: '**Heads up!**' },
    });
    expect(html).toContain('Heads up!');
  });
});

describe('expandPartials()', async () => {
  it('is exported for custom pipelines', async () => {
    const warnings: RenderWarning[] = [];
    const out = expandPartials('::: include x', { x: 'expanded' }, warnings);
    expect(out).toContain('expanded');
    expect(warnings).toHaveLength(0);
  });

  it('returns content unchanged when there are no includes', async () => {
    const warnings: RenderWarning[] = [];
    const input = '# Hello\n\n::: callout\nhi\n:::';
    expect(expandPartials(input, {}, warnings)).toBe(input);
    expect(warnings).toHaveLength(0);
  });
});
