import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

describe('strings option', () => {
  const md = '[Get Started](https://example.com/go){button fallback}';

  it('uses the default English fallback message when no strings are given', async () => {
    const { html } = await render(md);
    expect(html).toContain('If you&#x2019;re having trouble clicking the &ldquo;Get Started&rdquo; button');
    expect(html).toContain('copy and paste this URL into your browser');
  });

  it('substitutes {text} and {url} in a custom fallback message', async () => {
    const { html } = await render(md, {
      strings: { buttonFallback: 'Probleme mit &bdquo;{text}&ldquo;? Link: {url}' },
    });
    expect(html).toContain('Probleme mit &bdquo;Get Started&ldquo;? Link:');
    expect(html).toContain('https://example.com/go');
    expect(html).not.toContain('If you&#x2019;re having trouble');
  });

  it('substitutes repeated placeholders', async () => {
    const { html } = await render(md, {
      strings: { buttonFallback: '{text} and {text} again: {url}' },
    });
    expect(html).not.toContain('{text}');
    expect(html.match(/Get Started and Get Started again/)).toBeTruthy();
  });

  it('does not expand $-patterns from button text into the message', async () => {
    const dollars = '[Save $$5 now](https://example.com/x){button fallback}';
    const { html } = await render(dollars);
    expect(html).toContain('Save $$5 now');
  });

  it('accepts a custom message without placeholders', async () => {
    const { html } = await render(md, {
      strings: { buttonFallback: 'Copy the link below into your browser.' },
    });
    expect(html).toContain('Copy the link below into your browser.');
  });

  it('per-button fallback text still overrides the global message', async () => {
    const perButton = '[Go](https://example.com/x){button fallback="Use this link:"}';
    const { html } = await render(perButton, {
      strings: { buttonFallback: 'GLOBAL {url}' },
    });
    expect(html).toContain('Use this link:');
    expect(html).not.toContain('GLOBAL');
  });
});
