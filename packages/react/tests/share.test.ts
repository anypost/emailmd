import { describe, it, expect } from 'vitest';
import { decodeShare, encodeShare } from '../src/builder/share.js';

describe('share encoding', () => {
  it('round-trips markdown, including unicode', async () => {
    const md = '# Hello 🌍\n\n::: callout\nÜmläuts & 中文\n:::\n';
    const encoded = await encodeShare(md);
    expect(encoded).toMatch(/^[01]\.[A-Za-z0-9_-]+$/);
    expect(await decodeShare(encoded)).toBe(md);
  });

  it('round-trips the uncompressed fallback format', async () => {
    const md = '# Plain fallback';
    const bytes = new TextEncoder().encode(md);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const encoded = `0.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    expect(await decodeShare(encoded)).toBe(md);
  });

  it('returns null for malformed input', async () => {
    expect(await decodeShare('garbage')).toBeNull();
    expect(await decodeShare('9.AAAA')).toBeNull();
    expect(await decodeShare('1.!!!not-base64!!!')).toBeNull();
  });
});
