'use client';

import { useEffect, useRef, useState } from 'react';
import { render } from 'emailmd';
import type { RenderOptions, RenderResult, RenderWarning } from 'emailmd';

/** Options for the {@link useEmailmd} hook. Extends emailmd's {@link RenderOptions}. */
export interface UseEmailmdOptions extends RenderOptions {
  /**
   * Milliseconds to wait after the last markdown change before re-rendering.
   * Set to `0` to render immediately on every change. Default: `150`.
   */
  debounceMs?: number;
}

/** State returned by {@link useEmailmd}. */
export interface UseEmailmdResult {
  /** Rendered email HTML document. Empty string until the first render completes. */
  html: string;
  /** Plain-text rendering for the text/plain MIME part. Empty string until the first render completes. */
  text: string;
  /** Frontmatter metadata from the last successful render. */
  meta: RenderResult['meta'];
  /** Non-fatal warnings from the last render. Empty when the render was clean. */
  warnings: RenderWarning[];
  /**
   * Error thrown by the last render, or `null`. When set, `html`/`text`/`meta`
   * retain their values from the last successful render.
   */
  error: Error | null;
  /** True from the moment the input changes until the latest render lands. */
  isRendering: boolean;
}

interface RenderedState {
  html: string;
  text: string;
  meta: RenderResult['meta'];
  warnings: RenderWarning[];
  error: Error | null;
}

const INITIAL_STATE: RenderedState = {
  html: '',
  text: '',
  meta: {},
  warnings: [],
  error: null,
};

/**
 * Render markdown to email-safe HTML as it changes — debounced, race-safe,
 * and SSR-safe (returns the initial empty state on the server).
 *
 * Options are compared by value, so inline object literals are fine. The one
 * exception is a custom `wrapper` function: swapping one function for another
 * is not detected until the next input change, so memoize it if you switch
 * wrappers at runtime.
 *
 * @example
 * ```tsx
 * const { html, warnings, isRendering } = useEmailmd(markdown);
 * return <EmailPreview html={html} />;
 * ```
 */
export function useEmailmd(markdown: string, options: UseEmailmdOptions = {}): UseEmailmdResult {
  const { debounceMs = 150 } = options;

  // Latest options live in a ref so value-identical inline literals don't
  // retrigger renders (and function-valued options can't cause render loops).
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const optionsKey = JSON.stringify(options, (_key, value) =>
    typeof value === 'function' ? '[function]' : value
  );

  // Monotonic counter: only the newest in-flight render may commit state.
  const generationRef = useRef(0);

  const [state, setState] = useState<RenderedState>(INITIAL_STATE);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const generation = ++generationRef.current;
    setIsRendering(true);

    const run = async () => {
      const { debounceMs: _debounce, ...renderOptions } = optionsRef.current;
      try {
        const result = await render(markdown, renderOptions);
        if (generationRef.current !== generation) return;
        setState({
          html: result.html,
          text: result.text,
          meta: result.meta,
          warnings: result.warnings ?? [],
          error: null,
        });
      } catch (err) {
        if (generationRef.current !== generation) return;
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
      setIsRendering(false);
    };

    if (debounceMs > 0) {
      const timer = setTimeout(run, debounceMs);
      return () => clearTimeout(timer);
    }
    void run();
  }, [markdown, debounceMs, optionsKey]);

  return { ...state, isRendering };
}
