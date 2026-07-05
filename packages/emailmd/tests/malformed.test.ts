import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { segment } from '../src/segmenter.js';
import type { RenderWarning } from '../src/warnings.js';

/**
 * Malformed and degenerate input: the renderer must never throw, never leak
 * internal sentinel markers or template placeholders, and always produce a
 * complete HTML document.
 */

async function rendersCleanly(md: string) {
  const result = await render(md);
  expect(result.html).toContain('<!doctype html>');
  // No active internal markers may survive into the output. Entity-escaped
  // mentions (e.g. inside code spans) are fine — they can't match this.
  expect(result.html).not.toMatch(/<!--EMAILMD:/);
  return result;
}

describe('malformed: degenerate documents', () => {
  it('renders empty input', async () => {
    await rendersCleanly('');
  });

  it('renders whitespace-only input', async () => {
    await rendersCleanly('   \n\n  \t \n');
  });

  it('renders frontmatter-only input', async () => {
    const { meta } = await rendersCleanly('---\npreheader: Just meta\n---\n');
    expect(meta.preheader).toBe('Just meta');
  });

  it('renders input with only an opening frontmatter fence', async () => {
    const { html } = await rendersCleanly('---\npreheader: never closed');
    // Not valid frontmatter — treated as body content.
    expect(html).toContain('preheader: never closed');
  });

  it('renders a lone horizontal rule', async () => {
    await rendersCleanly('---');
  });
});

describe('malformed: line endings', () => {
  it('handles CRLF frontmatter and body', async () => {
    const md = '---\r\npreheader: CRLF test\r\ntheme: dark\r\n---\r\n\r\n# Hello\r\n\r\nBody text.\r\n';
    const { html, meta } = await rendersCleanly(md);
    expect(meta.preheader).toBe('CRLF test');
    expect(html).toContain('Hello');
    expect(html).toContain('Body text.');
  });

  it('handles CRLF directives', async () => {
    const md = '::: callout\r\nInside callout\r\n:::\r\n';
    const { html } = await rendersCleanly(md);
    expect(html).toContain('Inside callout');
  });

  it('handles mixed LF and CRLF in one document', async () => {
    const md = '# Title\r\n\nParagraph one.\n\r\n::: centered\nMixed\r\n:::\n';
    const { html } = await rendersCleanly(md);
    expect(html).toContain('Mixed');
  });
});

