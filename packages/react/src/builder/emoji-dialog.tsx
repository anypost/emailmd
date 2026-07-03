'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Modal, Tip } from './ui.js';
import { SmileIcon } from './icons.js';
import { EMOJI_DATA } from './emoji-data.js';

export function EmojiDialog({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const entries = useMemo(() => {
    const all = Object.entries(EMOJI_DATA);
    if (!search.trim()) return all;
    const q = search.toLowerCase().trim();
    return all.filter(([name]) => name.includes(q));
  }, [search]);

  function handleSelect(name: string) {
    onInsert(`:${name}:`);
    setOpen(false);
  }

  return (
    <>
      <Tip label="Emoji">
        <Button size="icon-sm" aria-label="Emoji" onClick={() => setOpen(true)}>
          <SmileIcon />
        </Button>
      </Tip>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Emoji"
        description={
          <>
            Search and click to insert the <code>:shortcode:</code> syntax.
          </>
        }
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="emd-emoji">
          <Input
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="emd-emoji-grid">
            {entries.length === 0 ? (
              <p className="emd-emoji-empty">No emoji found for &ldquo;{search}&rdquo;</p>
            ) : (
              entries.map(([name, emoji]) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => handleSelect(name)}
                  className="emd-emoji-cell"
                  title={`:${name}:`}
                >
                  <span className="emd-emoji-glyph">{emoji}</span>
                  <span className="emd-emoji-name">{name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
