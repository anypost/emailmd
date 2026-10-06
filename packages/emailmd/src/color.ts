/**
 * Convert the color functions design tools export, `oklch()` and `hsl()`,
 * to the hex email clients understand. shadcn and Tailwind themes are written
 * in oklch, which no email client supports.
 */

type Rgb = [r: number, g: number, b: number];

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`;
/** A number with an optional `%` (or `none`, read as 0), captured whole. */
const COMPONENT = String.raw`(${NUMBER}%?|none)`;
/** A hue: a number with an optional angle unit. */
const HUE = String.raw`(${NUMBER}(?:deg|grad|rad|turn)?|none)`;
/** The alpha after `/` (or a comma, in legacy hsla()). */
const ALPHA = String.raw`(?:\s*[/,]\s*${COMPONENT})?`;

const OKLCH_RE = new RegExp(String.raw`^oklch\(\s*${COMPONENT}\s+${COMPONENT}\s+${HUE}${ALPHA}\s*\)$`, 'i');
const HSL_RE = new RegExp(String.raw`^hsla?\(\s*${HUE}\s*[\s,]\s*${COMPONENT}\s*[\s,]\s*${COMPONENT}${ALPHA}\s*\)$`, 'i');

/** A component as a number, where `100%` maps to `percentScale`. */
function component(raw: string, percentScale: number): number {
  if (raw.toLowerCase() === 'none') return 0;
  return raw.endsWith('%') ? (parseFloat(raw) / 100) * percentScale : parseFloat(raw);
}

/** A hue in degrees. */
function hue(raw: string): number {
  const value = raw.toLowerCase();
  if (value === 'none') return 0;
  const n = parseFloat(value);
  if (value.endsWith('grad')) return n * 0.9;
  if (value.endsWith('rad')) return (n * 180) / Math.PI;
  if (value.endsWith('turn')) return n * 360;
  return n;
}

/** Alpha in 0–1, 1 when absent. */
function alpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return Math.min(1, Math.max(0, component(raw, 1)));
}

/** Linear-light sRGB from OKLab (Björn Ottosson's matrices, as CSS Color 4 uses). */
function oklabToLinearSrgb(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLab from linear-light sRGB, for measuring how far a clipped color moved. */
function linearSrgbToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
const clip = (rgb: Rgb): Rgb => rgb.map((c) => Math.min(1, Math.max(0, c))) as Rgb;

/** OKLCH to linear sRGB. */
function oklchToLinear(L: number, C: number, H: number): Rgb {
  const rad = (H * Math.PI) / 180;
  return oklabToLinearSrgb(L, C * Math.cos(rad), C * Math.sin(rad));
}

/**
 * Map an OKLCH color into sRGB the way CSS Color 4 does: keep lightness and
 * hue, and lower chroma until clipping the rest moves the color by less than
 * a just-noticeable difference, so a wide-gamut color lands on the nearest
 * sRGB color a reader would see rather than a channel-clipped shift in hue.
 */
function gamutMapOklch(L: number, C: number, H: number): Rgb {
  if (L >= 1) return [1, 1, 1];
  if (L <= 0) return [0, 0, 0];
  const exact = oklchToLinear(L, C, H);
  if (inGamut(exact)) return exact;

  const JND = 0.02;
  const deltaE = (rgb: Rgb) => {
    const [l1, a1, b1] = linearSrgbToOklab(rgb);
    const [l2, a2, b2] = linearSrgbToOklab(clip(rgb));
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
  };
  let lo = 0;
  let hi = C;
  let best = clip(oklchToLinear(L, 0, H));
  while (hi - lo > 1e-4) {
    const mid = (lo + hi) / 2;
    const candidate = oklchToLinear(L, mid, H);
    if (inGamut(candidate)) {
      lo = mid;
      best = candidate;
    } else if (deltaE(candidate) < JND) {
      lo = mid;
      best = clip(candidate);
    } else {
      hi = mid;
    }
  }
  return best;
}

/** Gamma-encode a linear-light sRGB channel. */
function encode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** sRGB (0–1, gamma-encoded) with alpha as `#rrggbb`, or `rgba()` when translucent. */
function format(rgb: Rgb, a: number): string {
  const bytes = rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
  if (a < 1) return `rgba(${bytes.join(', ')}, ${Math.round(a * 1000) / 1000})`;
  return `#${bytes.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** HSL (degrees, 0–1, 0–1) to gamma-encoded sRGB. */
function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/**
 * The hex for an `oklch()` or `hsl()`/`hsla()` color, or `undefined` for any
 * other value. A translucent color becomes `rgba()`, since hex with alpha has
 * less email client support.
 */
export function toHexColor(value: string): string | undefined {
  const v = value.trim();
  const oklch = OKLCH_RE.exec(v);
  if (oklch) {
    const L = component(oklch[1], 1);
    const C = Math.max(0, component(oklch[2], 0.4));
    const H = ((hue(oklch[3]) % 360) + 360) % 360;
    const rgb = gamutMapOklch(L, C, H).map(encode) as Rgb;
    return format(rgb, alpha(oklch[4]));
  }
  const hsl = HSL_RE.exec(v);
  if (hsl) {
    const H = ((hue(hsl[1]) % 360) + 360) % 360;
    const S = Math.min(1, Math.max(0, component(hsl[2], 1) / (hsl[2].endsWith('%') ? 1 : 100)));
    const L = Math.min(1, Math.max(0, component(hsl[3], 1) / (hsl[3].endsWith('%') ? 1 : 100)));
    return format(hslToRgb(H, S, L), alpha(hsl[4]));
  }
  return undefined;
}
