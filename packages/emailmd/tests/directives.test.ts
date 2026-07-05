import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

describe('callout directive', async () => {
  it('renders callout with cardColor background', async () => {
    const { html } = await render('::: callout\nHello from callout\n:::');
    expect(html).toContain('Hello from callout');
    expect(html).toContain('#f4f4f5'); // default cardColor
  });

  it('renders markdown inside callout', async () => {
    const { html } = await render('::: callout\n**Bold** and [a link](https://example.com)\n:::');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('href="https://example.com"');
  });
});

describe('highlight directive', async () => {
  it('renders highlight with brandColor background and white text', async () => {
    const { html } = await render('::: highlight\nLimited time offer\n:::');
    expect(html).toContain('Limited time offer');
    expect(html).toContain('#18181b'); // default brandColor
    // The highlight section should produce white text
    expect(html).toContain('#ffffff');
  });
});

describe('centered directive', async () => {
  it('renders centered text with center alignment', async () => {
    const { html } = await render('::: centered\nCentered content\n:::');
    expect(html).toContain('Centered content');
    expect(html).toContain('text-align:center');
  });

  it('renders custom text color on centered', async () => {
    const { html } = await render('::: centered color=#00F7A4\nGreen text\n:::');
    expect(html).toContain('Green text');
    expect(html).toContain('#00F7A4');
  });

  it('strips parameterized centered markers in plain text', async () => {
    const { text } = await render('::: centered color=#00F7A4\nCentered text\n:::');
    expect(text).toContain('Centered text');
    expect(text).not.toContain('EMAILMD');
    expect(text).not.toContain('00F7A4');
  });
});

