# Changelog

All notable changes to `@emailmd/react` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

Initial release ([#17](https://github.com/anypost/emailmd/issues/17)).

### Added
- `useEmailmd(markdown, options)` — debounced, race-safe, SSR-safe live rendering hook returning `{ html, text, meta, warnings, error, isRendering }`. Options extend emailmd's `RenderOptions` with `debounceMs`.
- `<EmailPreview />` — sandboxed iframe preview with `device="desktop" | "mobile" | <px>` switching.
- `<EmailmdBuilder />` — the full emailmd.dev builder as a drop-in component: CodeMirror 6 markdown editor with syntax highlighting, formatting toolbar, visual theme editor, emoji and snippet pickers, live preview, HTML source (pretty/minified with Gmail-clip byte meter), plain-text view, expandable render-warnings panel, localStorage autosave, download-as-HTML, and opt-in `#md=` share links (deflate-compressed, fragment-only). Styling ships in `@emailmd/react/styles.css` — plain scoped CSS themeable via `--emd-*` custom properties, with `colorScheme="light" | "dark"`. React is the only UI dependency; emailmd.dev's builder runs on this component.
- `DEFAULT_TEMPLATE` — the starter document used by the builder.
