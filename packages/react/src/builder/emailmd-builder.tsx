'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderOptions } from 'emailmd';
import { useEmailmd } from '../use-emailmd.js';
import { Button, cx } from './ui.js';
import { PencilIcon, XIcon } from './icons.js';
import { CodeEditor, type CodeEditorHandle } from './code-editor.js';
import { Toolbar } from './toolbar.js';
import { OutputPane } from './output-pane.js';
import { useAutoSave } from './use-auto-save.js';
import { DEFAULT_DRAFT_KEY, clearDraft, loadDraft } from './storage.js';
import { readShareFromLocation } from './share.js';
import { DEFAULT_TEMPLATE } from './default-template.js';

export interface EmailmdBuilderProps {
  /**
   * Initial markdown when there is no saved draft or shared link.
   * Defaults to the built-in starter template.
   */
  defaultValue?: string;
  /** Controlled markdown value. Omit for uncontrolled operation. */
  value?: string;
  /** Called with the markdown on every edit. */
  onChange?: (markdown: string) => void;
  /**
   * Persist drafts to localStorage. `true` (default) uses the key
   * `"emailmd:draft"`; pass a string to use a custom key; `false` disables.
   * Ignored in controlled mode.
   */
  autoSave?: boolean | string;
  /**
   * Read markdown from `#md=` URL fragments and show a share-link button in
   * the output pane. Default: `false`.
   */
  share?: boolean;
  /** UI color scheme. Default: `'light'`. */
  colorScheme?: 'light' | 'dark';
  /** Options passed through to emailmd's `render()` for the preview. */
  renderOptions?: RenderOptions;
  /** Debounce between typing and re-render, in ms. Default: `150`. */
  debounceMs?: number;
  className?: string;
}

/**
 * Drop-in markdown email builder: CodeMirror editor with a formatting
 * toolbar, theme editor, emoji/snippet pickers, live preview, HTML/plain-text
 * output, warnings, autosave, and optional share links.
 *
 * Import the stylesheet once alongside it:
 * ```ts
 * import '@emailmd/react/styles.css';
 * ```
 */
export function EmailmdBuilder({
  defaultValue,
  value,
  onChange,
  autoSave = true,
  share = false,
  colorScheme = 'light',
  renderOptions,
  debounceMs,
  className,
}: EmailmdBuilderProps) {
  const controlled = value !== undefined;
  const storageKey = typeof autoSave === 'string' ? autoSave : DEFAULT_DRAFT_KEY;
  const autoSaveEnabled = !controlled && autoSave !== false;
  const hasExplicitInitial = defaultValue !== undefined;

  const [internal, setInternal] = useState(() => {
    if (controlled) return value;
    // An explicit defaultValue (e.g. a template chosen on the site) wins over
    // any saved draft; otherwise restore the draft.
    if (hasExplicitInitial) return defaultValue;
    return (autoSaveEnabled ? loadDraft(storageKey) : null) ?? DEFAULT_TEMPLATE;
  });
  const markdown = controlled ? value : internal;

  const [hasEdited, setHasEdited] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(true);
  const editorRef = useRef<CodeEditorHandle>(null);

  // Load shared markdown from the URL fragment once on mount.
  useEffect(() => {
    if (!share || controlled) return;
    let cancelled = false;
    void readShareFromLocation().then((shared) => {
      if (shared !== null && !cancelled) setInternal(shared);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (next: string) => {
      setHasEdited(true);
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );

  const handleReset = useCallback(() => {
    clearDraft(storageKey);
    if (!controlled) setInternal(DEFAULT_TEMPLATE);
    onChange?.(DEFAULT_TEMPLATE);
  }, [controlled, onChange, storageKey]);

  const handleSave = useCallback(() => setLastSaved(Date.now()), []);

  useAutoSave(markdown, {
    // Don't overwrite an existing draft with a template until the user edits it.
    enabled: autoSaveEnabled && (!hasExplicitInitial || hasEdited),
    storageKey,
    onSave: handleSave,
  });

  const pretty = useEmailmd(markdown, { ...renderOptions, debounceMs });
  const minified = useEmailmd(markdown, {
    ...renderOptions,
    minify: true,
    sanitizeStyles: true,
    debounceMs,
  });

  return (
    <div
      className={cx('emd-builder', className)}
      data-color-scheme={colorScheme}
    >
      {/* Mobile backdrop */}
      <div
        className={cx('emd-backdrop', editorOpen && 'emd-backdrop-visible')}
        onClick={() => setEditorOpen(false)}
      />

      {/* Editor panel — slide-over on mobile, static on desktop */}
      <div className={cx('emd-editor-panel', editorOpen && 'emd-editor-panel-open')}>
        <div className="emd-editor-mobile-header">
          <span>Editor</span>
          <Button size="icon-sm" aria-label="Close editor" onClick={() => setEditorOpen(false)}>
            <XIcon />
          </Button>
        </div>
        <div className="emd-editor-toolbar-host">
          <Toolbar
            getView={() => editorRef.current?.view ?? null}
            value={markdown}
            onChange={handleChange}
            onReset={handleReset}
            lastSaved={lastSaved}
          />
        </div>
        <CodeEditor
          ref={editorRef}
          value={markdown}
          onChange={handleChange}
          className="emd-editor"
        />
      </div>

      {/* Output panel — always visible, full-width on mobile */}
      <OutputPane
        markdown={markdown}
        html={pretty.html}
        minifiedHtml={minified.html}
        text={pretty.text}
        warnings={pretty.warnings}
        error={pretty.error}
        share={share}
      />

      {/* Mobile floating edit button */}
      {!editorOpen && (
        <Button
          variant="solid"
          className="emd-fab"
          aria-label="Open editor"
          onClick={() => setEditorOpen(true)}
        >
          <PencilIcon />
        </Button>
      )}
    </div>
  );
}
