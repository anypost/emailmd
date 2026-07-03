import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EmailmdBuilder, DEFAULT_TEMPLATE } from '../src/index.js';

beforeEach(() => {
  localStorage.clear();
});

describe('EmailmdBuilder', () => {
  it('renders the toolbar, tabs, and preview iframe', async () => {
    render(<EmailmdBuilder autoSave={false} debounceMs={0} />);

    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('HTML Source')).toBeTruthy();
    expect(screen.getByText('Plain Text')).toBeTruthy();

    // The default template renders into the preview iframe.
    await waitFor(() => {
      const frame = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(frame.getAttribute('srcDoc')).toContain('Welcome!');
    });
  });

  it('starts from defaultValue and reports edits via onChange', async () => {
    const changes: string[] = [];
    render(
      <EmailmdBuilder
        autoSave={false}
        debounceMs={0}
        defaultValue="# Custom start"
        onChange={(md) => changes.push(md)}
      />
    );

    await waitFor(() => {
      const frame = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(frame.getAttribute('srcDoc')).toContain('Custom start');
    });
    expect(changes).toEqual([]);
  });

  it('shows the warnings banner with a count for multiple warnings', async () => {
    const md = `---
brand_color: '"bad'
---

::: callout bg=also;bad
Hi
:::`;
    render(<EmailmdBuilder autoSave={false} debounceMs={0} defaultValue={md} />);

    await waitFor(() => {
      expect(screen.getByText(/render warnings/)).toBeTruthy();
    });
  });

  it('restores a saved draft when autosave is enabled', async () => {
    localStorage.setItem('emailmd:draft', '# Saved draft content');
    render(<EmailmdBuilder debounceMs={0} />);

    await waitFor(() => {
      const frame = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(frame.getAttribute('srcDoc')).toContain('Saved draft content');
    });
  });

  it('exports the default template for reuse', () => {
    expect(DEFAULT_TEMPLATE).toContain('::: header');
  });
});
