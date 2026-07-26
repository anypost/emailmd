import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

/**
 * Section classes in document order, ignoring the duplicates MJML mirrors onto
 * its Outlook conditional tables (`emd-s-outlook`, …).
 */
function sectionClasses(html: string): string[] {
  return [...html.matchAll(/class="(emd-(?:s|hero|bg)[^"]*)"/g)]
    .map((m) => m[1])
    .filter((c) => !c.includes('-outlook'));
}

describe('content box edge classes', () => {
  it('marks a single-section document as both edges', async () => {
    const { html } = await render('# Hello\n\nSome body text.');
    expect(sectionClasses(html)).toEqual(['emd-s emd-bg emd-top emd-bot']);
  });

  it('marks the first and last section of a multi-section document', async () => {
    const doc = '# Hello\n\ntext\n\n::: callout\nNote\n:::\n\n---\n\n[Click](https://example.com){.button}';
    const { html } = await render(doc);
    const classes = sectionClasses(html);
    expect(classes).toHaveLength(4);
    expect(classes[0]).toContain('emd-top');
    expect(classes[classes.length - 1]).toContain('emd-bot');
    // Nothing in between is tagged
    for (const c of classes.slice(1, -1)) {
      expect(c).not.toMatch(/emd-(top|bot)/);
    }
  });

  it('leaves header and footer bands outside the box', async () => {
    const doc = '::: header\nLogo\n:::\n\n# Hello\n\ntext\n\n::: footer\nUnsubscribe\n:::';
    const { html } = await render(doc);
    expect(sectionClasses(html)).toEqual([
      'emd-s',
      'emd-s emd-bg emd-top emd-bot',
      'emd-s',
    ]);
  });

  it('counts a hero as the top of the box', async () => {
    const { html } = await render('::: hero\n# Big\n:::\n\ntext after the hero');
    expect(sectionClasses(html)).toEqual([
      'emd-hero emd-hero-solid emd-top',
      'emd-s emd-bg emd-bot',
    ]);
  });

  it('marks a trailing button fallback as the bottom of the box', async () => {
    const { html } = await render('# Hello\n\n[Click](https://example.com){.button fallback=true}');
    const classes = sectionClasses(html);
    expect(classes[0]).toContain('emd-top');
    expect(classes[classes.length - 1]).toContain('emd-bot');
  });

  it('adds nothing when a document has no box sections', async () => {
    const { html } = await render('::: header\nLogo\n:::');
    expect(sectionClasses(html)).toEqual(['emd-s']);
  });

  it('is a styling hook only — no radius is emitted by default', async () => {
    const { html } = await render('# Hello\n\ntext');
    expect(html).not.toContain('border-top-left-radius');
  });
});
