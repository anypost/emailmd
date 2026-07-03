import { describe, it, expect, afterEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  insertAtCursor,
  insertBlock,
  prefixLines,
  wrapAsLink,
  wrapSelection,
} from '../src/builder/editor-commands.js';

let views: EditorView[] = [];

function makeView(doc: string, anchor: number, head = anchor): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor, head),
    }),
    parent: document.body,
  });
  views.push(view);
  return view;
}

afterEach(() => {
  for (const view of views) view.destroy();
  views = [];
});

const docOf = (view: EditorView) => view.state.doc.toString();
const selOf = (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  return view.state.sliceDoc(from, to);
};

describe('editor commands', () => {
  it('wrapSelection wraps selected text and keeps it selected', () => {
    const view = makeView('make this bold now', 5, 9);
    wrapSelection(view, '**', '**', 'bold text');
    expect(docOf(view)).toBe('make **this** bold now');
    expect(selOf(view)).toBe('this');
  });

  it('wrapSelection inserts and selects the placeholder when empty', () => {
    const view = makeView('', 0);
    wrapSelection(view, '**', '**', 'bold text');
    expect(docOf(view)).toBe('**bold text**');
    expect(selOf(view)).toBe('bold text');
  });

  it('insertBlock adds blank-line separation and selects the target text', () => {
    const view = makeView('above', 5);
    insertBlock(view, '# Heading', 'Heading');
    expect(docOf(view)).toBe('above\n\n# Heading');
    expect(selOf(view)).toBe('Heading');
  });

  it('insertBlock separates from following content too', () => {
    const view = makeView('above\nbelow', 5);
    insertBlock(view, '---');
    expect(docOf(view)).toBe('above\n\n---\n\nbelow');
  });

  it('prefixLines prefixes every selected line', () => {
    const view = makeView('one\ntwo', 0, 7);
    prefixLines(view, '> ', 'blockquote');
    expect(docOf(view)).toBe('> one\n> two');
  });

  it('insertAtCursor inserts inline without separation', () => {
    const view = makeView('Hello world', 5);
    insertAtCursor(view, ' :tada:');
    expect(docOf(view)).toBe('Hello :tada: world');
    expect(view.state.selection.main.head).toBe(12);
  });

  it('wrapAsLink uses the selection as label and selects the url slot', () => {
    const view = makeView('Visit our docs', 10, 14);
    wrapAsLink(view, 'link');
    expect(docOf(view)).toBe('Visit our [docs](url)');
    expect(selOf(view)).toBe('url');
  });

  it('wrapAsLink for images prefixes a bang and selects a placeholder photo URL', () => {
    const view = makeView('logo', 0, 4);
    wrapAsLink(view, 'image');
    expect(docOf(view)).toMatch(/^!\[logo\]\(https:\/\/picsum\.photos\/seed\/\w+\/600\/400\)$/);
    expect(selOf(view)).toMatch(/^https:\/\/picsum\.photos\/seed\/\w+\/600\/400$/);
  });

  it('wrapAsLink for images without a selection inserts a working image and selects the alt text', () => {
    const view = makeView('', 0);
    wrapAsLink(view, 'image');
    expect(docOf(view)).toMatch(/^!\[alt text\]\(https:\/\/picsum\.photos\/seed\/\w+\/600\/400\)$/);
    expect(selOf(view)).toBe('alt text');
  });
});
