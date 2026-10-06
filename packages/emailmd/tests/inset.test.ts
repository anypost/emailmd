import { describe, expect, it } from 'vitest';
import { render, segmentsToMjml, defaultTheme } from '../src/index.js';
import { parseMarkdown } from '../src/parser.js';
import { segment } from '../src/segmenter.js';

/** One of every block that sits in the content flow, plus the boxes around them. */
const EVERY_BLOCK = `::: header
Header text
:::

::: hero https://example.com/hero.png
# Hero
[Go](https://x.com){button}
:::

# Heading

Paragraph text.

[Inline](https://x.com){button}

![Image](https://example.com/a.png)

---

| A | B |
|---|---|
| 1 | 2 |

[One](https://x.com){button} [Two](https://y.com){button.secondary}

::: centered
Centered text
[Go](https://x.com){button}
:::

::: callout
Callout text
[Go](https://x.com){button}
:::

::: highlight
Highlight text
:::

::: accordion
### Question
Answer.
:::

:::: columns
::: column
Column text

| A | B |
|---|---|
| 1 | 2 |
:::
::: column
[Go](https://x.com){button}
:::
::::

::: footer
Footer text
:::`;

describe('content inset', () => {
  it('leaves no block on MJML\'s default 25px side padding', async () => {
    const { html } = await render(EVERY_BLOCK, { darkTheme: true });
    expect(html).not.toMatch(/padding:\d+px 25px/);
    expect(html).not.toMatch(/padding-(?:left|right):25px/);
  });

  it('puts flow blocks on the section\'s 32px inset', () => {
    const mjml = segmentsToMjml(segment(parseMarkdown(EVERY_BLOCK)), defaultTheme);
    // Every text, image, button, divider, table and accordion element states
    // its padding, so none falls back to MJML's 10px 25px.
    const elements = [...mjml.matchAll(/<mj-(text|image|button|divider|table|accordion)(?=[\s>/])[^>]*>/g)];
    expect(elements.length).toBeGreaterThan(15);
    for (const [tag] of elements) expect(tag).toMatch(/ padding="/);
    // The text, image, divider and table blocks keep MJML's vertical 10px
    expect(mjml).toMatch(/<mj-text padding="10px 0">/);
    expect(mjml).toMatch(/<mj-image padding="10px 0"/);
    expect(mjml).toMatch(/<mj-divider padding="10px 0"/);
    expect(mjml).toMatch(/<mj-table padding="10px 0"/);
  });

  it('lines text up with data blocks', async () => {
    const { html } = await render('Intro\n\n::: chart\n- A: 1\n- B: 2\n:::');
    // Both sections pad 32px, and neither block adds side padding of its own
    const sides = [...html.matchAll(/<td[^>]*style="[^"]*padding:([^;"]+)[^"]*word-break:break-word/g)].map((m) => m[1]);
    expect(sides.length).toBeGreaterThan(0);
    for (const padding of sides) expect(padding.split(' ')[1] ?? '0').toMatch(/^0(?:px)?$/);
  });
});
