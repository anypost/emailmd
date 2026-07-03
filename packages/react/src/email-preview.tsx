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
}

const MOBILE_WIDTH = 375;

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
  title = 'Email preview',
  style,
  ...rest
}: EmailPreviewProps) {
  const width =
    device === 'desktop' ? '100%' : device === 'mobile' ? MOBILE_WIDTH : device;

  return (
    <iframe
      srcDoc={html}
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
