# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — Unreleased

### Security
- All user-supplied values interpolated into MJML are now escaped and/or validated:
  - Frontmatter `preheader` is HTML-escaped (a literal apostrophe now renders as `&#39;`).
  - Directive params (`bg`, `color`, `align`, `border-radius`) are validated — colors must be hex/named/`rgb()`/`hsl()`, alignment must be `left`/`center`/`right`, lengths must be CSS length tokens. Invalid values fall back to theme defaults and surface a warning.
  - Hero background URLs with `javascript:`, `data:`, `vbscript:`, or `file:` schemes are dropped with a warning.
  - Frontmatter theme values containing `<`, `>`, or `"` are replaced with the base theme value, with a warning.
  - Font entries with unsafe family names or URLs are dropped, with a warning.
  - Button/image attributes get defense-in-depth attribute escaping.
  - Template tokens (`{{ x }}`, `{% x %}`, `${x}`, `%%x%%`, `[[x]]`) still pass through all of the above untouched.
- New `tests/injection.test.ts` suite covering hostile input across all interpolation sites.

### Added
- `RenderOptions.strings` — override output strings for localization. First entry: `buttonFallback`, the sentence shown under buttons rendered with `fallback`, with `{text}`/`{url}` placeholders.
- `WrapperMeta.frontmatter` — custom wrappers now receive the full frontmatter map, not just the preheader.
- `WrapperMeta.strings` / `WrapperMeta.warnings` — wrappers can forward these to `segmentsToMjml` (the default wrapper does) so content warnings surface in `RenderResult.warnings`.
- `RenderWarning.stage` now covers `'frontmatter' | 'theme' | 'content' | 'mjml'`.
- Sanitize helpers exported: `escapeHtml`, `escapeAttrValue`, `isCssColor`, `isCssLength`, `isSafeUrl`.

### Changed
- MJML compilation errors are surfaced on `RenderResult.warnings` (stage `'mjml'`) instead of being logged to `console.warn`. Validator noise about template tokens in attribute values is filtered out.
- `segmentsToMjml()` accepts an optional third `SegmentContext` argument (`{ strings, warnings }`). Existing two-argument calls behave as before.
- Internal `renderMjml()` now returns `{ html, errors }` instead of a bare string (not part of the public API).

## [0.3.5] — 2026-07-02

### Changed
- Upgraded MJML to ^5.4.0. No output changes; unlocks `mj-section` `gutter` and `mj-social-element` `border` attributes for future use.

### Security
- Updated transitive dependencies to pick up fixes for quadratic-complexity DoS advisories in `js-yaml` (GHSA-h67p-54hq-rp68), `markdown-it` (GHSA-6v5v-wf23-fmfq), and `linkify-it` (GHSA-22p9-wv53-3rq4). The `linkify-it` advisory affected emailmd directly, since rendering runs with `linkify` enabled on untrusted markdown.

## [0.3.4] — 2026-06-09

### Changed
- Project moved to the [Anypost](https://anypost.com/) GitHub org — the repository now lives at [anypost/emailmd](https://github.com/anypost/emailmd). Repository metadata and documentation links updated; no code changes.

## [0.3.3] — 2026-05-29

### Changed
- Upgraded MJML to ^5.3.0.

## [0.3.2] — 2026-05-13

### Changed
- Upgraded MJML to ^5.2.1.

## [0.3.1] — 2026-04-19

### Fixed
- Invalid YAML in a frontmatter block no longer throws from `extractFrontmatter()` / `render()`. The body renders with empty meta, and the parse error is surfaced on the result instead ([#16](https://github.com/anypost/emailmd/issues/16)).

### Added
- `FrontmatterResult.error?: Error` — set when a frontmatter block was detected but could not be parsed as YAML.
- `RenderResult.warnings?: RenderWarning[]` — non-fatal issues (currently just `stage: 'frontmatter'`) surfaced without throwing, so callers can display them alongside a working preview. Room to grow as more stages emit warnings.
- Builder UI now shows an inline red banner when a render warning or error occurs, instead of silently freezing the preview.

## [0.3.0] — 2026-04-16

### Changed
- Upgraded MJML from 4.x to 5.0.1.
- `render()` is now `async` and returns a `Promise<RenderResult>`. Call sites must `await` the result.

### Added
- `RenderOptions.minify` — minify the output HTML (useful for Gmail's 102KB clip limit).
- `RenderOptions.fonts` — register custom web fonts as a map of family name → URL (rendered as `<mj-font>` tags).
- Frontmatter now supports a nested `fonts:` map. Entries merge with `RenderOptions.fonts`; frontmatter wins per-family on conflicts.
- `RenderOptions.validationLevel` — pass through MJML's `'skip' | 'soft' | 'strict'` validation levels.
- `RenderOptions.templateSyntax` — pass through MJML's template delimiter configuration.
- `RenderOptions.sanitizeStyles` — sanitize template variables inside CSS before minification.
- `RenderOptions.beautify` — pretty-print the output HTML (ignored when `minify` is `true`).
- CLI: `-m, --minify` flag.
- CLI: `-b, --beautify` flag.

### Fixed
- CLI now surfaces unhandled rejections from `render()` as a clean `emailmd: <message>` error with exit code 1, rather than an unhandled-rejection stack trace.

## [0.2.1] — 2026-04-06

### Fixed
- Border radius now applies correctly to elements rendered inside directive blocks ([#13](https://github.com/anypost/emailmd/issues/13)).

## [0.2.0] — 2026-04-03

### Added
- Richer `border-radius` support across segments and directive blocks ([#12](https://github.com/anypost/emailmd/issues/12)).

## [0.1.5] — 2026-04-01

### Added
- `emailmd` CLI for rendering markdown from the command line (file input, stdin, `--output`, `--text`, `--help`, `--version`).

## [0.1.4] — 2026-03-27

### Changed
- Updated docs and cleaned up internal constants.

### Added
- Allow fallback-link text to be overridden, to support i18n ([#3](https://github.com/anypost/emailmd/pull/3)).

### Fixed
- Hero text color now respects the theme ([#9](https://github.com/anypost/emailmd/pull/9)).
- Buttons inside segments render correctly ([#8](https://github.com/anypost/emailmd/pull/8)).
- Button-only edge cases in segments.

## [0.1.3] — 2026-03-26

### Added
- Custom theme frontmatter for all button types ([#1](https://github.com/anypost/emailmd/issues/1)).

## [0.1.2] and earlier — 2026-03-20 to 2026-03-24

Initial releases, including Cloudflare Workers support and the core markdown → email-safe HTML pipeline.
