import { useEffect, useRef } from 'react';
import { saveDraft } from './storage.js';

export function useAutoSave(
  markdown: string,
  {
    enabled = true,
    storageKey,
    onSave,
  }: { enabled?: boolean; storageKey: string; onSave?: () => void }
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!enabled) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (saveDraft(storageKey, markdown)) {
        onSave?.();
      }
    }, 1000);

    return () => clearTimeout(timeoutRef.current);
  }, [markdown, enabled, storageKey, onSave]);
}
