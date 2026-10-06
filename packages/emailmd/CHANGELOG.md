# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.13.2] — 2026-10-06

### Added
- **Charts, progress bars and breakdowns inside columns.** A `::: column` now draws a nested `::: chart`, `::: progress` or `::: breakdown` as itself, so a chart image can sit beside the rows that explain it. Each is one table sized to its column, and stacks with it on a phone.

### Fixed
- **Chart, progress and sparkline labels no longer break inside a word that fits.** The bar row under a label spans both caption columns, and the table shared its width out in proportion to their content, giving most of it to the value. The label was left narrower than its own text, so a 375px phone split "Calls" into "Call" and "s" beside "1,106,826 / 2,000,000". A label now takes all the width the value leaves, as a breakdown's does, and wraps between words only when the two don't fit side by side.
- **A directive dropped inside a column now warns.** Any directive other than the three above still renders inside a column as its plain content, but now says so instead of silently becoming a list or paragraph.

## [0.13.1] — 2026-10-06

### Fixed
- **Breakdown rows no longer run off narrow phones.** A breakdown refused to break a label inside a word, so a long word beside a large value and change pushed the row past the screen's edge (50px past a 320px screen in testing), cutting off the change column. A label now wraps between words as before, and breaks inside a word only when the word is wider than the room the value and change leave, as other emailmd text does. At 375px and wider, typical labels are unaffected.

## [0.13.0] — 2026-10-06

### Added
- **Data color roles in the theme.** Four optional keys, each with a `dark:` override that dark mode follows, and each falling back to an existing key, so an email that leaves them unset renders as before:
  - `muted_color` (`mutedColor`) colors secondary text: stat, chart, progress, sparkline and rating labels, image captions, the header and footer, the button fallback line, a change with no good or bad reading, and upcoming steps. Falls back to `body_color`.
  - `chart_colors` (`chartColors`) is a list of data colors. Chart, progress and sparkline bars default to its first color, otherwise `brand_color`. A palette set only for light mode carries over to dark.
  - `positive_color` and `negative_color` color a change's text in stats, sparklines and breakdowns, apart from the success and danger button fills. They fall back to `success_color` and `danger_color`.
- **`color=chart-N`.** Chart, progress, sparkline, stats and breakdown colors (on the block or a single item) can name a palette entry, which dark mode switches to the dark palette's entry. A hex color still stays as written in both modes. An entry the palette lacks warns and falls back to the default.
- **Color-role classes.** `emd-muted`, `emd-good`, `emd-bad`, `emd-c<N>` (text) and `emd-c<N>-bg` (fill) carry dark-mode rules, and HTML in a `::: raw` block can use them to follow the theme.
- **`::: breakdown` directive.** A ranked list, or a total split into its parts, one row per list item: a label, its value lined up down the right edge, and an optional signed change (`(+12%)`) with an arrow colored by `good=up|down|neutral`, settable per row. An ordered list ranks the rows from its start number, and lines under an item become a muted sub-label. `swatches=true` adds a dot per row colored from `chart_colors` in order, and `bars=true` a bar under each row in the same color, scaled like a chart. Hairline dividers in `divider_color` separate the rows unless `dividers=false`. Labels wrap between words, never mid-word. Every color follows dark mode, and the text part gets aligned columns with ASCII bars.
- **`stack=false` on stats.** Keeps the tiles in their rows on a phone instead of stacking them one per row. The tiles are drawn as cells of one table, which makes every tile in a row as tall as the tallest, and on a phone they get a tighter inset and type scaled from the body size and tiles per row (1.5× at two across, 1.125× at three, 0.94× at four). The phone styles are added to the head only when the email has a block that uses them.
- **`oklch()` and `hsl()` theme colors.** Theme colors written as `oklch()` (as shadcn and Tailwind themes are) or `hsl()` are converted to hex, which every email client supports. A color outside sRGB is brought in by lowering its chroma, as browsers do, and a translucent one becomes `rgba()`.

