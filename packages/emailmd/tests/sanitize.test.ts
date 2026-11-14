import { describe, it, expect } from 'vitest';
import { isSafeUrl } from '../src/sanitize.js';

describe('isSafeUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=c',
    'mailto:hi@example.com',
    'tel:+15555550100',
    '/relative/path',
    '#anchor',
    '',
    '{{unsubscribe_url}}',
    '{{{raw_url}}}',
    '{% if a %}https://a.example{% else %}https://b.example{% endif %}',
    '*|UNSUB|*',
    '%%=RedirectTo(@url)=%%',
    '${url}',
    '[[url]]',
    '{{base_url}}/path',
    'https://example.com/u?id={{user_id}}',
  ])('allows %j', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '  javascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    // The WHATWG URL parser removes tab/LF/CR anywhere and strips leading C0
    // controls and spaces, so a browser reads each of these as javascript:.
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    'j\ta\nv\ra\tscript:alert(1)',
    '\x01javascript:alert(1)',
    '\x00javascript:alert(1)',
    ' \x1f javascript:alert(1)',
    'javascript\t:alert(1)',
    // The sending app may resolve a template tag to nothing.
    '{{x}}javascript:alert(1)//}}',
    'java{{x}}script:alert(1)',
    '{% if a %}{% endif %}javascript:alert(1)',
    '*|X|*javascript:alert(1)',
    '%%x%%javascript:alert(1)',
    '${x}javascript:alert(1)',
    '[[x]]javascript:alert(1)',
    '{{x}}\tdata:text/html,x',
  ])('blocks %j', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});
