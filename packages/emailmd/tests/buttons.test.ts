import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

describe('button syntax', async () => {
  it('renders {button} link as a styled button', async () => {
    const { html } = await render('[Get Started](https://example.com){button}');
    // Should not be a plain <a> tag — MJML compiles buttons to table-based markup
    expect(html).toContain('https://example.com');
    expect(html).toContain('Get Started');
    // Should have buttonColor as background
    expect(html).toContain('#18181b'); // default buttonColor
  });

  it('renders {button.secondary} with border styling', async () => {
    const { html } = await render('[Learn More](https://example.com){button.secondary}');
    expect(html).toContain('Learn More');
    expect(html).toContain('https://example.com');
    // Secondary button has transparent background and a border
    expect(html).toContain('transparent');
    expect(html).toContain('2px solid');
  });

  it('renders {button color="#dc2626"} with custom color', async () => {
    const { html } = await render('[Shop Sale](https://example.com){button color="#dc2626"}');
    expect(html).toContain('Shop Sale');
    expect(html).toContain('#dc2626');
  });

  it('renders button with mustache template tag in URL', async () => {
    const { html } = await render('[View Domain]({{ url }}){button}');
    expect(html).toContain('{{ url }}');
    expect(html).toContain('View Domain');
    expect(html).toContain('#18181b');
  });

  it('renders button with mustache template tag without spaces', async () => {
    const { html } = await render('[View Domain]({{url}}){button}');
    expect(html).toContain('{{url}}');
    expect(html).toContain('View Domain');
    expect(html).toContain('#18181b');
  });

  it('renders button with template tag in link text', async () => {
    const { html } = await render('[{{ label }}](https://example.com){button}');
    expect(html).toContain('{{ label }}');
    expect(html).toContain('https://example.com');
    expect(html).toContain('#18181b');
  });

  it('renders plain link with template tag in URL', async () => {
    const { html } = await render('[View Domain]({{ url }})');
    expect(html).toContain('href="{{ url }}"');
    expect(html).toContain('View Domain');
  });

  it('leaves plain links as regular <a> tags', async () => {
    const { html } = await render('[Normal link](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Normal link');
    // Should be a standard inline link, not button table markup
    expect(html).not.toContain('inner-padding');
  });

  it('preserves button text correctly', async () => {
    const { html } = await render('[Click Here Now](https://example.com/action){button}');
    expect(html).toContain('Click Here Now');
  });

  it('renders two buttons on the same line side-by-side', async () => {
    const { html } = await render('[Get Started](https://example.com){button} [Learn More](https://example.com/more){button.secondary}');
    expect(html).toContain('Get Started');
    expect(html).toContain('Learn More');
    expect(html).toContain('https://example.com/more');
    // Secondary should have border styling
    expect(html).toContain('transparent');
    expect(html).toContain('2px solid');
  });

  it('renders three buttons on the same line side-by-side', async () => {
    const { html } = await render('[A](https://a.com){button} [B](https://b.com){button.secondary} [C](https://c.com){button color="#dc2626"}');
    expect(html).toContain('https://a.com');
    expect(html).toContain('https://b.com');
    expect(html).toContain('https://c.com');
    expect(html).toContain('#dc2626');
  });

  it('keeps buttons stacked when separated by blank lines', async () => {
    const md = '[Get Started](https://example.com){button}\n\n[Learn More](https://example.com/more){button.secondary}';
    const { html } = await render(md);
    expect(html).toContain('Get Started');
    expect(html).toContain('Learn More');
  });

  it('produces plain text for side-by-side buttons', async () => {
    const { text } = await render('[Get Started](https://example.com){button} [Learn More](https://example.com/more){button.secondary}');
    expect(text).toContain('Get Started: https://example.com');
    expect(text).toContain('Learn More: https://example.com/more');
  });
});

