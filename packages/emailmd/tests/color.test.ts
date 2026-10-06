import { describe, expect, it } from 'vitest';
import { toHexColor } from '../src/color.js';

/** Channel bytes of a `#rrggbb` color. */
const bytes = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** True when two hex colors differ by at most `tolerance` in every channel. */
function near(actual: string | undefined, expected: string, tolerance = 1): boolean {
  if (!actual?.startsWith('#')) return false;
  return bytes(actual).every((c, i) => Math.abs(c - bytes(expected)[i]) <= tolerance);
}

describe('toHexColor', () => {
  it('converts shadcn neutral oklch values to their hex equivalents', () => {
    expect(toHexColor('oklch(0.145 0 0)')).toBe('#0a0a0a');
    expect(toHexColor('oklch(0.205 0 0)')).toBe('#171717');
    expect(toHexColor('oklch(0.556 0 0)')).toBe('#737373');
    expect(toHexColor('oklch(0.922 0 0)')).toBe('#e5e5e5');
    expect(toHexColor('oklch(0.985 0 0)')).toBe('#fafafa');
    expect(toHexColor('oklch(1 0 0)')).toBe('#ffffff');
  });

  it('converts chromatic oklch, with percentages and angle units', () => {
    // Tailwind v4 blue-500 (just outside sRGB, so gamut-mapped) and green-600
    expect(near(toHexColor('oklch(0.623 0.214 259.815)'), '#2b7fff', 1)).toBe(true);
    expect(toHexColor('oklch(62.3% 0.214 259.815deg)')).toBe(toHexColor('oklch(0.623 0.214 259.815)'));
    expect(near(toHexColor('OKLCH(0.627 0.17 149.214)'), '#16a34a', 2)).toBe(true);
    expect(toHexColor('oklch(0.5 0 none)')).toBe(toHexColor('oklch(0.5 0 0)'));
  });

  it('maps a wide-gamut color into sRGB by lowering chroma, keeping the hue', () => {
    // A P3 red no sRGB color reaches
    const hex = toHexColor('oklch(0.637 0.3 25)')!;
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = bytes(hex);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(90);
    expect(b).toBeLessThan(90);
  });

  it('converts hsl in modern and legacy syntax', () => {
    expect(toHexColor('hsl(0 0% 9%)')).toBe('#171717');
    // shadcn's blue primary
    expect(toHexColor('hsl(221.2 83.2% 53.3%)')).toBe('#2563eb');
    expect(toHexColor('hsl(221.2, 83.2%, 53.3%)')).toBe('#2563eb');
    expect(toHexColor('hsl(0.5turn 100% 50%)')).toBe('#00ffff');
    expect(toHexColor('hsl(120 100 25)')).toBe('#008000');
  });

  it('writes a translucent color as rgba()', () => {
    expect(toHexColor('oklch(1 0 0 / 10%)')).toBe('rgba(255, 255, 255, 0.1)');
    expect(toHexColor('hsla(0, 0%, 0%, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
    expect(toHexColor('hsl(0 0% 0% / 1)')).toBe('#000000');
  });

  it('leaves other values alone', () => {
    for (const value of ['#171717', 'red', 'rgb(1, 2, 3)', 'oklch(0.5 0.1)', 'oklch(a b c)', 'hsl(var(--primary))', '{{ brand }}']) {
      expect(toHexColor(value)).toBeUndefined();
    }
  });
});
