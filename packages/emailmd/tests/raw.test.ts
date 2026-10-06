import { describe, expect, it } from 'vitest';
import { render, segmentsToMjml, defaultTheme } from '../src/index.js';
import { parseMarkdown } from '../src/parser.js';
import { segment } from '../src/segmenter.js';

const segmentsOf = (md: string) => segment(parseMarkdown(md));
const mjmlOf = (md: string) => segmentsToMjml(segmentsOf(md), defaultTheme);

const FRAGMENT = [
  '<table role="presentation" width="100%">',
  '  <tr><td><img src="https://x.com/a.png" alt="Banner" width="600"></td></tr>',
  '',
  '      <tr><td>Some _text_ and *stars*</td></tr>',
  '</table>',
].join('\n');

describe('raw directive', () => {
  it('passes its HTML through without markdown processing', async () => {
    const segments = segmentsOf(`Intro\n\n::: raw\n${FRAGMENT}\n:::\n\nAfter`);
    expect(segments.map((s) => s.type)).toEqual(['text', 'raw', 'text']);
    expect(segments[1].content).toContain(FRAGMENT);

    const { html } = await render(`::: raw\n${FRAGMENT}\n:::`);
    expect(html).toContain('Some _text_ and *stars*');
    expect(html).not.toContain('<em>');
    expect(html).not.toContain('<pre>');
    expect(html).not.toContain('EMAILMD');
  });

  it('renders in an unpadded section that keeps the content background but not emd-s', () => {
    const mjml = mjmlOf('::: raw\n<div>x</div>\n:::');
    expect(mjml).toContain(`<mj-section css-class="emd-bg emd-raw emd-top emd-bot" background-color="${defaultTheme.contentColor}" padding="0">`);
    expect(mjml).toContain('<mj-text css-class="emd-raw-t" padding="0">');
    expect(mjml).not.toMatch(/css-class="[^"]*\bemd-s\b[^"]*emd-raw/);
  });

  it('takes part in content box edge marking', () => {
    const mjml = mjmlOf('Intro\n\n::: raw\n<div>x</div>\n:::');
    expect(mjml).toMatch(/css-class="emd-s emd-bg emd-top"/);
    expect(mjml).toMatch(/css-class="emd-bg emd-raw emd-bot"/);
  });

  it('accepts a quoted multi-value padding', () => {
    const mjml = mjmlOf('::: raw padding="0 32px"\n<div>x</div>\n:::');
    expect(mjml).toContain('padding="0px 32px"');
  });

  it('warns and falls back on invalid padding', async () => {
    const { html, warnings } = await render('::: raw padding=wide\n<div>x</div>\n:::');
    expect(html).toContain('<div>x</div>');
    expect(warnings?.some((w) => w.message.includes('raw padding'))).toBe(true);
  });

  it('preserves template tags', async () => {
    const { html } = await render('::: raw\n<a href="{{ url }}">Hi {{ first_name }}</a>\n:::');
    expect(html).toContain('href="{{ url }}"');
    expect(html).toContain('Hi {{ first_name }}');
  });

  it('leaves a button-shaped link inside it as a link', () => {
    const segments = segmentsOf('::: raw\n<p><a href="https://x.com" button>Go</a></p>\n:::');
    expect(segments.map((s) => s.type)).toEqual(['raw']);
    expect(segments[0].content).toContain('<a href="https://x.com" button>Go</a>');
  });

  it('drops internal markers written inside it', async () => {
    const { html } = await render('::: raw\n<div>a</div><!--EMAILMD:RAW_CLOSE--><div>b</div>\n:::');
    expect(html).toContain('<div>a</div><div>b</div>');
    expect(html).not.toContain('EMAILMD');
  });

  it('needs a closing fence at least as long as the opening one', () => {
    const segments = segmentsOf(':::: raw\n<p>a</p>\n:::\n<p>b</p>\n::::\n\nAfter');
    expect(segments.map((s) => s.type)).toEqual(['raw', 'text']);
    expect(segments[0].content).toContain('<p>a</p>\n:::\n<p>b</p>');
  });

  it('runs to the end of the document when unclosed', () => {
    const segments = segmentsOf('Before\n\n::: raw\n<div>open</div>\n\n*still raw*');
    expect(segments.map((s) => s.type)).toEqual(['text', 'raw']);
    expect(segments[1].content).toContain('*still raw*');
  });

  it('renders nothing when empty', () => {
    expect(mjmlOf('::: raw\n:::\n\nText')).not.toContain('emd-raw');
  });

  it('is escaped to text when raw HTML is disabled', async () => {
    const { html } = await render('::: raw\n<b onclick="x()">hi</b>\n:::', { allowHtml: false });
    expect(html).not.toContain('emd-raw');
    expect(html).not.toContain('<b onclick');
    expect(html).toContain('&lt;b');
  });

  it('recolors only its wrapper in dark mode, not the HTML inside', async () => {
    const { html } = await render('::: raw\n<div style="color:#123456">x</div>\n:::', { darkTheme: true });
    expect(html).toContain('.emd-s div');
    expect(html).toMatch(/class="emd-bg emd-raw[^"]*"/);
    expect(html).not.toMatch(/class="[^"]*\bemd-s\b[^"]*\bemd-raw\b/);
    expect(html).toMatch(/\.emd-raw-t > div \{ color: [^}]*!important/);
  });

  it('converts to plain text without its source indentation or hidden copies', async () => {
    const md = [
      '::: raw',
      '<table role="presentation">',
      '  <tr><td><img src="https://x.com/a.png" alt="Banner &#183; one"></td></tr>',
      '  <tr>',
      '    <td>Live text</td>',
      '  </tr>',
      '</table>',
      '<div style="display:none;mso-hide:all"><img src="https://x.com/a.png" alt="Banner &#183; one"></div>',
      ':::',
    ].join('\n');
    const { text } = await render(md);
    expect(text).toBe('[Image: Banner · one]\n\nLive text');
  });
});
