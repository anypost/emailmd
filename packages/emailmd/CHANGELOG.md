# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] — Unreleased

Layout and appearance features ahead of 1.0.

### Added
- **Columns directive** (`:::: columns` / `::: column`): multi-column layouts that stack on mobile. Per-column `width` (bare number = percent), `align`, `valign`, `bg` (card-style cell with padding presets), and `color`; container-level `gap` (default 16px) and `stack=false` (stay side-by-side on mobile via `mj-group`). Text, images, buttons, tables, dividers, and spacers keep their positions inside cells. Columns flatten sequentially in plain text.
- **Spacer directive** (`::: spacer 24`): explicit vertical whitespace. Single-line — no closing fence. Bare numbers are pixels; defaults to 24px.
- **Divider directive** (`::: divider color=#dc2626 thickness=2 width=50%`): styled horizontal rule with `color`, `thickness`, `width`, and alignment keywords. Single-line — no closing fence.
- **Social directive** (`::: social` + a list of links): social icon row. Icons derived from link hostnames (X/Twitter, GitHub, LinkedIn, Instagram, Facebook, YouTube, and more; unknown hosts get a generic web icon). Params: `labels` (show link text), `icon-size`, `icon-base` (self-hosted icon set), alignment. Per-link icon override via `{icon=url}`. Links go to the URL directly (`-noshare`), not share-intent URLs.
- **Automatic dark mode**: `theme: auto` in frontmatter renders light but adapts to the reader's dark mode; a `dark:` map of theme keys tunes the dark variant (and implies `auto` on its own). Apps can enable it globally with the `darkTheme` render option (`true` or a partial theme) — an explicitly pinned `theme: light`/`theme: dark` renders static instead. Emits `color-scheme` meta tags, a `prefers-color-scheme: dark` media query, and `[data-ogsc]`/`[data-ogsb]` selectors for Outlook.com. Apple Mail and Outlook honor the overrides; Gmail applies its own inversion regardless.
- **`dividerColor` theme key** (frontmatter `divider_color`): color of plain `---` rules and the default for the divider directive. Defaults match the previous hardcoded values (light `#f4f4f5`, dark `#27272a`) — no visual change unless set.
- **Accordion directive** (`::: accordion`): collapsible FAQ panels. Each heading inside the block becomes a clickable title, the content below it the panel body; text before the first heading renders as an intro. Interactive in WebKit clients; everywhere else all panels show expanded. `icon-wrapped`/`icon-unwrapped` params for self-hosted expand/collapse icons. Flattens to headings + content in plain text.
- **Image captions**: `![alt](url){caption="..."}` renders a small muted line under the image, following its alignment. In plain text the caption follows the `[Image: alt]` label.
- **`lang` / `dir` frontmatter**: emit language and text-direction attributes on the output `<html>` tag (e.g. `lang: ar`, `dir: rtl`). `dir: rtl` also flips the default text alignment to right (MJML otherwise hardcodes `text-align: left`) along with blockquote bars and list indents; explicit alignment params still win. Invalid values warn and fall back to MJML's defaults (`lang="und" dir="auto"`).
- **Hard line breaks**: `breaks: true` in frontmatter (or the new `breaks` render option; frontmatter wins per document) renders single newlines as `<br>`, the way non-technical writers expect Enter to behave.
- **Headerless tables**: a table whose header row cells are all empty (`| | |`) drops the header row entirely — no bold header or header border in HTML, no separator line in plain text. Column alignment from the delimiter row still applies.
- **Partials** (`::: include <name>`): reusable markdown components supplied via the new `partials` render option (a map of name → markdown string — no filesystem convention, so it works in the browser too). Parameters on the include line (`key="value"`) fill `{{key}}` placeholders inside the partial; tokens for unpassed keys stay untouched for the sending app's template layer. Partials can contain directives, buttons, and other includes (10-level depth cap, cycle detection); frontmatter inside a partial is stripped with a warning; unknown names warn and drop. Include lines inside code fences and indented code stay literal. The expansion pass is exported as `expandPartials` for custom pipelines, and the CLI grows a repeatable `-p, --partials <path>` flag that takes a directory (loads every `.md` file inside; subdirectories become name prefixes: `blocks/legal`) or a single `.md` file (named by basename), later paths winning on name collisions.
- Stable `emd-*` CSS classes on rendered output (`emd-root`, `emd-s`, `emd-bg`, `emd-card`, `emd-hl`, `emd-tbl`) — hooks for the dark-mode overrides and for custom wrapper CSS.
- `WrapperMeta.darkTheme` (resolved dark palette) and an optional third `darkTheme` parameter on `buildHead`, so custom wrappers can participate in dark mode.
- `WrapperMeta.lang` / `WrapperMeta.dir` (validated frontmatter values), so custom wrappers can emit them on their `<mjml>` tag. `buildHead` takes an optional fourth `dir` parameter and `SegmentContext` a `dir` field, so custom wrappers get the same RTL alignment flipping.

## [0.6.0] — 2026-07-02

Final API audit ahead of 1.0.

### Fixed
- `strings.buttonFallback` placeholder substitution is now single-pass: repeated `{text}`/`{url}` placeholders all substitute, and `$` characters in button text or URLs are no longer mangled by replacement-pattern expansion (e.g. `Save $$5` rendered as `Save $5`).

### Added
- `frontmatterToFonts` is now exported alongside `frontmatterToThemeOverrides`, so custom pipelines can extract both.
- An unknown frontmatter `theme:` value (anything other than `light`/`dark`) now surfaces a `theme`-stage warning instead of silently falling back to the default.

### Removed
- The `MjmlCompileError` type export. It was unobtainable through any public API (`renderMjml` is internal) and would otherwise be frozen into the 1.0 contract unused.

## [0.5.0] — 2026-07-02

### Changed
- **Callout and highlight padding presets now apply fully.** The inner text element carried MJML's built-in `10px 25px` padding on top of the card's padding preset, so `compact` was barely tighter than the default and 25px of horizontal inset was constant. The text element is now rendered with zero padding, making the presets the true effective inset: default `20px 24px`, `compact` `12px 16px`, `spacious` `32px 40px`. **Visual change:** existing callouts/highlights render tighter than before (default effective inset was `30px 49px`). This lands before 1.0 so the padding semantics we freeze are the intended ones.

## [0.4.1] — 2026-07-02

### Fixed
- User-authored HTML comments in the reserved `<!--EMAILMD:...-->` namespace are dropped during parsing instead of being mistaken for internal segmentation markers. Escaped mentions inside code spans/fences are unaffected.
- A literal `EMAILMDTPL0ENDTPL` string in the source can no longer be cross-substituted with a real template tag — the internal shielding placeholder now picks a prefix guaranteed not to occur in the input.
- Directives nested inside other directives no longer leak internal markers into the output. The inner directive's content renders inside the outer block (inner styling is not applied — nested directives remain unsupported).

### Added
- `tests/malformed.test.ts` — 26 tests covering degenerate documents (empty/whitespace/frontmatter-only), CRLF and mixed line endings, unclosed/empty/unknown/nested directives, spoofed internal markers and template placeholders, and edge-case buttons/images.

## [0.4.0] — 2026-07-02

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
