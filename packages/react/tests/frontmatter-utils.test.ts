import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  parseFontsMap,
  setFrontmatterKey,
  setFontsMap,
  removeFrontmatterKey,
  removeAllThemeKeys,
} from '../src/builder/frontmatter-utils.js';

const DOC = `---
preheader: "Hello there"
brand_color: "#ff0000"
---

# Body
`;

describe('frontmatter-utils', () => {
  it('parses flat frontmatter with quote stripping', () => {
    const fm = parseFrontmatter(DOC);
    expect(fm.preheader).toBe('Hello there');
    expect(fm.brand_color).toBe('#ff0000');
  });

  it('sets a new key and updates an existing one', () => {
    let next = setFrontmatterKey(DOC, 'button_color', '#00ff00');
    expect(parseFrontmatter(next).button_color).toBe('#00ff00');

    next = setFrontmatterKey(next, 'brand_color', '#0000ff');
    const fm = parseFrontmatter(next);
    expect(fm.brand_color).toBe('#0000ff');
    expect(fm.preheader).toBe('Hello there');
  });

  it('creates a frontmatter block when none exists', () => {
    const next = setFrontmatterKey('# Just body', 'theme', 'dark');
    expect(next.startsWith('---\ntheme: dark\n---\n')).toBe(true);
  });

  it('removes a key, and removes the whole block when empty', () => {
    const one = removeFrontmatterKey(DOC, 'brand_color');
    expect(parseFrontmatter(one).brand_color).toBeUndefined();
    expect(parseFrontmatter(one).preheader).toBe('Hello there');

    const none = removeFrontmatterKey(one, 'preheader');
    expect(none.startsWith('---')).toBe(false);
    expect(none).toContain('# Body');
  });

  it('round-trips the fonts map including block removal', () => {
    const withFonts = setFontsMap(DOC, {
      Inter: 'https://fonts.googleapis.com/css2?family=Inter',
    });
    expect(parseFontsMap(withFonts)).toEqual({
      Inter: 'https://fonts.googleapis.com/css2?family=Inter',
    });

    const cleared = setFontsMap(withFonts, {});
    expect(parseFontsMap(cleared)).toEqual({});
    expect(parseFrontmatter(cleared).preheader).toBe('Hello there');
  });

  it('removeAllThemeKeys preserves non-theme keys and strips fonts children', () => {
    const doc = setFontsMap(setFrontmatterKey(DOC, 'custom_key', 'keepme'), {
      Inter: 'https://example.com/inter.css',
    });
    const cleaned = removeAllThemeKeys(doc);
    const fm = parseFrontmatter(cleaned);
    expect(fm.custom_key).toBe('keepme');
    expect(fm.preheader).toBe('Hello there');
    expect(fm.brand_color).toBeUndefined();
    expect(parseFontsMap(cleaned)).toEqual({});
  });
});
