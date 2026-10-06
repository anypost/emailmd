#!/usr/bin/env node
/**
 * Build the default `::: social` icons served from
 * https://www.emailmd.dev/icons/social/<network>.png.
 *
 * Each icon is the network's mark in white on a transparent 96×96 square,
 * filling the middle two-thirds the way MJML's own icons do; mj-social paints
 * the brand color behind it. Marks come from Simple Icons (CC0). LinkedIn
 * left Simple Icons at LinkedIn's request in v13, so its mark comes from the
 * last release that had it. The generic `web` globe is drawn here.
 *
 * Needs `npm` and `rsvg-convert` (librsvg) on the PATH. Run from anywhere:
 *
 *   node apps/web/scripts/social-icons.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 96;
/** The 24-unit marks sit in a 36-unit box: two-thirds of the square. */
const VIEWBOX = '-6 -6 36 36';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public/icons/social');

/**
 * Network name (as emailmd's social directive names them) → Simple Icons slug
 * and release. `outline` strokes the mark in black, for a network whose brand
 * color is too light to show a white mark (Snapchat's yellow).
 */
const NETWORKS = {
  facebook: { slug: 'facebook', version: '16' },
  x: { slug: 'x', version: '16' },
  instagram: { slug: 'instagram', version: '16' },
  linkedin: { slug: 'linkedin', version: '12' },
  github: { slug: 'github', version: '16' },
  youtube: { slug: 'youtube', version: '16' },
  pinterest: { slug: 'pinterest', version: '16' },
  medium: { slug: 'medium', version: '16' },
  vimeo: { slug: 'vimeo', version: '16' },
  dribbble: { slug: 'dribbble', version: '16' },
  soundcloud: { slug: 'soundcloud', version: '16' },
  tumblr: { slug: 'tumblr', version: '16' },
  snapchat: { slug: 'snapchat', version: '16', outline: true },
  xing: { slug: 'xing', version: '16' },
};

const GLOBE =
  '<g fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/>' +
  '<ellipse cx="12" cy="12" rx="4.5" ry="10"/><path d="M2 12h20"/></g>';

const work = mkdtempSync(join(tmpdir(), 'emailmd-social-'));
const packages = {};

/** Unpack a Simple Icons release once, returning its icons directory. */
function iconsDir(version) {
  if (packages[version]) return packages[version];
  const dest = join(work, `v${version}`);
  mkdirSync(dest);
  execFileSync('npm', ['pack', `simple-icons@${version}`, '--silent', '--pack-destination', dest]);
  const tarball = readdirSync(dest).find((f) => f.endsWith('.tgz'));
  execFileSync('tar', ['xzf', join(dest, tarball), '-C', dest]);
  return (packages[version] = join(dest, 'package/icons'));
}

function render(name, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${VIEWBOX}">${body}</svg>`;
  const svgPath = join(work, `${name}.svg`);
  writeFileSync(svgPath, svg);
  execFileSync('rsvg-convert', ['-w', String(SIZE), '-h', String(SIZE), svgPath, '-o', join(OUT, `${name}.png`)]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, { slug, version, outline }] of Object.entries(NETWORKS)) {
  const source = readFileSync(join(iconsDir(version), `${slug}.svg`), 'utf8');
  const d = /<path d="([^"]+)"/.exec(source)?.[1];
  if (!d) throw new Error(`No path in simple-icons@${version} ${slug}.svg`);
  const stroke = outline ? ' stroke="#000" stroke-width="2" stroke-linejoin="round" paint-order="stroke"' : '';
  render(name, `<path fill="#fff"${stroke} d="${d}"/>`);
}
render('web', GLOBE);

console.log(`Wrote ${Object.keys(NETWORKS).length + 1} icons to ${OUT}`);