### Changed
- **One content inset for every block (visual change).** Text, headings, images, dividers, tables, buttons, accordions, centered blocks, and header, footer and hero text sat 57px in from the content area's edge: the section's 32px plus MJML's default 25px of side padding on each element. Stats, chart, progress, sparkline, steps, rating, callout and highlight cards, columns, and raw blocks sat at 32px, so their left edges didn't line up. Everything now sits at 32px. Text and images get 50px wider (536px instead of 486px in the default 600px layout, and 311px instead of 261px on a 375px phone), and vertical spacing is unchanged. A `::: raw` block lines up with `padding="0 32px"`.
- **Buttons follow dark mode (visual change).** Buttons used to keep their light-theme colors in dark mode, and the dark link rule repainted their text in the link color. A button whose fill matched the dark content box, as the built-in palette's near-black primary button does, lost its fill and read as a plain link. Themed buttons now carry `emd-btn-primary`, `-secondary`, `-success`, `-danger` or `-warning` and switch to the dark palette's fill, text and outline colors, under `prefers-color-scheme` and Outlook.com's `[data-ogsb]`/`[data-ogsc]`. A button with its own `color=` gets `emd-btn-custom` and keeps its colors in both modes, its white text included. Every button keeps `emd-btn`.
- **Preheader has no font size.** MJML also sets its hidden preheader to `font-size:1px`, which, like the white color dropped in 0.12.0, adds nothing to `display:none`, zero size and `opacity:0`, and reads to spam filters as hidden text (SpamAssassin's `FONT_INVIS_*` rules). It is dropped.
- **`Theme` has optional and list-valued keys.** `mutedColor`, `chartColors`, `positiveColor` and `negativeColor` are optional, and `chartColors` is a `string[]`, so code that indexes a `Theme` with any `keyof Theme` and expects a string needs to narrow the key.
- **`hsl()` theme colors are written as hex.** They used to pass through as written; the color is the same.
- **Change arrows follow a dark `success_color` / `danger_color`.** The ▲/▼ text in stats and sparklines kept its light-theme color in dark mode, on the assumption that success and danger are the same in both palettes. It now takes the dark palette's positive and negative colors, so a `dark:` override of either applies. With the built-in palettes nothing changes.
- **Stats tiles in a row end level (visual change).** A tile with no change sat a line shorter than a tile beside it that had one. It now gets a blank line in the change's place, hidden from screen readers and dropped on a phone, where the tiles stack. A row where every tile, or no tile, has a change is unchanged. The phone rule is added to the head only when a row needs it.

### Fixed
- **Mailchimp merge tags.** `*|FNAME|*` lost its asterisks to emphasis (`<em>|FNAME|</em>`), and in a URL its pipes were percent-encoded (`*%7CEMAIL%7C*`). Mailchimp tags (`*|TAG|*`, `*|IF:…|*`, `*|DATE:…|*`) now pass through verbatim in text, links, hrefs and buttons, in both the HTML and the text part, and are accepted as whole directive values like other template tags.
- **Handlebars triple braces in URLs.** `{{{user_id}}}` in an href came out as `{{{user_id}}%7D`; it now passes through whole.
- **Double-quoted font names.** A `font_family` such as `"DM Sans", sans-serif` was rejected as invalid and replaced with the default stack. Double-quoted names are now accepted and written with single quotes, which is the same CSS.

## [0.12.0] — 2026-10-05

### Added
- **`::: raw` directive** — a block of HTML passed through untouched, in a section of its own with no side padding, so an embedded layout (a design-tool export, a pre-rendered component, an ad slot) gets the email's full width. The lines inside are never parsed as markdown, so blank lines, indentation and `_underscores_` in the HTML can't end the block, turn into a code block or become emphasis; template tags still pass through. The section keeps the content area's background, its dark-mode color and the `emd-top`/`emd-bot` edge marking, but the built-in dark-mode text rules don't reach into it: only the wrapper is recolored, so uncolored text follows dark mode while HTML with its own colors keeps them. `padding=` insets it, and `emd-raw` is its CSS hook. Like a code fence, the closing `:::` must be at least as long as the opening one. With `allowHtml: false` the block is escaped to text like any other raw HTML.
- **`image-heavy` lint rule** — flags email that is mostly images, measured on the rendered output the way a reader sees it: visible text (not alt text, the preheader, or `display: none` copies) against images weighted by width, with icons, social buttons, tracking pixels and lone logos left out. It asks for about 400 characters of text per full-width image, and is a warning under 100 characters. Spam filters' own image-only rules measure raw HTML length and so rarely fire on email markup; the alt-text-heavy plain-text part that results is what they penalize instead.
- **`buildDocument(body, theme, meta)`** wraps MJML body content in the full document the default wrapper produces: the `<mjml>` root with `lang` and `dir`, the head with the preheader, dark mode and custom `css`, and the themed `<mj-body>`. A custom wrapper that only changes the body can build it with `segmentsToMjml(segments, theme, meta)` and hand it here, and keeps every feature, including ones added later. `defaultWrapper` is now exactly this.

### Changed
- **Social icons are served from emailmd.dev.** `::: social` icons used to be MJML's defaults, hotlinked from a third-party host that also sees each open from clients that fetch images directly. They are now emailmd's own set, white marks from Simple Icons (CC0) on the same brand colors, at `https://www.emailmd.dev/icons/social/<network>.png`. Each network keeps its look, with current marks (the circular Facebook mark, the GitHub Octocat, the Medium wordmark). `icon-base` and per-link `icon` overrides work as before.
- **Preheader is no longer white-on-white.** MJML colors its hidden preheader `#ffffff` on top of `display:none`, zero size and `opacity:0`. The color added nothing to the hiding and set off spam filters' hidden-text checks (SpamAssassin's `HTML_FONT_LOW_CONTRAST`) on every email with a preheader, so it is dropped.

