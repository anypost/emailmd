'use client';

import { useState } from 'react';
import { Button, Modal, Tip, cx } from './ui.js';
import { CheckIcon, CodeIcon, CopyIcon } from './icons.js';

const SNIPPETS: { label: string; description: string; content: string }[] = [
  {
    label: 'Callout',
    description: 'Highlighted box — supports center, compact, spacious, color=, bg=',
    content: `::: callout center
**ABC-123**
Your confirmation code.
:::`,
  },
  {
    label: 'Highlight',
    description: 'Branded banner — supports center, compact, spacious, color=, bg=',
    content: `::: highlight center
**50% OFF** — This weekend only!
:::`,
  },
  {
    label: 'Hero',
    description: 'Full-width background image with overlay text',
    content: `::: hero https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200
# Welcome aboard
Get started with your new account today.
:::`,
  },
  {
    label: 'Header',
    description: 'Top section for logo or brand image',
    content: `::: header
![Logo](https://example.com/logo.png){width="150"}
:::`,
  },
  {
    label: 'Footer',
    description: 'Bottom section for links and legal text',
    content: `::: footer
**Acme Corp** · [Unsubscribe](https://example.com/unsub) · [Preferences](https://example.com/prefs)
:::`,
  },
  {
    label: 'Centered',
    description: 'Center-aligned text block',
    content: `::: centered
Thanks for reading.
— The Acme Team
:::`,
  },
  {
    label: 'Button',
    description: 'Primary call-to-action button',
    content: `[Get Started](https://example.com){button}`,
  },
  {
    label: 'Secondary Button',
    description: 'Outlined secondary button',
    content: `[Learn More](https://example.com){button.secondary}`,
  },
  {
    label: 'Side-by-Side Buttons',
    description: 'Two buttons in a row',
    content: `[Get Started](https://example.com){button} [Learn More](https://example.com){button.secondary}`,
  },
  {
    label: 'Success Button',
    description: 'Green button for confirmations',
    content: `[Confirm](https://example.com){button.success}`,
  },
  {
    label: 'Danger Button',
    description: 'Red button for destructive actions',
    content: `[Delete](https://example.com){button.danger}`,
  },
  {
    label: 'Button with Fallback',
    description: 'Button with fallback URL for accessibility',
    content: `[Reset Password](https://example.com/reset){button fallback}`,
  },
  {
    label: 'Image',
    description: 'Responsive image with optional width',
    content: `![Banner](https://example.com/image.jpg){width="400"}`,
  },
  {
    label: 'Task List',
    description: 'Checklist with checkboxes',
    content: `- [x] Design mockups
- [x] Write API endpoints
- [ ] Deploy to production`,
  },
  {
    label: 'Table',
    description: 'Data table with column alignment',
    content: `| Plan    | Price  | Features     |
| :------ | :----: | -----------: |
| Free    | $0/mo  | 5 projects   |
| Pro     | $20/mo | Unlimited    |`,
  },
];

export function SnippetsDialog({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);

  function handleInsert() {
    onInsert(SNIPPETS[selected].content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <Tip label="Snippets">
        <Button size="icon-sm" aria-label="Snippets" onClick={() => setOpen(true)}>
          <CodeIcon />
        </Button>
      </Tip>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Snippets"
        description="Click a snippet to preview, then insert into your email."
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="emd-snippets">
          <div className="emd-snippets-list">
            {SNIPPETS.map((snippet, i) => (
              <button
                type="button"
                key={snippet.label}
                onClick={() => {
                  setSelected(i);
                  setCopied(false);
                }}
                className={cx('emd-snippets-item', selected === i && 'emd-snippets-item-active')}
              >
                {snippet.label}
              </button>
            ))}
          </div>
          <div className="emd-snippets-detail">
            <p className="emd-snippets-description">{SNIPPETS[selected].description}</p>
            <div className="emd-snippets-preview">
              <pre>{SNIPPETS[selected].content}</pre>
              <Button
                size="icon-sm"
                className="emd-snippets-insert"
                aria-label="Insert snippet"
                onClick={handleInsert}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
