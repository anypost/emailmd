export const DEFAULT_DRAFT_KEY = 'emailmd:draft';

export function saveDraft(key: string, markdown: string): boolean {
  try {
    localStorage.setItem(key, markdown);
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
