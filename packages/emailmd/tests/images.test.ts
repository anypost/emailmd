import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

describe('image support', async () => {
  describe('block images (standalone paragraph)', async () => {
    it('renders a basic image responsively', async () => {
      const { html } = await render('![Hero banner](https://example.com/hero.png)');
      expect(html).toContain('https://example.com/hero.png');
      expect(html).toContain('Hero banner');
      // Should not contain a raw inline <img> — MJML compiles mj-image to table-based markup
      expect(html).not.toContain('<img src="https://example.com/hero.png"');
    });

    it('preserves alt text', async () => {
      const { html } = await render('![Product photo](https://example.com/product.jpg)');
      expect(html).toContain('alt="Product photo"');
    });

    it('preserves title attribute', async () => {
      const { html } = await render('![Alt](https://example.com/img.png "My Title")');
      expect(html).toContain('My Title');
    });

    it('applies custom width via attrs', async () => {
      const { html } = await render('![Alt](https://example.com/img.png){width="400"}');
      expect(html).toContain('https://example.com/img.png');
      expect(html).toContain('400');
    });

    it('applies left alignment via attrs', async () => {
      const { html } = await render('![Alt](https://example.com/img.png){align="left"}');
      expect(html).toContain('https://example.com/img.png');
    });

    it('applies border-radius via attrs', async () => {
      const { html } = await render('![Alt](https://example.com/img.png){border-radius="8px"}');
      expect(html).toContain('https://example.com/img.png');
      expect(html).toContain('border-radius');
      expect(html).toContain('8px');
    });

    it('appends px to a unitless border-radius attr', async () => {
      const { html, warnings } = await render('![Alt](https://example.com/img.png){border-radius="8"}');
      expect(warnings).toBeUndefined();
      expect(html).toMatch(/border-radius:\s*8px/);
      expect(html).not.toMatch(/border-radius:\s*8[^p]/);
    });
  });

  describe('linked images', async () => {
    it('renders a linked image with href', async () => {
      const { html } = await render('[![Product](https://example.com/product.jpg)](https://example.com/shop)');
      expect(html).toContain('https://example.com/product.jpg');
      expect(html).toContain('https://example.com/shop');
    });

    it('renders a linked image with custom width on inner img', async () => {
      const { html } = await render('[![Alt](https://example.com/img.png){width="300"}](https://example.com/link)');
      expect(html).toContain('https://example.com/img.png');
      expect(html).toContain('https://example.com/link');
      expect(html).toContain('300');
    });
  });

  describe('inline images (mixed with text)', async () => {
    it('leaves inline images as raw <img> within text', async () => {
      const { html } = await render('Check out this image ![icon](https://example.com/icon.png) in the text.');
      expect(html).toContain('Check out this image');
      expect(html).toContain('in the text.');
      expect(html).toContain('<img src="https://example.com/icon.png"');
    });

    it('applies vertical-align: middle by default via global style', async () => {
      const { html } = await render('Check ![icon](https://example.com/icon.png) here.');
      expect(html).toContain('img { vertical-align: middle; }');
    });

    it('converts valign attribute to inline style', async () => {
      const { html } = await render('Check ![icon](https://example.com/icon.png){valign="top"} here.');
      expect(html).toContain('style="vertical-align: top"');
      expect(html).not.toContain('valign="top"');
    });

    it('converts valign="baseline" to inline style', async () => {
      const { html } = await render('Text ![icon](https://example.com/icon.png){valign="baseline"} more.');
      expect(html).toContain('style="vertical-align: baseline"');
    });

    it('preserves width alongside valign', async () => {
      const { html } = await render('Text ![icon](https://example.com/icon.png){width="24" valign="top"} here.');
      expect(html).toContain('width="24"');
      expect(html).toContain('style="vertical-align: top"');
    });

    it('works with inline images inside callout directives', async () => {
      const { html } = await render('::: callout\nCheck ![icon](https://example.com/icon.png){valign="top"} here.\n:::');
      expect(html).toContain('style="vertical-align: top"');
    });

    it('converts float="left" to inline styles with margin', async () => {
      const { html } = await render('Text ![photo](https://example.com/photo.jpg){float="left"} description.');
      expect(html).toContain('float: left');
      expect(html).toContain('margin: 0 12px 8px 0');
      expect(html).not.toContain('float="left"');
    });

    it('converts float="right" to inline styles with margin', async () => {
      const { html } = await render('Text ![photo](https://example.com/photo.jpg){float="right"} description.');
      expect(html).toContain('float: right');
      expect(html).toContain('margin: 0 0 8px 12px');
    });

    it('combines float and valign into a single style', async () => {
      const { html } = await render('Text ![photo](https://example.com/photo.jpg){valign="top" float="left"} description.');
      expect(html).toContain('vertical-align: top');
      expect(html).toContain('float: left');
      expect(html).not.toContain('valign="top"');
      expect(html).not.toContain('float="left"');
    });

    it('float works with width attribute', async () => {
      const { html } = await render('::: callout\n![Plant](https://example.com/plant.jpg){width="80" float="left"} **Monstera** Easy care.\n:::');
      expect(html).toContain('width="80"');
      expect(html).toContain('float: left');
    });

    it('applies border-radius on inline images inside callouts', async () => {
      const { html } = await render('::: callout\n![](https://example.com/dog.jpg){width=120 border-radius="10%"}\n:::');
      expect(html).toContain('border-radius: 10%');
      expect(html).not.toContain('border-radius="10%"');
    });

    it('appends px to a unitless border-radius on inline images', async () => {
      const { html } = await render('::: callout\n![](https://example.com/dog.jpg){width=120 border-radius="6"}\n:::');
      expect(html).toContain('border-radius: 6px');
      expect(html).not.toMatch(/border-radius:\s*6[^p]/);
    });

    it('combines border-radius with other inline image styles', async () => {
      const { html } = await render('::: callout\n![](https://example.com/photo.jpg){valign="top" border-radius="8px"}\n:::');
      expect(html).toContain('vertical-align: top');
      expect(html).toContain('border-radius: 8px');
    });
  });

  describe('images with surrounding content', async () => {
    it('splits text segments around a block image', async () => {
      const { html } = await render('# Welcome\n\n![Banner](https://example.com/banner.png)\n\nMore content below.');
      expect(html).toContain('Welcome');
      expect(html).toContain('https://example.com/banner.png');
      expect(html).toContain('More content below.');
    });

    it('handles multiple block images', async () => {
      const md = '![First](https://example.com/1.png)\n\n![Second](https://example.com/2.png)';
      const { html } = await render(md);
      expect(html).toContain('https://example.com/1.png');
      expect(html).toContain('https://example.com/2.png');
    });
  });

  describe('images inside directives stay inline', async () => {
    it('does not extract images from callout directives', async () => {
      const { html } = await render('::: callout\n![Icon](https://example.com/icon.png)\n:::');
      expect(html).toContain('<img');
      expect(html).toContain('https://example.com/icon.png');
    });
  });

  describe('output cleanliness', async () => {
    it('contains no mj- tags in final output', async () => {
      const { html } = await render('![Banner](https://example.com/banner.png)');
      expect(html).not.toMatch(/<mj-/);
    });

    it('contains no EMAILMD markers in output', async () => {
      const { html } = await render('# Title\n\n![Img](https://example.com/img.png)\n\nText');
      expect(html).not.toContain('EMAILMD:');
    });
  });
});

