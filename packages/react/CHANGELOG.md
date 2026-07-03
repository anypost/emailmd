# Changelog

All notable changes to `@emailmd/react` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — Unreleased

### Added
- `<EmailPreview emulateColorScheme="light" | "dark" />` — pins the preview to one of the email's color-scheme variants by rewriting its `prefers-color-scheme: dark` rules (`dark` → always apply, `light` → never apply). An iframe otherwise follows the viewer's OS, which would make a toggle a no-op on a dark-mode machine. Exposed in the builder as a single sun/moon toggle next to the device switch — the icon shows the current mode, and it's enabled when the document opts into dark mode.
- `hasDarkModeStyles(html)` export — detects whether a rendered email contains dark-mode styles.
- Toolbar support for the emailmd 0.7.0 directives: Columns and Social Links in the Sections menu; Spacer, Divider, and Accordion (FAQ) in Content Blocks.
- The Table toolbar button is now a menu with Table and Headerless Table snippets.
- Divider color field in the visual theme editor (`divider_color`).
- `useEmailmd` `lint` option — runs emailmd's `lint()` alongside each render and returns the findings as `lintFindings` on the hook result.
- `<EmailmdBuilder lint />` — surfaces lint findings live in the warnings banner (labeled `Lint`/`Lint suggestion`, with source lines), merged with render warnings.

### Fixed
- The default template said "Email.md" in body text, which linkify auto-linked to `http://email.md` (`.md` is a real TLD) in the rendered output. It now says "emailmd". Found by the new linter.

### Changed
- The `emailmd` peer dependency is now `>=0.7.0` (the new toolbar insertions rely on the columns/spacer/divider/social directives, and the `lint` option on `lint()`).
- The warnings banner counts all findings, so its plural summary now reads "N warnings" instead of "N render warnings".

## [0.1.0] — 2026-07-03

Initial release ([#17](https://github.com/anypost/emailmd/issues/17)).

### Added
- `useEmailmd(markdown, options)` — debounced, race-safe, SSR-safe live rendering hook returning `{ html, text, meta, warnings, error, isRendering }`. Options extend emailmd's `RenderOptions` with `debounceMs`.
- `<EmailPreview />` — sandboxed iframe preview with `device="desktop" | "mobile" | <px>` switching.
- `<EmailmdBuilder />` — the full emailmd.dev builder as a drop-in component: CodeMirror 6 markdown editor with syntax highlighting, formatting toolbar, visual theme editor, emoji and snippet pickers, live preview, HTML source (pretty/minified with Gmail-clip byte meter), plain-text view, expandable render-warnings panel, localStorage autosave, download-as-HTML, and opt-in `#md=` share links (deflate-compressed, fragment-only). Styling ships in `@emailmd/react/styles.css` — plain scoped CSS themeable via `--emd-*` custom properties, with `colorScheme="light" | "dark"`. React is the only UI dependency; emailmd.dev's builder runs on this component.
- `DEFAULT_TEMPLATE` — the starter document used by the builder.