### Fixed
- **Quoted directive params with spaces.** A quoted value such as `padding="0 32px"` on a directive line is now read as one value instead of being split at the space.
- **Wrapper docs.** The Wrappers guide and API reference showed `buildHead(theme, preheader)`, so a wrapper copied from them silently lost dark mode, `css`, `lang` and `dir`. They now document the full `buildHead` signature, every `WrapperMeta` field, and `buildDocument`.
- **Raw HTML tables in the text part.** Rows of a raw HTML layout table now each get their own line, and cells in a row are separated by a space, instead of running together (`[Image: Banner]Live text row`).
- **Plain-text entities.** The text part now decodes every HTML entity (named, decimal and hex) in one pass, so raw HTML such as `alt="a &#183; b"` reads `a · b` and `&amp;lt;` is no longer decoded twice into `<`. Headings no longer come out as `Q&AMP;A`, and table columns are padded by the characters a reader sees instead of the encoded ones.
- **Hidden elements in the text part.** Elements hidden with an inline `display: none`, such as an alternate phone layout a media query swaps in, are left out of the text part, so their content isn't listed twice.
- **Linked image captions.** A `caption` set on the link around an image now appears in the text part, as it already did in the HTML.

## [0.11.1] — 2026-10-02

### Changed
- **MJML 5.4.1.** `mjml` and `mjml-browser` now require `^5.4.1`, which pulls patched versions of mjml's own dependencies (cssnano, postcss, juice, cheerio and its undici, the glob/minimatch chain, svgo) and fixes a crash under `validationLevel: 'strict'` when an `mj-include` is denied. Rendered output is unchanged.

## [0.11.0] — 2026-08-26

Data visualization ahead of 1.0. Every block below is drawn from table cells and text glyphs — no images, no SVG, no JavaScript — so it renders in a client that blocks remote images, follows the theme into automatic dark mode, mirrors in RTL documents, and draws itself again in the plain-text part rather than flattening to a list of numbers.

