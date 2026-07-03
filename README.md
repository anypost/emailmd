# emailmd

### Write markdown. Ship emails. No HTMHELL.

emailmd converts markdown into responsive, email-safe HTML that works across Gmail, Outlook, Apple Mail, Yahoo, and every other client.

![emailmd](https://imgs.emailmd.dev/ss/github_splash.png?1)

## Install

```bash
npm install emailmd
```

## Quick Start

```typescript
import { render } from "emailmd";

const { html, text } = await render(`
# Welcome!

Thanks for signing up.

[Get Started](https://example.com){button}
`);

// html → complete email-safe HTML
// text → plain text version for text/plain MIME part
```

> **v0.3.0 migration:** `render()` is now async. Update calls from `render(md)` to `await render(md)`. Requires Node 20+ (MJML 5).

## CLI

emailmd also ships with a command-line interface.

```bash
# Render to HTML
emailmd input.md

# Write to file
emailmd input.md -o output.html

# Plain text output
emailmd input.md --text

# Pipe from another command
echo "# Hello" | emailmd
```

Run `emailmd --help` for all options.

## React

[`@emailmd/react`](https://www.emailmd.dev/docs/react) provides a live-preview hook (`useEmailmd`), an `<EmailPreview />` iframe component, and `<EmailmdBuilder />` — the full [builder](https://www.emailmd.dev/builder) as a drop-in component for your own app.

```bash
npm install @emailmd/react emailmd
```

## Learn More

- [Docs](https://www.emailmd.dev/docs) — full syntax reference, theming, frontmatter, directives, and API
- [Templates](https://www.emailmd.dev/templates) — ready-made email templates you can copy and customize
- [Builder](https://www.emailmd.dev/builder) — live editor to write and preview emails in your browser

## AI

emailmd is just markdown, so AI is great at writing templates. Feed the full docs to your AI tool:

```
https://www.emailmd.dev/llms-full.txt
```

## Contributing

Contributions are welcome! Feel free to open an [issue](https://github.com/anypost/emailmd/issues) or submit a [pull request](https://github.com/anypost/emailmd/pulls).

> emailmd is under active development. The API may change between minor versions until we hit 1.0 — breaking changes are always called out in the changelog. See [Stability & Versioning](https://www.emailmd.dev/docs/stability) for what the semver contract covers.

## Acknowledgements

- Built with [MJML](https://mjml.io) under the hood
- Sponsored by [Anypost](https://anypost.com/)

## License

MIT
