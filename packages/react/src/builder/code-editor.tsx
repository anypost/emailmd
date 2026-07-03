'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export interface CodeEditorHandle {
  /** The underlying CodeMirror view, once mounted. */
  view: EditorView | null;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/*
 * Markdown highlighting mapped onto the builder's CSS variables so the
 * editor follows the light/dark scheme without a separate CM theme.
 */
const emdHighlight = HighlightStyle.define([
  { tag: tags.heading, class: 'emd-cm-heading' },
  { tag: tags.strong, class: 'emd-cm-strong' },
  { tag: tags.emphasis, class: 'emd-cm-emphasis' },
  { tag: tags.strikethrough, class: 'emd-cm-strikethrough' },
  { tag: tags.link, class: 'emd-cm-link' },
  { tag: tags.url, class: 'emd-cm-url' },
  { tag: tags.monospace, class: 'emd-cm-code' },
  { tag: tags.quote, class: 'emd-cm-quote' },
  { tag: tags.meta, class: 'emd-cm-meta' },
  { tag: tags.processingInstruction, class: 'emd-cm-marker' },
  { tag: tags.labelName, class: 'emd-cm-marker' },
  { tag: tags.contentSeparator, class: 'emd-cm-marker' },
  { tag: tags.list, class: 'emd-cm-marker' },
  { tag: tags.comment, class: 'emd-cm-meta' },
]);

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': {
    fontFamily: 'var(--emd-mono)',
    lineHeight: '1.65',
    padding: '12px 0',
  },
  '.cm-content': { padding: '0 16px', caretColor: 'var(--emd-fg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-line': { padding: '0' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    background: 'var(--emd-selection) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--emd-fg)' },
  '.cm-placeholder': { color: 'var(--emd-muted-fg)' },
});

/** CodeMirror 6 markdown editor bound to a controlled string value. */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, placeholder, className },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    get view() {
      return viewRef.current;
    },
  }));

  useEffect(() => {
    if (!hostRef.current) return;

    const langCompartment = new Compartment();
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        langCompartment.of(markdown({ base: markdownLanguage })),
        syntaxHighlighting(emdHighlight),
        EditorView.lineWrapping,
        baseTheme,
        ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; value updates flow through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (toolbar inserts route through the view and
  // are already in the doc; this handles resets, theme edits, share loads).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className={className} />;
});