describe('hero directive', async () => {
  it('renders hero with background image', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\n# Welcome\nGet started today!\n:::');
    expect(html).toContain('Welcome');
    expect(html).toContain('Get started today!');
    expect(html).toContain('https://example.com/hero.jpg');
  });

  it('renders centered white text over background', async () => {
    const { html } = await render('::: hero https://example.com/bg.png\nOverlay text\n:::');
    expect(html).toContain('Overlay text');
    // Default buttonTextColor is #fafafa
    expect(html).toContain('#fafafa');
  });

  it('renders markdown inside hero', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\n**Bold** and [a link](https://example.com)\n:::');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('href="https://example.com"');
  });

  it('strips hero markers in plain text output', async () => {
    const { text } = await render('::: hero https://example.com/hero.jpg\n# Welcome\nGet started today!\n:::');
    expect(text).toContain('WELCOME');
    expect(text).toContain('Get started today!');
    expect(text).not.toContain('EMAILMD');
    expect(text).not.toContain('hero.jpg');
  });

  it('strips hero markers with color param in plain text output', async () => {
    const { text } = await render('::: hero https://example.com/hero.jpg color=#ffffff\n# Welcome\nGet started!\n:::');
    expect(text).toContain('WELCOME');
    expect(text).toContain('Get started!');
    expect(text).not.toContain('EMAILMD');
    expect(text).not.toContain('hero.jpg');
    expect(text).not.toContain('ffffff');
  });

  it('renders custom text color on hero', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg?w=1200&h=800 color=#ffffff\n# Welcome\nSome text\n:::');
    expect(html).toContain('#ffffff');
    expect(html).toContain('https://example.com/hero.jpg?w=1200');
    expect(html).toMatch(/h1[^>]*style="color: #ffffff"/);
  });

  it('accepts color param before URL', async () => {
    const { html } = await render('::: hero color=#20ffff https://example.com/hero.jpg\n# Welcome\n:::');
    expect(html).toContain('https://example.com/hero.jpg');
    expect(html).toMatch(/h1[^>]*style="color: #20ffff[;"]/);
  });

  it('accepts a quoted color param alongside a query-string URL', async () => {
    const { html, warnings } = await render(
      '::: hero https://wsrv.nl/?url=picsum.photos/seed/pony/1200/600&filt=duotone&start=be185d&stop=ec4899 color="#ffffff"\n# Welcome\nSome text\n:::',
    );
    expect(html).toContain('emd-hero');
    expect(html).toMatch(/h1[^>]*style="color: #ffffff[;"]/);
    expect(warnings ?? []).toEqual([]);
  });

  it('accepts a quoted hero URL', async () => {
    const { html } = await render('::: hero "https://example.com/hero.jpg"\n# Welcome\n:::');
    expect(html).toContain('emd-hero');
    expect(html).toContain('https://example.com/hero.jpg');
  });

  it('inlines the default hero text color on headings', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\n# Welcome\n:::');
    // Without this, the head's h1 color rule wins over the mj-text color
    expect(html).toMatch(/h1[^>]*style="color: #fafafa[;"]/);
  });

  it('renders a fallback background color behind the image', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\n# Welcome\n:::');
    // Default buttonColor keeps the buttonTextColor overlay readable when
    // the image is blocked or missing
    expect(html).toContain('#18181b');
    expect(html).toContain('emd-hero');
    expect(html).not.toContain('emd-hero-solid');
  });

  it('accepts a custom bg param', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg bg=#123456\n# Welcome\n:::');
    expect(html).toContain('#123456');
  });

  it('renders a solid banner when no image URL is given', async () => {
    const { html } = await render('::: hero\n# Welcome\nNo image here.\n:::');
    expect(html).toContain('emd-hero-solid');
    expect(html).toContain('#18181b');
    expect(html).not.toMatch(/background:[^;"]*url\(/);
    expect(html).toMatch(/h1[^>]*style="color: #fafafa"/);
  });

  it('dark mode leaves hero colors alone', async () => {
    // Hero text/bg are a self-contained pair (contrast never depends on the
    // surrounding email), so the dark overrides must not recolor them
    const { html } = await render('---\ntheme: auto\n---\n::: hero bg=#7c3aed\n# Welcome\n:::');
    expect(html).toContain('emd-hero-solid');
    expect(html).toContain('#7c3aed');
    expect(html).not.toMatch(/\.emd-hero[^{]*\{/);
  });
});

describe('callout directive with params', async () => {
  it('renders center-aligned callout', async () => {
    const { html } = await render('::: callout center\nCentered callout\n:::');
    expect(html).toContain('Centered callout');
    expect(html).toContain('text-align:center');
  });

  it('renders right-aligned callout', async () => {
    const { html } = await render('::: callout right\nRight callout\n:::');
    expect(html).toContain('Right callout');
    expect(html).toContain('text-align:right');
  });

  it('renders compact padding on callout', async () => {
    const { html } = await render('::: callout compact\nCompact callout\n:::');
    expect(html).toContain('Compact callout');
    expect(html).toContain('12px 16px');
  });

  it('renders spacious padding on callout', async () => {
    const { html } = await render('::: callout spacious\nSpacious callout\n:::');
    expect(html).toContain('Spacious callout');
    expect(html).toContain('32px 40px');
  });

  it('renders custom bg color on callout', async () => {
    const { html } = await render('::: callout bg=#eff6ff\nCustom bg\n:::');
    expect(html).toContain('Custom bg');
    expect(html).toContain('#eff6ff');
  });

  it('renders custom text color on callout', async () => {
    const { html } = await render('::: callout color=#1e40af\nCustom color\n:::');
    expect(html).toContain('Custom color');
    expect(html).toContain('#1e40af');
  });

  it('renders combined params on callout', async () => {
    const { html } = await render('::: callout center compact color=#1e40af bg=#eff6ff\nAll params\n:::');
    expect(html).toContain('All params');
    expect(html).toContain('text-align:center');
    expect(html).toContain('12px 16px');
    expect(html).toContain('#1e40af');
    expect(html).toContain('#eff6ff');
  });

  it('strips parameterized callout markers in plain text', async () => {
    const { text } = await render('::: callout center compact bg=#eff6ff\n**Important**\n:::');
    expect(text).toContain('Important');
    expect(text).not.toContain('EMAILMD');
    expect(text).not.toContain('center');
    expect(text).not.toContain('eff6ff');
  });
});

describe('highlight directive with params', async () => {
  it('renders center-aligned highlight', async () => {
    const { html } = await render('::: highlight center\nCentered highlight\n:::');
    expect(html).toContain('Centered highlight');
    expect(html).toContain('text-align:center');
  });

  it('renders custom bg color on highlight', async () => {
    const { html } = await render('::: highlight bg=#dc2626\nCustom bg\n:::');
    expect(html).toContain('#dc2626');
  });

  it('renders compact padding on highlight', async () => {
    const { html } = await render('::: highlight compact\nCompact highlight\n:::');
    expect(html).toContain('12px 16px');
  });
});

describe('header directive with params', async () => {
  it('defaults to center when no alignment specified', async () => {
    const { html } = await render('::: header\nHeader content\n:::');
    expect(html).toContain('text-align:center');
  });

  it('renders left-aligned header', async () => {
    const { html } = await render('::: header left\nLeft header\n:::');
    expect(html).toContain('Left header');
    expect(html).toContain('text-align:left');
  });

  it('renders custom text color on header', async () => {
    const { html } = await render('::: header color=#1e40af\nColored header\n:::');
    expect(html).toContain('#1e40af');
  });
});

describe('footer directive with params', async () => {
  it('defaults to center when no alignment specified', async () => {
    const { html } = await render('::: footer\nFooter content\n:::');
    expect(html).toContain('text-align:center');
  });

  it('renders left-aligned footer', async () => {
    const { html } = await render('::: footer left\nLeft footer\n:::');
    expect(html).toContain('Left footer');
    expect(html).toContain('text-align:left');
  });

  it('strips parameterized footer markers in plain text', async () => {
    const { text } = await render('::: footer left color=#666666\nFooter text\n:::');
    expect(text).toContain('Footer text');
    expect(text).not.toContain('EMAILMD');
  });
});

describe('border-radius on directives', async () => {
  it('renders custom border-radius on callout', async () => {
    const { html } = await render('::: callout border-radius=16px\nRounded callout\n:::');
    expect(html).toContain('Rounded callout');
    expect(html).toContain('border-radius:16px');
  });

  it('renders custom border-radius on highlight', async () => {
    const { html } = await render('::: highlight border-radius=0\nSharp highlight\n:::');
    expect(html).toContain('Sharp highlight');
    expect(html).toContain('border-radius:0');
  });

  it('applies theme borderRadius to callout when no per-directive override', async () => {
    const { html } = await render('::: callout\nCallout text\n:::', { theme: { borderRadius: '20px' } });
    expect(html).toContain('Callout text');
    expect(html).toContain('border-radius:20px');
  });

  it('applies theme borderRadius to highlight when no per-directive override', async () => {
    const { html } = await render('::: highlight\nHighlight text\n:::', { theme: { borderRadius: '20px' } });
    expect(html).toContain('Highlight text');
    expect(html).toContain('border-radius:20px');
  });

  it('per-directive border-radius overrides theme on callout', async () => {
    const { html } = await render('::: callout border-radius=0\nSharp callout\n:::', { theme: { borderRadius: '20px' } });
    expect(html).toContain('border-radius:0');
    expect(html).not.toContain('border-radius:20px');
  });
});

describe('multiple directives', async () => {
  it('renders multiple directives in sequence', async () => {
    const md = `::: callout
First block
:::

::: highlight
Second block
:::

::: centered
Third block
:::`;
    const { html } = await render(md);
    expect(html).toContain('First block');
    expect(html).toContain('Second block');
    expect(html).toContain('Third block');
  });

  it('renders regular text between directives', async () => {
    const md = `# Heading

Some paragraph text.

::: callout
A callout
:::

More text after.`;
    const { html } = await render(md);
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('Some paragraph text.');
    expect(html).toContain('A callout');
    expect(html).toContain('More text after.');
  });
});

describe('buttons inside directives', async () => {
  it('renders button inside hero with text', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\n# Welcome\n\n[Sign Up](https://example.com/signup){button}\n:::');
    expect(html).toContain('Welcome');
    expect(html).toContain('Sign Up');
    expect(html).toContain('https://example.com/signup');
  });

  it('renders button inside callout with text and preserves callout styling', async () => {
    const { html } = await render('::: callout\nCheck out our offer!\n\n[Learn More](https://example.com){button}\n:::');
    const plainButton = await render('Check out our offer!\n\n[Learn More](https://example.com){button}');
    expect(html).toContain('Check out our offer!');
    expect(html).toContain('Learn More');
    expect(html).toContain('https://example.com');
    // Callout wrapper should add extra #f4f4f5 occurrences vs plain rendering
    const count = (s: string, sub: string) => s.split(sub).length - 1;
    expect(count(html, '#f4f4f5')).toBeGreaterThan(count(plainButton.html, '#f4f4f5'));
  });

  it('renders button group inside directive', async () => {
    const { html } = await render('::: callout\n[Accept](https://example.com/yes){button} [Decline](https://example.com/no){button.secondary}\n:::');
    expect(html).toContain('Accept');
    expect(html).toContain('Decline');
  });

  it('renders button-only callout and preserves callout styling', async () => {
    const { html } = await render('::: callout\n[Click Me](https://example.com){button}\n:::');
    const plainButton = await render('[Click Me](https://example.com){button}');
    expect(html).toContain('Click Me');
    expect(html).toContain('https://example.com');
    // Callout wrapper should add extra #f4f4f5 occurrences vs a plain button
    const count = (s: string, sub: string) => s.split(sub).length - 1;
    expect(count(html, '#f4f4f5')).toBeGreaterThan(count(plainButton.html, '#f4f4f5'));
  });

  it('renders button-only hero and preserves hero background', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\n[Get Started](https://example.com/start){button}\n:::');
    expect(html).toContain('https://example.com/hero.jpg');
    expect(html).toContain('Get Started');
    expect(html).toContain('https://example.com/start');
  });

  it('renders button-only highlight and preserves highlight styling', async () => {
    const { html } = await render('::: highlight\n[Buy Now](https://example.com/buy){button}\n:::');
    const plainButton = await render('[Buy Now](https://example.com/buy){button}');
    expect(html).toContain('Buy Now');
    expect(html).toContain('https://example.com/buy');
    // Highlight wrapper should add extra #18181b occurrences (brandColor bg)
    const count = (s: string, sub: string) => s.split(sub).length - 1;
    expect(count(html, '#18181b')).toBeGreaterThan(count(plainButton.html, '#18181b'));
  });

  it('preserves hero styling when button has surrounding text', async () => {
    const { html } = await render('::: hero https://example.com/hero.jpg\nJoin us today\n\n[Get Started](https://example.com/start){button}\n:::');
    expect(html).toContain('https://example.com/hero.jpg');
    expect(html).toContain('Join us today');
    expect(html).toContain('Get Started');
    expect(html).toContain('https://example.com/start');
  });
});

describe('callout and highlight padding presets', async () => {
  // The padding preset on the card column must be the full effective inset —
  // the inner mj-text is rendered with padding="0" so MJML's 10px 25px
  // mj-text default cannot dilute the compact/spacious variants.
  async function effectivePaddings(md: string, marker: string): Promise<string[]> {
    const { html } = await render(md);
    const idx = html.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const region = html.slice(Math.max(0, idx - 900), idx);
    return [...region.matchAll(/padding[^:]*:\s*([^;"]+)[;"]/g)].map((m) => m[1]);
  }

  it('callout default: 20px 24px card padding, zero text padding', async () => {
    const pads = await effectivePaddings('::: callout\nPad probe\n:::', 'Pad probe');
    expect(pads).toContain('20px 24px');
    expect(pads[pads.length - 1]).toBe('0');
  });

  it('callout compact: 12px 16px card padding, zero text padding', async () => {
    const pads = await effectivePaddings('::: callout compact\nPad probe\n:::', 'Pad probe');
    expect(pads).toContain('12px 16px');
    expect(pads[pads.length - 1]).toBe('0');
  });

  it('callout spacious: 32px 40px card padding, zero text padding', async () => {
    const pads = await effectivePaddings('::: callout spacious\nPad probe\n:::', 'Pad probe');
    expect(pads).toContain('32px 40px');
    expect(pads[pads.length - 1]).toBe('0');
  });

  it('highlight compact: 12px 16px card padding, zero text padding', async () => {
    const pads = await effectivePaddings('::: highlight compact\nPad probe\n:::', 'Pad probe');
    expect(pads).toContain('12px 16px');
    expect(pads[pads.length - 1]).toBe('0');
  });
});

describe('trailing block margins inside boxes', async () => {
  // The head styles give blocks bottom-only margins, so the last block in a
  // padded box gets margin-bottom: 0 inlined — otherwise the box's bottom
  // inset reads larger than its top.
  it('zeroes the margin of a heading that ends a callout', async () => {
    const { html } = await render('::: callout center compact\n# DFY-X7U\n:::');
    expect(html).toMatch(/<h1 style="margin-bottom: 0">DFY-X7U<\/h1>/);
  });

  it('zeroes only the last block, balancing nested lists', async () => {
    const { html } = await render('::: callout\nIntro line\n\n- one\n  - nested\n- two\n:::');
    const zeroed = [...html.matchAll(/<(\w+)[^>]*style="[^"]*margin-bottom: 0[^"]*"/g)];
    expect(zeroed).toHaveLength(1);
    expect(zeroed[0][1]).toBe('ul');
    // the outer list, not the nested one — everything after it is its own content
    expect(html.slice(html.indexOf(zeroed[0][0]))).toContain('two');
  });

  it('merges with the inlined hero heading color', async () => {
    const { html } = await render('::: hero bg=#7c3aed\n# Solo heading\n:::');
    expect(html).toMatch(/<h1 style="color: #fafafa; margin-bottom: 0">/);
  });

  it('zeroes the last paragraph in accordion panels and bg columns', async () => {
    const { html } = await render(
      '::: accordion\n### Q?\nBody text.\n:::\n\n:::: columns\n::: column bg=#ffffff\nCard text.\n:::\n::::',
    );
    expect(html).toMatch(/<p style="margin-bottom: 0">Body text.<\/p>/);
    expect(html).toMatch(/<p style="margin-bottom: 0">Card text.<\/p>/);
  });

  it('leaves plain sections and bg-less columns alone', async () => {
    const { html } = await render('Just a paragraph.\n\n:::: columns\n::: column\nColumn text.\n:::\n::::');
    expect(html).not.toMatch(/style="[^"]*margin-bottom: 0/);
  });

  it('sets an explicit paragraph margin in the head styles', async () => {
    const { html } = await render('Hello');
    expect(html).toMatch(/p\s*\{\s*margin:\s*0 0 16px 0;\s*\}/);
  });
});
