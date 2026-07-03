'use client';

import type { IframeHTMLAttributes } from 'react';

/** Props for {@link EmailPreview}. All standard iframe props are passed through. */
export interface EmailPreviewProps
  extends Omit<IframeHTMLAttributes<HTMLIFrameElement>, 'srcDoc'> {
  /** Rendered email HTML document (`RenderResult.html`). */
  html: string;
  /**
   * Viewport to simulate: `'desktop'` fills the container, `'mobile'` renders
   * at 375px, or pass a pixel width. Default: `'desktop'`.
   */
  device?: 'desktop' | 'mobile' | number;
  /**
   * Pin the preview to one of the email's color-scheme variants. An iframe
   * follows the OS scheme, so without this the dark rules of a `theme: auto`
   * email apply whenever the *viewer's* OS is dark. `'dark'` rewrites the
   * document's `prefers-color-scheme: dark` rules to apply unconditionally;
   * `'light'` rewrites them to never apply. Leave unset to follow the OS.
   * Has no effect when the email doesn't opt into dark mode (see
   * {@link hasDarkModeStyles}).
   */
  emulateColorScheme?: 'light' | 'dark';
}

const MOBILE_WIDTH = 375;

const DARK_MEDIA_RE = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi;

/**
 * True when a rendered email opts into automatic dark mode (contains a
 * `prefers-color-scheme: dark` media query). Useful for enabling a dark-mode
 * preview toggle only when it would do something.
 */
export function hasDarkModeStyles(html: string): boolean {
  DARK_MEDIA_RE.lastIndex = 0;
  return DARK_MEDIA_RE.test(html);
}

function pinColorScheme(html: string, scheme: 'light' | 'dark'): string {
  // '@media all' always applies; '@media not all' never does.
  return html.replace(DARK_MEDIA_RE, scheme === 'dark' ? '@media all' : '@media not all');
}

/**
 * Sandboxed iframe preview of a rendered email.
 *
 * @example
 * ```tsx
 * const { html } = useEmailmd(markdown);
 * <EmailPreview html={html} device="mobile" />
 * ```
 */
export function EmailPreview({
  html,
  device = 'desktop',
  emulateColorScheme,
  title = 'Email preview',
  style,
  ...rest
}: EmailPreviewProps) {
  const width =
    device === 'desktop' ? '100%' : device === 'mobile' ? MOBILE_WIDTH : device;

  return (
    <iframe
      srcDoc={emulateColorScheme ? pinColorScheme(html, emulateColorScheme) : html}
      sandbox="allow-same-origin"
      title={title}
      style={{
        width,
        height: '100%',
        border: 0,
        display: 'block',
        backgroundColor: '#ffffff',
        ...style,
      }}
      {...rest}
    />
  );
}
