'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { EditorView } from '@codemirror/view';
import { Button, Menu, MenuItem, MenuLabel, MenuSeparator, Modal, Tip } from './ui.js';
import {
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  HeadingIcon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  LayoutPanelTopIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  MousePointerClickIcon,
  QuoteIcon,
  RotateCcwIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from './icons.js';
import {
  insertAtCursor,
  insertBlock,
  prefixLines,
  wrapAsLink,
  wrapSelection,
} from './editor-commands.js';
import { CopyButton } from './copy-button.js';
import { EmojiDialog } from './emoji-dialog.js';
import { SnippetsDialog } from './snippets-dialog.js';
import { ThemeDialog } from './theme-dialog.js';

interface ToolbarProps {
  /** Getter for the live CodeMirror view (null before mount). */
  getView: () => EditorView | null;
  value: string;
  onChange: (value: string) => void;
  onReset?: () => void;
  lastSaved?: number | null;
}

function ToolbarButton({
  tooltip,
  icon,
  onClick,
}: {
  tooltip: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tip label={tooltip}>
      <Button size="icon-sm" aria-label={tooltip} onClick={onClick}>
        {icon}
      </Button>
    </Tip>
  );
}

function ToolbarMenu({
  tooltip,
  icon,
  children,
}: {
  tooltip: string;
  icon: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  return (
    <Menu
      trigger={({ toggle }) => (
        <Tip label={tooltip}>
          <Button size="icon-sm" className="emd-btn-menu" aria-label={tooltip} onClick={toggle}>
            {icon}
            <ChevronDownIcon className="emd-menu-caret" />
          </Button>
        </Tip>
      )}
    >
      {children}
    </Menu>
  );
}

export function Toolbar({ getView, value, onChange, onReset, lastSaved }: ToolbarProps) {
  const [showSaved, setShowSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (lastSaved == null) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [lastSaved]);

  const withView = (fn: (view: EditorView) => void) => () => {
    const view = getView();
    if (view) fn(view);
  };

  return (
    <div className="emd-toolbar">
      {/* Row 1: inline formatting + structure */}
      <div className="emd-toolbar-row">
        <ToolbarButton
          tooltip="Bold"
          icon={<BoldIcon />}
          onClick={withView((v) => wrapSelection(v, '**', '**', 'bold text'))}
        />
        <ToolbarButton
          tooltip="Italic"
          icon={<ItalicIcon />}
          onClick={withView((v) => wrapSelection(v, '*', '*', 'italic text'))}
        />
        <ToolbarButton
          tooltip="Underline"
          icon={<UnderlineIcon />}
          onClick={withView((v) => wrapSelection(v, '<u>', '</u>', 'text'))}
        />
        <ToolbarButton
          tooltip="Strikethrough"
          icon={<StrikethroughIcon />}
          onClick={withView((v) => wrapSelection(v, '<s>', '</s>', 'text'))}
        />
        <ToolbarButton
          tooltip="Highlight"
          icon={<HighlighterIcon />}
          onClick={withView((v) => wrapSelection(v, '==', '==', 'highlighted text'))}
        />

        <div className="emd-toolbar-separator" />

        <ToolbarMenu tooltip="Heading" icon={<HeadingIcon />}>
          {(close) => (
            <>
              <MenuItem close={close} onSelect={withView((v) => insertBlock(v, '# Heading', 'Heading'))}>
                <Heading1Icon />
                <span className="emd-menu-h1">Heading 1</span>
              </MenuItem>
              <MenuItem close={close} onSelect={withView((v) => insertBlock(v, '## Heading', 'Heading'))}>
                <Heading2Icon />
                <span className="emd-menu-h2">Heading 2</span>
              </MenuItem>
              <MenuItem close={close} onSelect={withView((v) => insertBlock(v, '### Heading', 'Heading'))}>
                <Heading3Icon />
                <span className="emd-menu-h3">Heading 3</span>
              </MenuItem>
              <MenuItem close={close} onSelect={withView((v) => insertBlock(v, '#### Heading', 'Heading'))}>
                <Heading4Icon />
                <span className="emd-menu-h4">Heading 4</span>
              </MenuItem>
            </>
          )}
        </ToolbarMenu>

        <ToolbarMenu tooltip="List" icon={<ListIcon />}>
          {(close) => (
            <>
              <MenuItem
                close={close}
                onSelect={withView((v) => insertBlock(v, '- Item 1\n- Item 2\n- Item 3', 'Item 1'))}
              >
                <ListIcon />
                Unordered List
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) => insertBlock(v, '1. Item 1\n2. Item 2\n3. Item 3', 'Item 1'))}
              >
                <ListOrderedIcon />
                Ordered List
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '- [ ] Task 1\n- [ ] Task 2\n- [x] Task 3', 'Task 1')
                )}
              >
                <ListChecksIcon />
                Task List
              </MenuItem>
            </>
          )}
        </ToolbarMenu>

        <ToolbarButton
          tooltip="Blockquote"
          icon={<QuoteIcon />}
          onClick={withView((v) => prefixLines(v, '> ', 'blockquote'))}
        />
        <ToolbarButton
          tooltip="Horizontal Rule"
          icon={<MinusIcon />}
          onClick={withView((v) => insertBlock(v, '---'))}
        />
        <ToolbarButton
          tooltip="Code Block"
          icon={<SquareCodeIcon />}
          onClick={withView((v) => wrapSelection(v, '```\n', '\n```', 'code'))}
        />
        <ToolbarMenu tooltip="Table" icon={<TableIcon />}>
          {(close) => (
            <>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    '| Column 1 | Column 2 | Column 3 |\n| :------- | :------: | -------: |\n| Cell     | Cell     | Cell     |',
                    'Column 1'
                  )
                )}
              >
                Table
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    '|          |          |\n| :------- | :------- |\n| Cell     | Cell     |\n| Cell     | Cell     |',
                    'Cell'
                  )
                )}
              >
                Headerless Table
              </MenuItem>
            </>
          )}
        </ToolbarMenu>
      </div>

      {/* Row 2: links, media, directives + utilities */}
      <div className="emd-toolbar-row">
        <ToolbarButton
          tooltip="Link"
          icon={<LinkIcon />}
          onClick={withView((v) => wrapAsLink(v, 'link'))}
        />
        <ToolbarButton
          tooltip="Image"
          icon={<ImageIcon />}
          onClick={withView((v) => wrapAsLink(v, 'image'))}
        />

        <ToolbarMenu tooltip="Button" icon={<MousePointerClickIcon />}>
          {(close) => (
            <>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '[Button Text](https://example.com){button}', 'Button Text')
                )}
              >
                Primary Button
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '[Button Text](https://example.com){button.secondary}', 'Button Text')
                )}
              >
                Secondary Button
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    '[Primary](https://example.com){button} [Secondary](https://example.com){button.secondary}',
                    'Primary'
                  )
                )}
              >
                Side-by-Side Buttons
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '[Button Text](https://example.com){button.success}', 'Button Text')
                )}
              >
                Success Button
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '[Button Text](https://example.com){button.danger}', 'Button Text')
                )}
              >
                Danger Button
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '[Button Text](https://example.com){button.warning}', 'Button Text')
                )}
              >
                Warning Button
              </MenuItem>
            </>
          )}
        </ToolbarMenu>

        <div className="emd-toolbar-separator" />

        <ToolbarMenu tooltip="Sections" icon={<LayoutPanelTopIcon />}>
          {(close) => (
            <>
              <MenuLabel>Sections</MenuLabel>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    `::: header\n![Logo](https://example.com/logo.png){width="150"}\n:::`,
                    'Logo'
                  )
                )}
              >
                Header
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    `::: footer\n**Company** · [Unsubscribe](https://example.com/unsub)\n:::`,
                    'Company'
                  )
                )}
              >
                Footer
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    `::: hero https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200\n# Hero Title\nSubtitle text.\n:::`,
                    'Hero Title'
                  )
                )}
              >
                Hero
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    ':::: columns\n::: column\nLeft column\n:::\n::: column\nRight column\n:::\n::::',
                    'Left column'
                  )
                )}
              >
                Columns
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    '::: social\n- [GitHub](https://github.com/your-org)\n- [X](https://x.com/your-handle)\n- [LinkedIn](https://www.linkedin.com/company/your-company)\n:::',
                    'GitHub'
                  )
                )}
              >
                Social Links
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Content Blocks</MenuLabel>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '::: callout\nYour callout text here.\n:::', 'Your callout text here.')
                )}
              >
                Callout
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(
                    v,
                    '::: highlight center\nYour highlight text here.\n:::',
                    'Your highlight text here.'
                  )
                )}
              >
                Highlight
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) =>
                  insertBlock(v, '::: centered\nCentered text here.\n:::', 'Centered text here.')
                )}
              >
                Centered
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) => insertBlock(v, '::: spacer 24'))}
              >
                Spacer
              </MenuItem>
              <MenuItem
                close={close}
                onSelect={withView((v) => insertBlock(v, '::: divider color=#e2e8f0 width=50%'))}
              >
                Divider
              </MenuItem>
            </>
          )}
        </ToolbarMenu>

        <div className="emd-toolbar-separator" />

        <EmojiDialog onInsert={(text) => withView((v) => insertAtCursor(v, text))()} />
        <SnippetsDialog onInsert={(text) => withView((v) => insertBlock(v, text))()} />
        <ThemeDialog markdown={value} onChange={onChange} />

        <div className="emd-toolbar-end">
          {showSaved && (
            <span className="emd-saved">
              <CheckIcon />
              Saved
            </span>
          )}

          {onReset && (
            <>
              <Tip label="Reset">
                <Button size="icon-sm" aria-label="Reset" onClick={() => setConfirmReset(true)}>
                  <RotateCcwIcon />
                </Button>
              </Tip>
              <Modal
                open={confirmReset}
                onClose={() => setConfirmReset(false)}
                title="Reset to default?"
                description="This will replace the editor contents with the default template and clear your saved draft."
                size="sm"
                footer={
                  <>
                    <Button variant="outline" onClick={() => setConfirmReset(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setConfirmReset(false);
                        onReset();
                      }}
                    >
                      Reset
                    </Button>
                  </>
                }
              />
            </>
          )}

          <CopyButton text={value} label="Copy Markdown" />
        </div>
      </div>
    </div>
  );
}