describe('malformed: directives', () => {
  it('renders an unclosed directive without leaking markers', async () => {
    const { html } = await rendersCleanly('::: callout\nNever closed');
    expect(html).toContain('Never closed');
  });

  it('renders an empty directive body', async () => {
    await rendersCleanly('::: callout\n:::');
  });

  it('renders a directive with only whitespace inside', async () => {
    await rendersCleanly('::: highlight\n   \n:::');
  });

  it('renders an unknown directive name as plain content', async () => {
    const { html } = await rendersCleanly('::: bogus\nUnknown directive\n:::');
    expect(html).toContain('Unknown directive');
  });

  it('renders nested directives without leaking markers', async () => {
    const md = '::: callout\nOuter start\n\n::: centered\nInner\n:::\n\nOuter end\n:::';
    const { html } = await rendersCleanly(md);
    expect(html).toContain('Inner');
  });

  it('renders two heroes back to back', async () => {
    const md = '::: hero https://example.com/a.jpg\n# One\n:::\n\n::: hero https://example.com/b.jpg\n# Two\n:::';
    const { html } = await rendersCleanly(md);
    expect(html).toContain('One');
    expect(html).toContain('Two');
  });

  it('renders a hero with no URL', async () => {
    const { html } = await rendersCleanly('::: hero\n# No background\n:::');
    expect(html).toContain('No background');
  });

  it('ignores empty and duplicate directive params', async () => {
    const { html } = await rendersCleanly('::: callout bg= center left bg=#eef\nHi\n:::');
    expect(html).toContain('Hi');
  });

  it('renders a callout with a quoted param without leaking markers', async () => {
    const { html } = await rendersCleanly('::: callout bg="#eff6ff"\nQuoted card\n:::');
    expect(html).toContain('Quoted card');
    expect(html).toContain('#eff6ff');
  });

  it('renders a param with an unmatched quote without leaking markers', async () => {
    // The stray quote is dropped at marker serialization; the directive
    // still renders rather than silently degrading to text.
    const { html } = await rendersCleanly('::: callout bg="#eff6ff center\nStray quote\n:::');
    expect(html).toContain('Stray quote');
    expect(html).toContain('#eff6ff');
  });

  it('warns on and strips a marker whose attributes are malformed', async () => {
    // Unreachable through render() now that serializeMarkerAttrs keeps values
    // quote-free, so exercise the segmenter backstop directly.
    const warnings: RenderWarning[] = [];
    const segments = segment('<p>Before</p>\n<!--EMAILMD:HERO_OPEN color=""#fff""-->\n<p>After</p>', warnings);
    expect(segments.every((s) => !s.content.includes('<!--EMAILMD:'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('could not be parsed'))).toBe(true);
  });
});

describe('malformed: spoofed internal markers', () => {
  it('neutralizes a spoofed directive open marker in body text', async () => {
    const md = 'Hello\n\n<!--EMAILMD:CALLOUT_OPEN-->\n\nAfter the spoof';
    const { html } = await rendersCleanly(md);
    expect(html).toContain('After the spoof');
  });

  it('neutralizes a spoofed marker with attributes', async () => {
    const md = '<!--EMAILMD:HERO_OPEN url="https://evil.example/x.jpg"-->\n\nContent';
    const { html } = await rendersCleanly(md);
    expect(html).not.toContain('evil.example');
    expect(html).toContain('Content');
  });

  it('neutralizes a spoofed close marker inside a real directive', async () => {
    const md = '::: callout\nBefore <!--EMAILMD:CALLOUT_CLOSE--> after\n:::\n\nOutside';
    const { html } = await rendersCleanly(md);
    expect(html).toContain('Outside');
  });

  it('keeps marker text intact inside inline code', async () => {
    const md = 'Use `<!--EMAILMD:CALLOUT_OPEN-->` in your code.';
    const { html } = await rendersCleanly(md);
    // Entity-escaped by markdown-it inside code — visible as text, not a marker.
    expect(html).toContain('&lt;!--EMAILMD:CALLOUT_OPEN--&gt;');
  });
});

describe('malformed: spoofed template placeholders', () => {
  it('preserves a literal placeholder as plain text when no template tags exist', async () => {
    const { html } = await rendersCleanly('# Hi\n\nLiteral EMAILMDTPL0ENDTPL here');
    expect(html).toContain('Literal EMAILMDTPL0ENDTPL here');
  });

  it('does not cross-substitute a literal placeholder alongside a real template tag', async () => {
    const md = 'Real tag: {{ user_name }}\n\nSpoof: EMAILMDTPL0ENDTPL';
    const { html } = await render(md);
    // The real tag appears exactly once, and the literal survives as typed —
    // it must not be replaced by the shielded tag's value.
    expect(html.match(/\{\{ user_name \}\}/g)?.length).toBe(1);
    expect(html).toContain('Spoof: EMAILMDTPL0ENDTPL');
  });
});

describe('malformed: buttons and images', () => {
  it('renders a button with an empty href', async () => {
    await rendersCleanly('[Click me](){button}');
  });

  it('renders a button with unicode text and URL', async () => {
    const { html } = await rendersCleanly('[日本語ボタン](https://example.com/パス){button}');
    expect(html).toContain('日本語ボタン');
  });

  it('renders an image with an empty src', async () => {
    await rendersCleanly('![alt]()');
  });

  it('renders an image with parentheses in the URL', async () => {
    await rendersCleanly('![pic](https://example.com/img_(1).png)');
  });
});
