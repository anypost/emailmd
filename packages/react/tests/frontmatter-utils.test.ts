import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  parseFontsMap,
  setFrontmatterKey,
  setFontsMap,
  removeFrontmatterKey,
  removeAllThemeKeys,
  parseChartColors,
  setChartColors,
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

  it('removeAllThemeKeys strips divider_color and the data color roles', () => {
    let doc = setChartColors(DOC, ['#e76e50', '#2a9d90']);
    for (const key of ['divider_color', 'muted_color', 'positive_color', 'negative_color']) {
      doc = setFrontmatterKey(doc, key, '#123456');
    }
    const cleaned = removeAllThemeKeys(doc);
    expect(parseFrontmatter(cleaned)).toEqual({ preheader: 'Hello there' });
    expect(parseChartColors(cleaned)).toEqual([]);
  });

  describe('chart_colors', () => {
    it('reads a flow list, a block list, and a comma-separated string', () => {
      expect(parseChartColors('---\nchart_colors: ["#e76e50", \'#2a9d90\']\n---\n')).toEqual(['#e76e50', '#2a9d90']);
      expect(parseChartColors('---\nchart_colors:\n  - "#e76e50"\n  - "#2a9d90"\ntheme: auto\n---\n')).toEqual(['#e76e50', '#2a9d90']);
      expect(parseChartColors('---\nchart_colors: "#e76e50, rgb(1, 2, 3)"\n---\n')).toEqual(['#e76e50', 'rgb(1, 2, 3)']);
      expect(parseChartColors(DOC)).toEqual([]);
      expect(parseChartColors('# No frontmatter')).toEqual([]);
    });

    it('writes a flow list in place, replacing a block list and its items', () => {
      const block = '---\npreheader: Hi\nchart_colors:\n  - "#e76e50"\n  - "#2a9d90"\ntheme: auto\n---\n# Body\n';
      const next = setChartColors(block, ['#111111', '#222222', '#333333']);
      expect(next).toBe('---\npreheader: Hi\nchart_colors: ["#111111", "#222222", "#333333"]\ntheme: auto\n---\n# Body\n');
      expect(parseChartColors(next)).toEqual(['#111111', '#222222', '#333333']);
    });

    it('adds the key, creating the block when there is none, and removes it when emptied', () => {
      expect(setChartColors(DOC, ['#111111'])).toContain('brand_color: "#ff0000"\nchart_colors: ["#111111"]\n---');
      expect(setChartColors('# Body', ['#111111'])).toBe('---\nchart_colors: ["#111111"]\n---\n# Body');

      const cleared = setChartColors(setChartColors(DOC, ['#111111']), []);
      expect(cleared).toBe(DOC);
    });
  });
});
