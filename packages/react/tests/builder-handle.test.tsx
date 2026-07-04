import { describe, it, expect, beforeEach } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EmailmdBuilder, type EmailmdBuilderHandle } from '../src/index.js';

beforeEach(() => {
  localStorage.clear();
});

function renderWithHandle(props: Partial<React.ComponentProps<typeof EmailmdBuilder>> = {}) {
  const ref = createRef<EmailmdBuilderHandle>();
  const utils = render(
    <EmailmdBuilder ref={ref} autoSave={false} debounceMs={0} defaultValue="# Start" {...props} />
  );
  expect(ref.current).toBeTruthy();
  return { ref: ref as { current: EmailmdBuilderHandle }, ...utils };
}

describe('EmailmdBuilderHandle', () => {
  it('getMarkdown returns the current document', () => {
    const { ref } = renderWithHandle();
    expect(ref.current.getMarkdown()).toBe('# Start');
  });

  it('setMarkdown replaces the document and reports through onChange', async () => {
    const changes: string[] = [];
    const { ref } = renderWithHandle({ onChange: (md) => changes.push(md) });

    act(() => ref.current.setMarkdown('# From AI\n\nGenerated content.'));

    expect(ref.current.getMarkdown()).toBe('# From AI\n\nGenerated content.');
    expect(changes.at(-1)).toBe('# From AI\n\nGenerated content.');
    await waitFor(() => {
      const frame = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(frame.getAttribute('srcDoc')).toContain('From AI');
    });
  });

  it('setMarkdown is a single undo step', () => {
    const { ref } = renderWithHandle();
    act(() => ref.current.setMarkdown('# Replaced wholesale'));
    expect(ref.current.getMarkdown()).toBe('# Replaced wholesale');

    const editor = document.querySelector('.cm-content') as HTMLElement;
    act(() => {
      fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    });
    expect(ref.current.getMarkdown()).toBe('# Start');
  });

  it('insertAtCursor and replaceSelection edit relative to the selection', () => {
    const { ref } = renderWithHandle();

    // Cursor starts at 0; insert leaves the rest of the doc in place.
    act(() => ref.current.insertAtCursor('NEW '));
    expect(ref.current.getMarkdown()).toBe('NEW # Start');

    // Selection reflects the cursor after the insert.
    expect(ref.current.getSelection()).toEqual({ text: '', from: 4, to: 4 });

    act(() => ref.current.replaceSelection('MORE '));
    expect(ref.current.getMarkdown()).toBe('NEW MORE # Start');
  });

  it('setMarkdown feeds autosave', async () => {
    const ref = createRef<EmailmdBuilderHandle>();
    render(<EmailmdBuilder ref={ref} debounceMs={0} defaultValue="# Draft" />);

    act(() => ref.current!.setMarkdown('# Saved by AI'));

    await waitFor(() => {
      expect(localStorage.getItem('emailmd:draft')).toBe('# Saved by AI');
    });
  });
});

describe('toolbarItems', () => {
  it('renders custom buttons and passes the editor API to onClick', () => {
    const ref = createRef<EmailmdBuilderHandle>();
    let clicked: EmailmdBuilderHandle | null = null;
    render(
      <EmailmdBuilder
        ref={ref}
        autoSave={false}
        debounceMs={0}
        defaultValue="# Doc"
        toolbarItems={[
          { id: 'ai', label: 'AI', onClick: (editor) => (clicked = editor) },
          { id: 'zap', label: 'Zap', icon: <svg data-testid="zap-icon" />, onClick: () => {} },
        ]}
      />
    );

    // Text item renders its label; icon item is icon-only with the label as aria-label.
    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    expect(clicked).toBe(ref.current);
    expect(screen.getByRole('button', { name: 'Zap' }).querySelector('[data-testid="zap-icon"]')).toBeTruthy();
  });

  it('custom button can rewrite the document through the editor API', async () => {
    render(
      <EmailmdBuilder
        autoSave={false}
        debounceMs={0}
        defaultValue="# Doc"
        toolbarItems={[
          {
            id: 'ai',
            label: 'AI',
            onClick: (editor) => editor.setMarkdown(`${editor.getMarkdown()}\n\nAppended by AI.`),
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI' }));

    await waitFor(() => {
      const frame = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(frame.getAttribute('srcDoc')).toContain('Appended by AI.');
    });
  });
});
