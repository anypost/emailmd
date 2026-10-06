import { describe, expect, it } from 'vitest';
import { render } from '../src/index.js';

/** One tag per templating language, with a matching URL-safe tag for hrefs. */
const SYNTAXES = [
  { name: 'Liquid', tag: '{{ first_name | default: "there" }}', url: '{{user_id}}' },
  { name: 'Handlebars', tag: '{{first_name}}', url: '{{user_id}}' },
  { name: 'Handlebars (unescaped)', tag: '{{{first_name}}}', url: '{{{user_id}}}' },
  { name: 'Mailchimp', tag: '*|FNAME|*', url: '*|EMAIL|*' },
  { name: 'SFMC', tag: '%%FirstName%%', url: '%%EmailAddr%%' },
  { name: 'AMPscript', tag: '%%=v(@first_name)=%%', url: '%%=v(@user_id)=%%' },
];

describe.each(SYNTAXES)('$name template tags', ({ tag, url }) => {
  it('survive in body text, in both parts', async () => {
    const { html, text } = await render(`Hi ${tag}, welcome.`);
    expect(html).toContain(`Hi ${tag}, welcome.`);
    expect(text).toContain(`Hi ${tag}, welcome.`);
  });

  it('survive in emphasis and headings', async () => {
    const { html, text } = await render(`# Hello ${tag}\n\n**Dear ${tag}**`);
    expect(html).toContain(`Hello ${tag}`);
    expect(html).toContain(`<strong>Dear ${tag}</strong>`);
    expect(text).toContain(`Dear ${tag}`);
  });

  it('survive in link text and hrefs', async () => {
    const { html, text } = await render(`See [your page, ${tag}](https://example.com/u?id=${url}&src=email).`);
    expect(html).toContain(`href="https://example.com/u?id=${url}&amp;src=email"`);
    expect(html).toContain(`your page, ${tag}</a>`);
    expect(text).toContain(`https://example.com/u?id=${url}&src=email`);
    expect(text).toContain(`your page, ${tag}`);
  });

  it('survive in button URLs and labels', async () => {
    const { html, text } = await render(`[Open ${tag}](https://example.com/go?id=${url}){button}`);
    expect(html).toContain(`href="https://example.com/go?id=${url}"`);
    expect(html).toContain(`Open ${tag}`);
    expect(text).toContain(`https://example.com/go?id=${url}`);
  });

  it('survive minification', async () => {
    const { html } = await render(`Hi ${tag}\n\n[Open](https://example.com/go?id=${url}){button}`, { minify: true });
    expect(html).toContain(`Hi ${tag}`);
    expect(html).toContain(`https://example.com/go?id=${url}`);
  });

  it('survive as a whole href', async () => {
    const { html } = await render(`[Unsubscribe](${url})`);
    expect(html).toContain(`href="${url}"`);
  });
});

describe('Mailchimp merge tags', () => {
  it('are not parsed as emphasis', async () => {
    const { html } = await render('Hi *|FNAME|*, your code is *|COUPON|*.');
    expect(html).not.toContain('<em>');
    expect(html).toContain('Hi *|FNAME|*, your code is *|COUPON|*.');
  });

  it('keep conditional and function tags, including lowercase arguments', async () => {
    const md = '*|IF:FNAME|*Hi *|FNAME|*,*|ELSE:|*Hi there,*|END:IF|*\n\n# Sent *|DATE:d/m/y|*';
    const { html, text } = await render(md);
    expect(html).toContain('*|IF:FNAME|*Hi *|FNAME|*,*|ELSE:|*Hi there,*|END:IF|*');
    expect(text).toContain('*|IF:FNAME|*Hi *|FNAME|*,*|ELSE:|*Hi there,*|END:IF|*');
    // Headings are uppercased in the text part, but not the tag inside
    expect(text).toContain('SENT *|DATE:d/m/y|*');
  });

  it('are not percent-encoded in autolinked URLs', async () => {
    const { html } = await render('Visit https://example.com/?e=*|EMAIL|* today');
    expect(html).toContain('href="https://example.com/?e=*|EMAIL|*"');
    expect(html).not.toContain('%7C');
  });

  it('leave emphasis next to table pipes alone', async () => {
    const { html } = await render('| a | b |\n|---|---|\n| *x*|*y* |');
    expect(html).toContain('<em>x</em>');
    expect(html).toContain('<em>y</em>');
  });

  it('are accepted as a directive color value', async () => {
    const { html, warnings } = await render('[Go](https://x.com){button color=*|BRAND|*}');
    expect(html).toContain('*|BRAND|*');
    expect(warnings?.some((w) => w.message.includes('Invalid color'))).toBeFalsy();
  });

  it('are escaped to text when raw HTML is disabled, like other tags', async () => {
    const { html } = await render('Hi *|FNAME|*', { allowHtml: false });
    expect(html).toContain('Hi *|FNAME|*');
  });
});