describe('full-width buttons', async () => {
  it('renders {button width="full"} as a full-width button', async () => {
    const { html } = await render('[Get Started](https://example.com){button width="full"}');
    expect(html).toContain('https://example.com');
    expect(html).toContain('Get Started');
    expect(html).toContain('width="100%"');
  });

  it('renders {button.secondary width="full"} as a full-width secondary button', async () => {
    const { html } = await render('[Learn More](https://example.com){button.secondary width="full"}');
    expect(html).toContain('Learn More');
    expect(html).toContain('width="100%"');
    expect(html).toContain('transparent');
    expect(html).toContain('2px solid');
  });

  it('renders {button color="#dc2626" width="full"} with custom color and full width', async () => {
    const { html } = await render('[Shop Sale](https://example.com){button color="#dc2626" width="full"}');
    expect(html).toContain('Shop Sale');
    expect(html).toContain('#dc2626');
    expect(html).toContain('width="100%"');
  });

  it('regular button is narrower than full-width button', async () => {
    const regular = (await render('[Click](https://example.com){button}')).html;
    const fullWidth = (await render('[Click](https://example.com){button width="full"}')).html;
    // Full-width button should produce a wider table structure
    expect(fullWidth).toContain('width:100%');
    // Regular button table uses border-collapse:separate without width:100%
    expect(regular).not.toContain('style="border-collapse:separate;width:100%');
  });

  it('renders full-width button in a button group', async () => {
    const { html } = await render('[A](https://a.com){button width="full"} [B](https://b.com){button.secondary}');
    expect(html).toContain('https://a.com');
    expect(html).toContain('https://b.com');
    expect(html).toContain('width="100%"');
  });

  it('produces plain text for full-width buttons', async () => {
    const { text } = await render('[Get Started](https://example.com){button width="full"}');
    expect(text).toContain('Get Started: https://example.com');
  });
});

describe('semantic button colors', async () => {
  it('renders {button.success} with green background', async () => {
    const { html } = await render('[Confirm](https://example.com){button.success}');
    expect(html).toContain('Confirm');
    expect(html).toContain('#16a34a');
  });

  it('renders {button.danger} with red background', async () => {
    const { html } = await render('[Delete](https://example.com){button.danger}');
    expect(html).toContain('Delete');
    expect(html).toContain('#dc2626');
  });

  it('renders {button.warning} with amber background', async () => {
    const { html } = await render('[Caution](https://example.com){button.warning}');
    expect(html).toContain('Caution');
    expect(html).toContain('#d97706');
  });

  it('renders semantic colors in button groups', async () => {
    const { html } = await render('[Confirm](https://a.com){button.success} [Delete](https://b.com){button.danger}');
    expect(html).toContain('#16a34a');
    expect(html).toContain('#dc2626');
  });

  it('produces plain text for semantic buttons', async () => {
    const { text } = await render('[Confirm](https://example.com){button.success}');
    expect(text).toContain('Confirm: https://example.com');
  });
});

describe('custom button variant colors via theme', async () => {
  it('renders success button with custom theme color', async () => {
    const { html } = await render('[OK](https://example.com){button.success}', { theme: { successColor: '#059669' } });
    expect(html).toContain('#059669');
    expect(html).not.toContain('#16a34a');
  });

  it('renders success button with custom text color', async () => {
    const { html } = await render('[OK](https://example.com){button.success}', { theme: { successColor: '#86efac', successTextColor: '#000000' } });
    expect(html).toContain('#86efac');
    expect(html).toContain('#000000');
  });

  it('renders danger button with custom theme color', async () => {
    const { html } = await render('[Delete](https://example.com){button.danger}', { theme: { dangerColor: '#b91c1c' } });
    expect(html).toContain('#b91c1c');
    expect(html).not.toContain('#dc2626');
  });

  it('renders warning button with custom theme color', async () => {
    const { html } = await render('[Caution](https://example.com){button.warning}', { theme: { warningColor: '#b45309' } });
    expect(html).toContain('#b45309');
    expect(html).not.toContain('#d97706');
  });

  it('renders secondary button with custom theme color', async () => {
    const { html } = await render('[More](https://example.com){button.secondary}', { theme: { secondaryColor: '#6366f1' } });
    expect(html).toContain('#6366f1');
    expect(html).toContain('2px solid');
  });

  it('renders secondary button with custom text color', async () => {
    const { html } = await render('[More](https://example.com){button.secondary}', { theme: { secondaryColor: '#6366f1', secondaryTextColor: '#312e81' } });
    expect(html).toContain('2px solid #6366f1');
    expect(html).toContain('#312e81');
  });

  it('applies variant colors from frontmatter', async () => {
    const md = `---\nsuccess_color: "#059669"\n---\n\n[OK](https://example.com){button.success}`;
    const { html } = await render(md);
    expect(html).toContain('#059669');
  });
});

