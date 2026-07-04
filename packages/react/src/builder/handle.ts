import type { ReactNode } from 'react';

/**
 * Imperative editor API, exposed both as the `ref` of `<EmailmdBuilder />`
 * and as the argument to custom toolbar `onClick` handlers. All mutations go
 * through CodeMirror transactions, so each call is a single undo step and
 * autosave/onChange fire as if the user had typed.
 */
export interface EmailmdBuilderHandle {
  /** The current markdown document. */
  getMarkdown(): string;
  /** Replace the whole document (one undo step; the user can Cmd+Z it away). */
  setMarkdown(markdown: string): void;
  /** Insert text at the cursor position, leaving any selection's text in place. */
  insertAtCursor(text: string): void;
  /** Replace the current selection (inserts at the cursor when nothing is selected). */
  replaceSelection(text: string): void;
  /** The current selection: its text and character offsets. */
  getSelection(): { text: string; from: number; to: number };
  /** Focus the editor. */
  focus(): void;
}

/** A custom button appended to the builder toolbar. */
export interface EmailmdBuilderToolbarItem {
  /** Stable identity for React keys. */
  id: string;
  /**
   * Button text. Rendered on the button when there is no `icon`; otherwise
   * used as the accessible label.
   */
  label: string;
  /** Optional icon. When set, the button is icon-only with `label` as tooltip. */
  icon?: ReactNode;
  /** Tooltip text. Defaults to `label` for icon buttons. */
  tooltip?: string;
  /** Click handler, called with the live editor API. */
  onClick: (editor: EmailmdBuilderHandle) => void;
}
