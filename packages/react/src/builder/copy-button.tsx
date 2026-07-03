'use client';

import { useState } from 'react';
import { Button, Tip } from './ui.js';
import { CheckIcon, CopyIcon } from './icons.js';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Tip label={label}>
      <Button size="icon-sm" onClick={handleCopy} aria-label={label}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </Tip>
  );
}
