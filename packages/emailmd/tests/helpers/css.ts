/**
 * Every CSS rule in the rendered head whose selector list names `selector`,
 * bare or behind an Outlook.com `[data-ogsb]`/`[data-ogsc]` prefix, as
 * `<matched selector> {<declarations>}`.
 */
export function rulesFor(html: string, selector: string): string[] {
  const out: string[] = [];
  for (const [, selectors, body] of html.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of selectors.split(',').map((s) => s.trim())) {
      if (sel === selector || sel.replace(/^\[data-og[sbc]+\] /, '') === selector) out.push(`${sel} {${body}}`);
    }
  }
  return out;
}
