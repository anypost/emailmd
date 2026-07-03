import { describe, it, expect } from 'vitest';
import { lint } from '../src/index.js';

function rules(findings: Array<{ rule: string }>): string[] {
  return findings.map((f) => f.rule);
}

const CLEAN = `---
preheader: A concise preview
---

# Hello

Read the [full announcement](https://example.com/news).

[Unsubscribe](https://example.com/unsub)`;

describe('lint', async () => {
  it('returns no findings for a clean marketing email', async () => {
    const findings = await lint(CLEAN);
    expect(findings).toEqual([]);
  });

  it('flags images without alt text, with the source line', async () => {
    const findings = await lint(`${CLEAN}\n\n![](https://example.com/pic.png)`);
    const f = findings.find((x) => x.rule === 'image-alt');
    expect(f?.severity).toBe('warning');
    expect(f?.line).toBe(11);
  });

  it('flags http:// links and images', async () => {
    const findings = await lint(`${CLEAN}\n\n[a](http://x.com)\n\n![pic](http://x.com/i.png)`);
    expect(rules(findings).filter((r) => r === 'insecure-link')).toHaveLength(2);
  });

  it('does not flag URLs made of template tokens', async () => {
    const findings = await lint(`${CLEAN}\n\n[track]({{tracking_url}})`);
    expect(rules(findings)).not.toContain('insecure-link');
  });

  it('suggests better generic link text', async () => {
    const findings = await lint(`${CLEAN}\n\n[click here](https://example.com/more)`);
    const f = findings.find((x) => x.rule === 'link-text');
    expect(f?.severity).toBe('suggestion');
    expect(f?.message).toContain('click here');
  });

  it('flags placeholder-host images as suggestions', async () => {
    const findings = await lint(`${CLEAN}\n\n![Banner](https://picsum.photos/seed/banner/800/400)`);
    const f = findings.find((x) => x.rule === 'placeholder-image');
    expect(f?.severity).toBe('suggestion');
    expect(f?.message).toContain('picsum.photos');
    expect(f?.line).toBe(11);
  });

  it('flags placeholder hero backgrounds, with the source line', async () => {
    const doc = `${CLEAN}\n\n::: hero https://wsrv.nl/?url=picsum.photos/seed/hero/1200/600&filt=duotone&start=111827&stop=4b5563 bg=#1f2937\n# Hi\n:::`;
    const findings = await lint(doc);
    const f = findings.find((x) => x.rule === 'placeholder-image');
    expect(f?.message).toContain('wsrv.nl');
    expect(f?.line).toBe(11);
  });

  it('does not flag real image hosts or hero examples inside code fences', async () => {
    const doc = `${CLEAN}\n\n![Real](https://imgs.example.org/photo.jpg)\n\n\`\`\`markdown\n::: hero https://picsum.photos/seed/x/1200/600\n:::\n\`\`\``;
    const findings = await lint(doc);
    expect(rules(findings)).not.toContain('placeholder-image');
  });

  it('warns on SVG and data: URI images', async () => {
    const doc = `${CLEAN}\n\n![Logo](https://example.com/logo.svg?v=2)\n\n![Pixel](data:image/png;base64,iVBORw0KGgo=)`;
    const findings = await lint(doc);
    const fmt = findings.filter((x) => x.rule === 'image-format');
    expect(fmt).toHaveLength(2);
    expect(fmt.every((f) => f.severity === 'warning')).toBe(true);
    expect(fmt[0].message).toContain('SVG');
    expect(fmt[1].message).toContain('data: URI');
  });

  it('suggests safer formats for WebP and AVIF images', async () => {
    const findings = await lint(`${CLEAN}\n\n![A](https://example.com/a.webp)\n\n![B](https://example.com/b.avif)`);
    const fmt = findings.filter((x) => x.rule === 'image-format');
    expect(fmt.map((f) => f.severity)).toEqual(['suggestion', 'suggestion']);
    expect(fmt[0].message).toContain('WebP');
    expect(fmt[1].message).toContain('AVIF');
  });

  it('flags SVG hero backgrounds but not template-token image URLs', async () => {
    const doc = `${CLEAN}\n\n::: hero https://example.com/bg.svg\n# Hi\n:::\n\n![T]({{logo_url}})`;
    const findings = await lint(doc);
    const fmt = findings.filter((x) => x.rule === 'image-format');
    expect(fmt).toHaveLength(1);
    expect(fmt[0].message).toContain('SVG');
    expect(fmt[0].line).toBe(11);
  });

  it('does not flag standard image formats', async () => {
    const findings = await lint(`${CLEAN}\n\n![A](https://example.com/a.png)\n\n![B](https://example.com/b.jpg)\n\n![C](https://example.com/c.gif)`);
    expect(rules(findings)).not.toContain('image-format');
  });

  it('suggests a preheader when missing', async () => {
    const findings = await lint('# Hi\n\n[Unsubscribe](https://example.com/u)');
    expect(rules(findings)).toContain('preheader-missing');
  });

  it('flags an over-long preheader', async () => {
    const long = 'x'.repeat(120);
    const findings = await lint(`---\npreheader: ${long}\n---\n\n# Hi\n\n[Unsubscribe](https://example.com/u)`);
    expect(rules(findings)).toContain('preheader-length');
    expect(rules(findings)).not.toContain('preheader-missing');
  });

  it('suggests an unsubscribe link when none is present', async () => {
    const findings = await lint(`---\npreheader: Hi\n---\n\n# Hello`);
    expect(rules(findings)).toContain('unsubscribe');
  });

  it('accepts template-token unsubscribe links', async () => {
    const findings = await lint(`---\npreheader: Hi\n---\n\n[Unsubscribe]({{unsubscribe_url}})`);
    expect(rules(findings)).not.toContain('unsubscribe');
  });

  it('flags common spam phrases', async () => {
    const findings = await lint(`${CLEAN}\n\nAct now — this is not spam!`);
    const spam = findings.filter((f) => f.rule === 'spam-words');
    expect(spam.length).toBeGreaterThanOrEqual(2);
    expect(spam[0].severity).toBe('suggestion');
  });

  it('folds render warnings into findings', async () => {
    const findings = await lint(`---\ndir: sideways\n---\n\n${CLEAN.replace(/^---[\s\S]*?---\n/, '')}`);
    const f = findings.find((x) => x.rule === 'render');
    expect(f?.severity).toBe('warning');
    expect(f?.message).toContain('dir');
  });

  it('warns when the minified HTML exceeds the Gmail clip limit', async () => {
    const bigParagraphs = Array.from({ length: 1200 }, (_, i) => `Paragraph ${i} with enough words to add real weight to the document body and push the total size up.`).join('\n\n');
    const findings = await lint(`${CLEAN}\n\n${bigParagraphs}`);
    expect(rules(findings)).toContain('gmail-clip');
  }, 30_000);

  it('lints content pulled in via partials for size and unsubscribe', async () => {
    const findings = await lint(`---\npreheader: Hi\n---\n\n# Hello\n\n::: include legal`, {
      partials: { legal: '[Unsubscribe](https://example.com/u)' },
    });
    expect(rules(findings)).not.toContain('unsubscribe');
  });

  it('reports line numbers offset past the frontmatter block', async () => {
    const findings = await lint(`---\npreheader: Hi\n---\n\n![](https://example.com/a.png)\n\n[Unsubscribe](https://example.com/u)`);
    const f = findings.find((x) => x.rule === 'image-alt');
    expect(f?.line).toBe(5);
  });

  it('sorts findings by source line', async () => {
    const findings = await lint('![](https://example.com/a.png)\n\n[click here](https://example.com/b)');
    const lines = findings.filter((f) => f.line !== undefined).map((f) => f.line!);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });
});