### Added
- **`::: chart` directive** — horizontal bar charts written as a `Label: value` list. Bars are table cells with a background color. Percentages scale against 100 rather than the largest item, so `42%` never draws as a full bar; anything else scales to the largest value, and `max=` pins the scale explicitly. Params: `max`, `color`, `track`, `height`, `values=false`, and `border-radius` (defaults to a pill, `0` squares the ends); a single bar takes `{color=…}` on its list item and keeps that color in both light and dark mode. The plain-text part draws the same chart in ASCII instead of flattening to a list of numbers.
- **`::: progress` directive** — a progress bar or stepped meter for one value against a known maximum, written `Label: value` like a chart bar. The unfilled groove always shows, so the distance left to go reads as clearly as the distance covered. A bare number is out of 100; `max=` takes any other unit and spells out the denominator in the readout (`8,400 / 10,000`), and `steps=` draws 2–12 discrete segments instead of a continuous bar. Params: `max`, `steps`, `color`, `track`, `height`, `values=false`, `border-radius`. Text below the value line renders under the bar, and the plain-text part draws the same meter in ASCII.
- **`::: sparkline` and `::: trend` directives** — a run of numbers written `Label: a, b, c` drawn as a row of columns small enough to sit beside its own label, plus the trend indicator that reads it out: the latest value, how far the series moved, and an arrow colored by whether that was the win. `::: trend` is the same block without its columns, for a row of KPIs. The change is measured across the whole series, first point to last, so the number and the shape describe the same window; a series starting at zero or below reports its absolute move rather than a meaningless percentage, and `good=down` flips the reading for metrics where falling is the win. Columns are measured from zero by default, with `min=` to open up a series that lives in a narrow band far from it. The plot grows with the series and then stops, so a short sparkline stays sparkline-sized instead of stretching across the whole email, and the readout sits beside it rather than across the email from it; a full-width plot pins the readout to the far edge instead. Params: `min`, `max`, `color`, `track` (off by default), `height`, `width`, `good`, `values=false`, `border-radius`. The plain-text part draws the series with block characters (`▃▅▄▆▅▇█  38  ▲ 217%`) instead of collapsing it to the last number.
- **`::: stats` directive** — a grid of KPI tiles, one per list item, written `Label: value` with the change in a signed parenthetical after it (`- Revenue: $48,200 (+12%)`). The sign has to be there, so a plain note in brackets stays part of the value rather than silently becoming a trend line, and the value itself is free text — `Plan: Enterprise` is a valid tile. Tiles are `mj-column` cards rather than cells of one table, so they sit side by side on a desktop client and stack to full width on a phone; they wrap into rows on their own (four go two-by-two rather than three with an orphan) and a short last row keeps its tiles at grid width so they line up under the row above. `good=` says which direction is the win and is settable per tile with `{good=…}`, since one block routinely mixes revenue with churn. Params: `columns` (1–4), `bg` (`none` drops the card), `color`, `size`, `align`, `gap`, `padding`, `good`, `border-radius`; a single tile takes `{color=…}`. The plain-text part lines the tiles up as padded columns so the numbers still read down.
- **`::: steps` and `::: timeline` directives** — an ordered walk drawn as markers on a connecting rail, one list item per step, written `Title: detail` or as two paragraphs where the detail runs longer. Tick a step off and the block stops being instructions and becomes a tracker: ticked steps are behind the reader, with the rail lit over the ground already covered, and unticked ones are ahead of them. Which step the reader is *on* is never inferred from the ticks — an unticked box says the step has not happened, and promoting one of them would render something the author did not write. `{state=…}` carries the two positions a box cannot hold: `current`, the step being worked on right now, and `failed`, drawn as a cross in the danger color (`done` and `todo` are also accepted, being `[x]` and `[ ]`, so a block can use one vocabulary throughout). A stated step needs no checkbox. The rail is a table cell carrying a background rather than a border, so it takes the height of whatever text sits beside it: a step whose detail wraps on a phone gets a longer rail, not a broken one. `::: timeline` is the same walk with dots instead of numbers. Params: `marker` (`number`, `dot`, `none`), `color`, `rail` (`none` drops the connector), `size`, `gap`, `start`; numbering otherwise follows the list's own. The plain-text part becomes an indented outline that keeps the markers (`[✓]`, `[→]`, `[ ]`, `[✕]`) so the state still reads down the left edge.
- **`::: rating` directive** — a score drawn on a fixed scale, written `Label: value` as one headline rating or as a list for a breakdown by criterion. The glyphs are text characters, one to a table cell so the spacing survives Outlook dropping `letter-spacing`, and lit glyphs default to the theme's `warning_color` — the amber both palettes share — so a star row needs nothing to flip in dark mode. Scores round to the nearest half, and a half is drawn as a whole glyph faded into the page rather than a hollow or differently colored one: a glyph cannot be cut down the middle, and the clipping that would take is not honoured widely enough to risk drawing the row a glyph too wide. `precision=full` rounds to whole glyphs while the readout still reports the exact score, and a score outside the scale is clamped with a warning, its readout rewritten to the number actually drawn. Params: `max` (1–10, default 5), `icon` (`star`, `heart`, `circle`, `square`), `color`, `track`, `size`, `precision`, `align`, `values=false`. The plain-text part draws the same characters and spells the scale out (`★★★★☆  4.5 / 5`), since a half has no character to stand in for it.

### Changed
- **The MCP server's instructions now list the data directives**, so an assistant driving `render` and `lint` reaches for a chart or a stats block instead of hand-rolling a table of numbers. `::: highlight` was missing from that list too, and is now in it.

### Fixed
- **Columns with explicit widths no longer wrap when their gaps join the row.** A block whose widths already added up — `48` / `4` / `48`, say — overflowed the moment a `bg` on one of the cards turned the gaps into real spacer columns, and the row broke apart into a diagonal cascade instead of sitting side by side. The widths are now scaled into what the gaps leave, so the proportions as written are kept and the row still fits; the existing overflow warning is left for the case it was written for, where the widths themselves crowd out a flexible column. Present since 0.7.1, when card gaps became spacer columns.