describe('image plain text output', async () => {
  it('converts block images to [Image: alt] format', async () => {
    const { text } = await render('![Logo](https://example.com/logo.png)');
    expect(text).toContain('[Image: Logo]');
  });

  it('converts inline images to [Image: alt] format', async () => {
    const { text } = await render('See this ![icon](https://example.com/icon.png) here.');
    expect(text).toContain('[Image: icon]');
  });
});

describe('image captions', async () => {
  it('renders a caption line under the image', async () => {
    const { html } = await render('![Chart](https://example.com/chart.png){caption="Figure 1 — signups"}');
    expect(html).toContain('Figure 1 — signups');
    // Caption renders after the image markup
    const imgIdx = html.indexOf('chart.png');
    const capIdx = html.indexOf('Figure 1');
    expect(imgIdx).toBeGreaterThan(-1);
    expect(capIdx).toBeGreaterThan(imgIdx);
  });

  it('matches the image alignment', async () => {
    const { html } = await render('![Alt](https://example.com/img.png){align="left" caption="Left cap"}');
    expect(html).toContain('Left cap');
    expect(html).toMatch(/text-align:left[^]*Left cap/);
  });

  it('renders entities in the caption exactly once', async () => {
    const { html } = await render('![Alt](https://example.com/img.png){caption="Tom & Jerry"}');
    expect(html).toContain('Tom &amp; Jerry');
    expect(html).not.toContain('&amp;amp;');
  });

  it('works on linked images', async () => {
    const { html } = await render('[![Alt](https://example.com/img.png)](https://example.com){caption="Click me"}');
    expect(html).toContain('Click me');
    expect(html).toContain('href="https://example.com"');
  });

  it('renders inside column cells', async () => {
    const md = `:::: columns
::: column
![Alt](https://example.com/a.png){caption="Cell cap"}
:::
::::`;
    const { html } = await render(md);
    expect(html).toContain('Cell cap');
  });

  it('appears in plain text after the image label', async () => {
    const { text } = await render('![Chart](https://example.com/chart.png){caption="Figure 1"}');
    expect(text).toContain('[Image: Chart]');
    expect(text).toContain('Figure 1');
    expect(text.indexOf('Figure 1')).toBeGreaterThan(text.indexOf('[Image: Chart]'));
  });
});
