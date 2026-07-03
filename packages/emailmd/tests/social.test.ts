import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

const BLOCK = '::: social\n- [GitHub](https://github.com/anypost/emailmd)\n- [X](https://x.com/emailmd)\n:::';

describe('social directive', () => {
  it('maps link hostnames to network icons', async () => {
    const { html } = await render(BLOCK);
    expect(html).toContain('github.png');
    expect(html).toContain('twitter-x.png');
    expect(html).toContain('href="https://github.com/anypost/emailmd"');
    expect(html).toContain('href="https://x.com/emailmd"');
    expect(html).not.toContain('EMAILMD');
  });

  it('treats twitter.com as x and unknown hosts as web', async () => {
    const { html } = await render(
      '::: social\n- [Twitter](https://twitter.com/emailmd)\n- [Blog](https://blog.example.com)\n:::',
    );
    expect(html).toContain('twitter-x.png');
    expect(html).toContain('web.png');
  });

  it('hides labels by default and shows them with the labels flag', async () => {
    const iconOnly = await render(BLOCK);
    expect(iconOnly.html).not.toMatch(/>GitHub</);

    const labeled = await render(BLOCK.replace('::: social', '::: social labels'));
    expect(labeled.html).toMatch(/GitHub/);
  });

  it('supports icon-size and alignment', async () => {
    const { html } = await render(BLOCK.replace('::: social', '::: social icon-size=32 left'));
    expect(html).toContain('width:32px');
  });

  it('uses a self-hosted icon set via icon-base', async () => {
    const { html } = await render(
      BLOCK.replace('::: social', '::: social icon-base=https://cdn.example.com/icons'),
    );
    expect(html).toContain('https://cdn.example.com/icons/github.png');
    expect(html).toContain('https://cdn.example.com/icons/x.png');
    expect(html).not.toContain('mailjet.com');
  });

  it('supports a per-link icon override via attrs', async () => {
    const { html } = await render(
      '::: social\n- [Blog](https://blog.example.com){icon=https://cdn.example.com/blog.png}\n:::',
    );
    expect(html).toContain('https://cdn.example.com/blog.png');
  });

  it('warns when the block has no links', async () => {
    const { warnings } = await render('::: social\nJust text\n:::');
    expect(warnings.some((w) => w.message.includes('no links'))).toBe(true);
  });

  it('flattens to plain links in text output', async () => {
    const { text } = await render(BLOCK);
    expect(text).toContain('GitHub (https://github.com/anypost/emailmd)');
    expect(text).not.toContain('EMAILMD');
  });
});
