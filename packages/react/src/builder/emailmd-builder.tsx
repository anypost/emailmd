'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
import type { EmailmdBuilderHandle, EmailmdBuilderToolbarItem } from './handle.js';

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
  /**
   * Run emailmd's `lint()` on every render and surface the findings in the
   * warnings banner. Default: `false`.
   */
  lint?: boolean;
  /** Debounce between typing and re-render, in ms. Default: `150`. */
  debounceMs?: number;
  /**
   * Custom buttons appended to the toolbar. Each `onClick` receives the
   * imperative editor API (the same object exposed via `ref`).
   */
  toolbarItems?: EmailmdBuilderToolbarItem[];
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
export const EmailmdBuilder = forwardRef<EmailmdBuilderHandle, EmailmdBuilderProps>(function EmailmdBuilder(
  {
    defaultValue,
    value,
    onChange,
    autoSave = true,
    share = false,
    colorScheme = 'light',
    renderOptions,
    lint = false,
    debounceMs,
    toolbarItems,
    className,
  },
  ref
) {
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

  // Imperative editor API. Mutations dispatch CodeMirror transactions, so the
  // existing update listener routes them through handleChange (state, autosave,
  // onChange) and each call lands as one undo step. Refs keep the object
  // identity stable across renders.
  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;
  const handleChangeRef = useRef(handleChange);
  handleChangeRef.current = handleChange;

  const editor = useMemo<EmailmdBuilderHandle>(() => {
    const getView = () => editorRef.current?.view ?? null;
    return {
      getMarkdown: () => markdownRef.current,
      setMarkdown: (next) => {
        const view = getView();
        if (view) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: next },
            selection: { anchor: next.length },
          });
        } else {
          handleChangeRef.current(next);
        }
      },
      insertAtCursor: (text) => {
        const view = getView();
        if (!view) return;
        const { head } = view.state.selection.main;
        view.dispatch({
          changes: { from: head, to: head, insert: text },
          selection: { anchor: head + text.length },
        });
        view.focus();
      },
      replaceSelection: (text) => {
        const view = getView();
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      getSelection: () => {
        const view = getView();
        if (!view) return { text: '', from: 0, to: 0 };
        const { from, to } = view.state.selection.main;
        return { text: view.state.sliceDoc(from, to), from, to };
      },
      focus: () => getView()?.focus(),
    };
  }, []);

  useImperativeHandle(ref, () => editor, [editor]);

  useAutoSave(markdown, {
    // Don't overwrite an existing draft with a template until the user edits it.
    enabled: autoSaveEnabled && (!hasExplicitInitial || hasEdited),
    storageKey,
    onSave: handleSave,
  });

  const pretty = useEmailmd(markdown, { ...renderOptions, debounceMs, lint });
  const minified = useEmailmd(markdown, {
    ...renderOptions,
    minify: true,
    sanitizeStyles: true,
    debounceMs,
  });

  // Lint findings share the render-warnings banner, labeled by severity.
  const bannerWarnings = [
    ...pretty.warnings,
    ...pretty.lintFindings.map((f) => ({
      stage: f.severity === 'warning' ? 'lint' : 'lint suggestion',
      message: f.line !== undefined ? `Line ${f.line}: ${f.message}` : f.message,
    })),
  ];

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
            items={toolbarItems}
            editor={editor}
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
        warnings={bannerWarnings}
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
});
