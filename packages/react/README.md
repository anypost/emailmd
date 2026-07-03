# @emailmd/react

React hooks and components for [emailmd](https://emailmd.dev) — live email preview and a full markdown email builder.

```bash
npm install @emailmd/react emailmd
```

## `useEmailmd(markdown, options?)`

Renders markdown to email-safe HTML as it changes — debounced, race-safe, SSR-safe.

```tsx
import { useEmailmd, EmailPreview } from '@emailmd/react';

function Editor() {
  const [markdown, setMarkdown] = useState('# Hello');
  const { html, text, meta, warnings, error, isRendering } = useEmailmd(markdown);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
      <EmailPreview html={html} />
    </div>
  );
}
```

Options extend emailmd's `RenderOptions` (theme, fonts, minify, strings, …) with `debounceMs` (default `150`).

## `<EmailPreview />`

Sandboxed iframe preview of a rendered email.

```tsx
<EmailPreview html={html} device="mobile" />
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `html` | `string` | — | Rendered email document (`RenderResult.html`) |
| `device` | `'desktop' \| 'mobile' \| number` | `'desktop'` | Simulated viewport width |

All other iframe props (`className`, `style`, `sandbox`, …) pass through.

## `<EmailmdBuilder />`

The full builder from [emailmd.dev/builder](https://emailmd.dev/builder), as a drop-in component: CodeMirror markdown editor with a formatting toolbar, visual theme editor, emoji and snippet pickers, live preview with device switching, HTML (pretty/minified with a Gmail-clip meter) and plain-text output, render warnings, localStorage autosave, download, and optional share links.

```tsx
import { EmailmdBuilder } from '@emailmd/react';
import '@emailmd/react/styles.css';

<EmailmdBuilder />
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultValue` | `string` | starter template | Initial markdown when no draft exists |
| `value` / `onChange` | `string` / `(md) => void` | — | Controlled mode |
| `autoSave` | `boolean \| string` | `true` | Draft persistence; a string sets the localStorage key |
| `share` | `boolean` | `false` | `#md=` share links (read on mount + share button) |
| `colorScheme` | `'light' \| 'dark'` | `'light'` | UI scheme; all colors are CSS variables (`--emd-*`) you can override |
| `renderOptions` | `RenderOptions` | — | Passed through to emailmd's `render()` |
| `debounceMs` | `number` | `150` | Typing → re-render debounce |

The UI has no dependency on Tailwind or any component library — styles ship in `styles.css`, scoped under `.emd-` class names.

## Docs

Full documentation at [emailmd.dev/docs](https://emailmd.dev/docs).

## License

MIT
