import type { EditorView } from '@codemirror/view';

/**
 * Wrap the current selection with prefix/suffix. If nothing is selected,
 * inserts prefix + placeholder + suffix and selects the placeholder.
 */
export function wrapSelection(
  view: EditorView,
  prefix: string,
  suffix: string,
  placeholder: string
): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const inner = selected || placeholder;
  view.dispatch({
    changes: { from, to, insert: prefix + inner + suffix },
    selection: { anchor: from + prefix.length, head: from + prefix.length + inner.length },
  });
  view.focus();
}

/**
 * Insert a block of text at the cursor, ensuring blank-line separation from
 * surrounding content. Optionally select a substring within the inserted text.
 */
export function insertBlock(view: EditorView, block: string, selectText?: string): void {
  const { from, to } = view.state.selection.main;
  const before = view.state.sliceDoc(0, from);
  const after = view.state.sliceDoc(to);

  let prefix = '';
  if (before.length > 0 && !before.endsWith('\n\n')) {
    prefix = before.endsWith('\n') ? '\n' : '\n\n';
  }
  let suffix = '';
  if (after.length > 0 && !after.startsWith('\n\n')) {
    suffix = after.startsWith('\n') ? '\n' : '\n\n';
  }

  const insertion = prefix + block + suffix;
  let selection: { anchor: number; head?: number };
  if (selectText) {
    const selectStart = from + prefix.length + block.indexOf(selectText);
    selection = { anchor: selectStart, head: selectStart + selectText.length };
  } else {
    selection = { anchor: from + insertion.length };
  }

  view.dispatch({ changes: { from, to, insert: insertion }, selection });
  view.focus();
}

/**
 * Prefix selected lines with a string (e.g. "> " for blockquote).
 * If nothing is selected, inserts prefix + placeholder and selects it.
 */
export function prefixLines(view: EditorView, prefix: string, placeholder: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const prefixed = selected
      .split('\n')
      .map((line) => prefix + line)
      .join('\n');
    view.dispatch({
      changes: { from, to, insert: prefixed },
      selection: { anchor: from, head: from + prefixed.length },
    });
  } else {
    const text = prefix + placeholder;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + prefix.length, head: from + text.length },
    });
  }
  view.focus();
}

/** Insert text at the cursor without block separation (e.g. emoji shortcodes). */
export function insertAtCursor(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}

/**
 * Turn the selection into a link/image: selected text becomes the label and
 * the url placeholder is selected for typing over. With no selection, inserts
 * the full template with the label placeholder selected.
 */
export function wrapAsLink(view: EditorView, kind: 'link' | 'image'): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const bang = kind === 'image' ? '!' : '';

  if (selected) {
    const replacement = `${bang}[${selected}](url)`;
    const urlStart = from + bang.length + 1 + selected.length + 2;
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: urlStart, head: urlStart + 3 },
    });
    view.focus();
  } else {
    wrapSelection(view, `${bang}[`, '](url)', kind === 'image' ? 'alt text' : 'link text');
  }
}