## [0.10.0] — 2026-07-25

### Added
- **`emd-top` / `emd-bot` classes on the first and last section of the content box**, so the box can be styled as a whole through the `css` render option — rounded corners being the motivating case. Purely a styling hook: output is visually unchanged until you target them. The content area renders as a stack of same-colored sections, so use the corner longhands rather than the `border-radius` shorthand (a short email is a single section carrying both classes) and style the section and its child `table` together. `::: header` / `::: footer` bands sit on the outer background and stay outside the box; a hero at the top of the document counts as the top of it.

## [0.9.0] — 2026-07-15

### Added
- **`css` render option** for custom styles, emitted as one extra `<mj-style>` in the head after the built-in styles so it can override them. Buttons now carry the class `emd-btn`, so their styles (weight, padding, and anything else with no dedicated option) are reachable through this hook without replacing the wrapper. Inline styles still win, so target them with `!important`, and since it lands as an embedded `<style>` treat it as progressive enhancement. The string is emitted verbatim and is trusted developer input, not a place for end-user-controlled CSS.

### Fixed
- **Buttons now take their font size from `theme.fontSize`** instead of a hardcoded `16px`, so they scale with the body text when the theme is sized down. Default output is unchanged (the default `fontSize` is `16px`).

## [0.8.0] — 2026-07-14

