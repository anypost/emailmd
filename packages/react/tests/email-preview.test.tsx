import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailPreview } from '../src/index.js';

const HTML = '<!doctype html><html><body><p>Hi</p></body></html>';

describe('EmailPreview', () => {
  it('renders a sandboxed iframe with the html as srcDoc', () => {
    render(<EmailPreview html={HTML} />);
    const frame = screen.getByTitle('Email preview');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('srcDoc')).toBe(HTML);
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
  });

  it('fills the container width on desktop (default)', () => {
    render(<EmailPreview html={HTML} />);
    expect(screen.getByTitle('Email preview').style.width).toBe('100%');
  });

  it('renders at 375px for device="mobile"', () => {
    render(<EmailPreview html={HTML} device="mobile" />);
    expect(screen.getByTitle('Email preview').style.width).toBe('375px');
  });

  it('accepts a numeric pixel width', () => {
    render(<EmailPreview html={HTML} device={600} />);
    expect(screen.getByTitle('Email preview').style.width).toBe('600px');
  });

  it('passes through iframe props and allows overrides', () => {
    render(
      <EmailPreview
        html={HTML}
        title="Custom title"
        className="frame"
        sandbox=""
        style={{ height: '400px' }}
      />
    );
    const frame = screen.getByTitle('Custom title');
    expect(frame.className).toBe('frame');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.style.height).toBe('400px');
    // Defaults not overridden still apply.
    expect(frame.style.width).toBe('100%');
  });
});
