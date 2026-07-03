import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmailmd } from '../src/index.js';

const immediate = { debounceMs: 0 };

describe('useEmailmd', () => {
  it('starts in the rendering state with empty output', () => {
    const { result } = renderHook(() => useEmailmd('# Hello', immediate));
    expect(result.current.isRendering).toBe(true);
    expect(result.current.html).toBe('');
    expect(result.current.text).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('renders markdown to html and text', async () => {
    const { result } = renderHook(() => useEmailmd('# Hello\n\nWorld.', immediate));
    await waitFor(() => expect(result.current.isRendering).toBe(false));
    expect(result.current.html).toContain('<!doctype html>');
    expect(result.current.html).toContain('Hello');
    expect(result.current.text).toContain('World.');
    expect(result.current.error).toBeNull();
  });

  it('exposes frontmatter meta', async () => {
    const md = '---\npreheader: Welcome aboard\n---\n\n# Hi';
    const { result } = renderHook(() => useEmailmd(md, immediate));
    await waitFor(() => expect(result.current.isRendering).toBe(false));
    expect(result.current.meta.preheader).toBe('Welcome aboard');
  });

  it('surfaces render warnings and keeps them empty for clean renders', async () => {
    const { result, rerender } = renderHook(
      ({ md }: { md: string }) => useEmailmd(md, immediate),
      { initialProps: { md: '# Clean' } }
    );
    await waitFor(() => expect(result.current.isRendering).toBe(false));
    expect(result.current.warnings).toEqual([]);

    rerender({ md: '::: callout bg=nope;nope\nHi\n:::' });
    await waitFor(() =>
      expect(result.current.warnings.some((w) => w.stage === 'content')).toBe(true)
    );
  });

  it('re-renders when markdown changes and settles on the latest input', async () => {
    const { result, rerender } = renderHook(
      ({ md }: { md: string }) => useEmailmd(md, immediate),
      { initialProps: { md: '# First' } }
    );
    // Fire several updates in quick succession without awaiting.
    rerender({ md: '# Second' });
    rerender({ md: '# Third' });
    await waitFor(() => expect(result.current.isRendering).toBe(false));
    expect(result.current.html).toContain('Third');
    expect(result.current.html).not.toContain('Second');
  });

  it('re-renders when option values change, even via inline literals', async () => {
    const { result, rerender } = renderHook(
      ({ brand }: { brand: string }) =>
        useEmailmd('[Go](https://example.com){button}', {
          debounceMs: 0,
          theme: { buttonColor: brand },
        }),
      { initialProps: { brand: '#ff0000' } }
    );
    await waitFor(() => expect(result.current.html).toContain('#ff0000'));

    rerender({ brand: '#00ff00' });
    await waitFor(() => expect(result.current.html).toContain('#00ff00'));
  });

  it('debounces rapid input', async () => {
    const { result, rerender } = renderHook(
      ({ md }: { md: string }) => useEmailmd(md, { debounceMs: 50 }),
      { initialProps: { md: '# One' } }
    );
    rerender({ md: '# Two' });
    rerender({ md: '# Three' });
    expect(result.current.html).toBe('');
    await waitFor(() => expect(result.current.isRendering).toBe(false), {
      timeout: 5000,
    });
    expect(result.current.html).toContain('Three');
  });

  it('keeps the last good output and sets error when render throws', async () => {
    // A wrapper that returns a non-string makes mjml compilation throw.
    const badWrapper = (() => null) as unknown as 'default';
    const { result, rerender } = renderHook(
      ({ wrapper }: { wrapper: 'default' | undefined }) =>
        useEmailmd('# Good', { debounceMs: 0, wrapper }),
      { initialProps: { wrapper: undefined as 'default' | undefined } }
    );
    await waitFor(() => expect(result.current.html).toContain('Good'));

    rerender({ wrapper: badWrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isRendering).toBe(false);
    // Last good output is retained alongside the error.
    expect(result.current.html).toContain('Good');
  });
});