describe('button border-radius', async () => {
  it('renders {button border-radius="16px"} with custom border radius', async () => {
    const { html } = await render('[Click](https://example.com){button border-radius="16px"}');
    expect(html).toContain('border-radius:16px');
    expect(html).not.toContain('border-radius:8px');
  });

  it('applies theme borderRadius to buttons', async () => {
    const { html } = await render('[Click](https://example.com){button}', { theme: { borderRadius: '12px' } });
    expect(html).toContain('border-radius:12px');
    expect(html).not.toContain('border-radius:8px');
  });

  it('per-button border-radius overrides theme', async () => {
    const { html } = await render('[Click](https://example.com){button border-radius="0"}', { theme: { borderRadius: '12px' } });
    expect(html).toContain('border-radius:0');
    expect(html).not.toContain('border-radius:12px');
  });

  it('appends px to a unitless border-radius attr', async () => {
    const { html, warnings } = await render('[Click](https://example.com){button border-radius="10"}');
    expect(warnings).toBeUndefined();
    expect(html).toContain('border-radius:10px');
    // The old behavior emitted the bare number, which clients drop as invalid CSS.
    expect(html).not.toMatch(/border-radius:\s*10[^p]/);
  });

  it('appends px per token in a multi-value border-radius attr', async () => {
    const { html } = await render('[Click](https://example.com){button border-radius="8 16"}');
    expect(html).toContain('border-radius:8px 16px');
  });

  it('applies theme borderRadius in button groups', async () => {
    const { html } = await render('[A](https://a.com){button} [B](https://b.com){button.secondary}', { theme: { borderRadius: '20px' } });
    expect(html).toContain('border-radius:20px');
    expect(html).not.toContain('border-radius:8px');
  });

  it('allows mixed border-radius in button groups', async () => {
    const { html } = await render('[A](https://a.com){button border-radius="0"} [B](https://b.com){button}');
    expect(html).toContain('border-radius:0');
    expect(html).toContain('border-radius:8px');
  });

  it('applies border_radius from frontmatter to buttons', async () => {
    const md = `---\nborder_radius: "24px"\n---\n\n[Click](https://example.com){button}`;
    const { html } = await render(md);
    expect(html).toContain('border-radius:24px');
    expect(html).not.toContain('border-radius:8px');
  });
});

describe('button fallback', async () => {
  it('renders fallback subcopy text below a button', async () => {
    const { html } = await render('[Reset Password](https://example.com/reset){button fallback}');
    expect(html).toContain('trouble clicking');
    expect(html).toContain('https://example.com/reset');
    expect(html).toContain('Reset Password');
  });

  it('does not render fallback when attribute is absent', async () => {
    const { html } = await render('[Click](https://example.com){button}');
    expect(html).not.toContain('trouble clicking');
  });

  it('renders fallback only for opted-in buttons in a group', async () => {
    const { html } = await render('[Accept](https://example.com/accept){button fallback} [Decline](https://example.com/decline){button.secondary}');
    expect(html).toContain('trouble clicking');
    expect(html).toContain('https://example.com/accept');
    // Decline URL should not appear in fallback text (only in button itself)
    const fallbackSection = html.split('trouble clicking')[1];
    expect(fallbackSection).not.toContain('https://example.com/decline');
  });

  it('renders fallback for all opted-in buttons in a group', async () => {
    const { html } = await render('[A](https://a.com){button fallback} [B](https://b.com){button.secondary fallback}');
    expect(html).toContain('trouble clicking');
    expect(html).toContain('https://a.com');
    expect(html).toContain('https://b.com');
  });

  it('works with semantic color buttons', async () => {
    const { html } = await render('[Confirm](https://example.com/confirm){button.success fallback}');
    expect(html).toContain('#16a34a');
    expect(html).toContain('trouble clicking');
    expect(html).toContain('https://example.com/confirm');
  });

  it('works with secondary buttons', async () => {
    const { html } = await render('[Learn More](https://example.com){button.secondary fallback}');
    expect(html).toContain('transparent');
    expect(html).toContain('trouble clicking');
  });

  it('renders custom fallback text when provided', async () => {
    const { html } = await render('[Réinitialiser](https://example.com/reset){button fallback="Si vous avez des difficultés, copiez cette URL :"}');
    expect(html).toContain('Si vous avez des difficultés');
    expect(html).toContain('https://example.com/reset');
    expect(html).not.toContain('trouble clicking');
  });

  it('renders custom fallback in button group', async () => {
    const { html } = await render('[Accepter](https://example.com/accept){button fallback="Lien :"} [Refuser](https://example.com/decline){button.secondary}');
    expect(html).toContain('Lien :');
    expect(html).toContain('https://example.com/accept');
    expect(html).not.toContain('trouble clicking');
  });

  it('plain text is unchanged for fallback buttons', async () => {
    const { text } = await render('[Reset](https://example.com/reset){button fallback}');
    expect(text).toContain('Reset: https://example.com/reset');
  });

  it('sizes the button from theme.fontSize rather than a fixed size', async () => {
    const { html } = await render('[Go](https://example.com){button}', { theme: { fontSize: '13px' } });
    // The button font size follows the body scale, so a smaller theme shrinks the button too.
    expect(html).toContain('font-size:13px;font-weight:600');
  });
});