### Added
- **`allowHtml` render option** for rendering Markdown from untrusted sources. Defaults to `true` (raw HTML passes through). Set `allowHtml: false` and raw tags are escaped to text (`<script>` → `&lt;script&gt;`) and `javascript:`/`data:` URLs stay blocked. In this mode the two non-passthrough injection paths are closed too: the `{attr=…}` attribute syntax drops event handlers (`on*`), inline `style`, and `javascript:`/`data:` URL overrides (keeping `class`, `id`, `data-*`, and emailmd's own attrs), and raw HTML inside template tags (`{{…}}`, `${…}`) is escaped instead of restored verbatim. Not a general HTML sanitizer. Layer a dedicated sanitizer for high-assurance threat models. Also available as the CLI flag `--escape-html`.

## [0.7.3] — 2026-07-05

### Fixed
- A columns block opened with `::: columns` (three colons) is now repaired to the required four-colon form. Previously the first inner `:::` close ended the whole block: the first column swallowed the block at full width, later columns lost their layout and card styling, and a literal `:::` paragraph leaked into the HTML and plain text. The repair tracks nested directive opens to find the real closing fence (an unclosed block is also handled), skips code fences, and emits a render warning so authors — and AI assistants aiming for zero warnings — converge on `:::: columns … ::::`.
- A `::: column` outside any `:::: columns` block now emits a render warning instead of silently degrading to regular content.

## [0.7.2] — 2026-07-05

### Fixed
- Quoted directive parameter values (`color="#ffffff"`, `bg='#eff6ff'`, a quoted hero URL) now parse the same as bare values. Previously the quotes were kept in the value, which broke the directive's internal marker and made the whole block silently degrade to plain text — with the malformed marker leaking into the output HTML as a comment.
- Internal marker attribute values are serialized quote-free, so no parameter value can ever produce an unparseable marker again.
- Backstop: if a malformed internal marker is ever encountered anyway, it is stripped from the output and surfaced as a render warning ("A directive could not be parsed…") instead of shipping silently.

## [0.7.1] — 2026-07-04

### Fixed
- Columns `gap` now works between `bg` cards. Card columns paint their background across their padding box, so they never carried gutter padding — adjacent cards rendered flush and `gap` was silently ignored. Boundaries touching a card now get a real spacer column of exactly `gap` pixels (with explicit widths on the content columns so MJML's equal split doesn't count the spacer, and an Outlook-safe fixed-width cell). The spacer holds a `gap`-tall `mj-spacer`, so stacked cards on mobile gain matching vertical separation. A plain column next to a card also drops its half-gutter in favor of the spacer, so mixed pairs get the full gap instead of half. Plain-only columns render exactly as before; `gap=0` keeps cards flush. Warns when explicit widths plus gaps exceed 100%.

## [0.7.0] — 2026-07-04

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
- **`lint()`**: deliverability/accessibility/readability checks that rendering alone can't express — missing image alt text, `http://` links, Gmail's 102KB clip limit (measured on the minified render), generic link text, missing/over-long preheader, missing unsubscribe link, common spam-trigger phrases, images or hero backgrounds still pointing at placeholder hosts (picsum.photos, placehold.co, wsrv.nl, …), and image formats clients can't reliably display (SVG and `data:` URIs as warnings, WebP/AVIF as suggestions). Findings carry a rule id, `warning`/`suggestion` severity, and a source line where one applies; render warnings are folded in under the `render` rule. Template tokens are respected (a `{{tracking_url}}` link is never flagged insecure; `[Unsubscribe]({{unsubscribe_url}})` counts). The CLI exposes it as `emailmd lint [file]` — exit 1 on warnings, `--strict` to fail on suggestions too.
- **MCP server**: `emailmd mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio, exposing three tools to AI clients — `render` (full HTML, plain text, metadata, warnings, output size, and a builder share-link `previewUrl` that carries the markdown in the URL fragment), `lint` (findings + summary), and `read_docs` (fetches emailmd.dev docs so the model can look up syntax). Server instructions teach the write → lint → render → preview workflow. `--partials` preloads partials for every call. The same server is hosted at `https://www.emailmd.dev/api/mcp` (Streamable HTTP, stateless, no auth), and the new `emailmd/mcp` subpath export (`createEmailmdMcpServer`, `registerEmailmdTools`, `builderShareUrl`) lets apps embed it behind their own transport.
- **Syntax highlighting**: fenced code blocks with a language (` ```ts `) are highlighted at render time with email-safe markup (highlight.js core, 17 curated grammars + their aliases). GitHub-flavored token palettes are picked by the luminance of the code background (`cardColor`), so `theme: dark` gets readable light-on-dark tokens, and `theme: auto` emails switch palettes with the reader's dark mode. Unknown or absent languages render as plain code, unchanged from before.
- **Hero background-color fallback**: the hero section now renders a solid background color behind the image (new `bg=` param, default `button_color`), so the overlaid text stays readable when the reader's client blocks remote images — the theme's button color pair is already contrast-tested. The image URL is now optional: an image-less hero renders as a solid banner in the button colors. Hero colors are a self-contained pair, so dark mode leaves them alone in either variant.
- Stable `emd-*` CSS classes on rendered output (`emd-root`, `emd-s`, `emd-bg`, `emd-card`, `emd-hl`, `emd-tbl`, `emd-hero`, `emd-hero-solid`) — hooks for the dark-mode overrides and for custom wrapper CSS.
- `WrapperMeta.darkTheme` (resolved dark palette) and an optional third `darkTheme` parameter on `buildHead`, so custom wrappers can participate in dark mode.
- `WrapperMeta.lang` / `WrapperMeta.dir` (validated frontmatter values), so custom wrappers can emit them on their `<mjml>` tag. `buildHead` takes an optional fourth `dir` parameter and `SegmentContext` a `dir` field, so custom wrappers get the same RTL alignment flipping.

### Fixed
- Accordion expand/collapse markers are now `+`/`−` text glyphs colored with the theme's `heading_color`, replacing MJML's default icons — white PNGs hotlinked from imgur that were invisible on light themes (collapsed panels looked inert) and pulled a third-party host into every email. Custom `icon-wrapped`/`icon-unwrapped` images are untouched.
- Unitless numeric theme lengths (`border_radius: 12`, `font_size: 15`, `content_width: 640` — YAML numbers or bare-number strings, in frontmatter or the `theme` render option) now coerce to `px` instead of emitting invalid CSS like `border-radius: 12` that clients silently drop. Numeric `line_height` stays unitless, which is valid CSS.
- Headings inside a hero now actually render in the hero text color. The docs promised white text "including headings", but the head's global `h1`–`h3` color rules beat the inherited hero color, so default-colored headings rendered in `heading_color` — typically near-black over a photo. The hero color is now inlined on headings whether or not a custom `color=` is set.
- Content now sits vertically centered inside padded boxes. Block elements carry bottom-only margins, so the last block in a callout, highlight, hero, accordion panel, or `bg=` column stacked its margin on the box's bottom padding — a callout ending in a heading showed twice as much space below the text as above it. The final block's bottom margin is now zeroed inline. Paragraphs also get an explicit `p { margin: 0 0 16px 0 }` head rule instead of inheriting each client's default, so their spacing is deterministic too.

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
