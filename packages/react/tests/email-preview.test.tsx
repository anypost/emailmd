import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailPreview, hasDarkModeStyles } from '../src/index.js';

const HTML = '<!doctype html><html><body><p>Hi</p></body></html>';
const DARK_HTML =
  '<!doctype html><html><head><style>@media (prefers-color-scheme: dark) { body { background: #000 !important; } }</style></head><body><p>Hi</p></body></html>';

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

  it('emulateColorScheme="dark" rewrites prefers-color-scheme rules to apply unconditionally', () => {
    render(<EmailPreview html={DARK_HTML} emulateColorScheme="dark" />);
    const srcDoc = screen.getByTitle('Email preview').getAttribute('srcDoc')!;
    expect(srcDoc).toContain('@media all');
    expect(srcDoc).not.toContain('prefers-color-scheme');
    // Only the media condition changes — the rules themselves are untouched.
    expect(srcDoc).toContain('background: #000 !important');
  });

  it('emulateColorScheme="light" disables the dark rules even on a dark OS', () => {
    render(<EmailPreview html={DARK_HTML} emulateColorScheme="light" />);
    const srcDoc = screen.getByTitle('Email preview').getAttribute('srcDoc')!;
    expect(srcDoc).toContain('@media not all');
    expect(srcDoc).not.toContain('prefers-color-scheme');
  });

  it('follows the OS when emulateColorScheme is unset', () => {
    render(<EmailPreview html={DARK_HTML} />);
    expect(screen.getByTitle('Email preview').getAttribute('srcDoc')).toBe(DARK_HTML);
  });

  it('handles minified media queries', () => {
    const minified = DARK_HTML.replace(
      '@media (prefers-color-scheme: dark)',
      '@media(prefers-color-scheme:dark)'
    );
    render(<EmailPreview html={minified} emulateColorScheme="dark" />);
    const srcDoc = screen.getByTitle('Email preview').getAttribute('srcDoc')!;
    expect(srcDoc).not.toContain('prefers-color-scheme');
  });
});

describe('hasDarkModeStyles', () => {
  it('detects dark-mode documents', () => {
    expect(hasDarkModeStyles(DARK_HTML)).toBe(true);
    expect(hasDarkModeStyles(HTML)).toBe(false);
  });

  it('is not fooled by regex state across calls', () => {
    expect(hasDarkModeStyles(DARK_HTML)).toBe(true);
    expect(hasDarkModeStyles(DARK_HTML)).toBe(true);
  });
});
