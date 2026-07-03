const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

const THEME_KEYS = new Set([
  "brand_color",
  "heading_color",
  "body_color",
  "background_color",
  "content_color",
  "card_color",
  "button_color",
  "button_text_color",
  "secondary_color",
  "secondary_text_color",
  "success_color",
  "success_text_color",
  "danger_color",
  "danger_text_color",
  "warning_color",
  "warning_text_color",
  "font_family",
  "font_size",
  "line_height",
  "content_width",
  "border_radius",
  "theme",
  "fonts",
]);

/**
 * Parse flat YAML frontmatter from a markdown string into key-value pairs.
 * Skips indented lines (children of block-valued keys like `fonts:`).
 */
export function parseFrontmatter(
  markdown: string
): Record<string, string> {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    // Skip indented lines — they belong to a block-valued parent key
    if (/^\s/.test(line)) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Parse the nested `fonts:` map from frontmatter.
 * Returns `{ familyName: url, ... }` or `{}` if not present.
 */
export function parseFontsMap(markdown: string): Record<string, string> {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return {};

  const lines = match[1].split("\n");
  const fonts: Record<string, string> = {};
  let inFontsBlock = false;

  for (const line of lines) {
    if (!inFontsBlock) {
      if (/^fonts\s*:\s*$/.test(line)) {
        inFontsBlock = true;
      }
      continue;
    }
    // Exit on any non-indented, non-empty line
    if (line.trim() === "") continue;
    if (!/^\s/.test(line)) break;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    let family = line.slice(0, idx).trim();
    let url = line.slice(idx + 1).trim();
    family = stripQuotes(family);
    url = stripQuotes(url);
    if (family && url) fonts[family] = url;
  }

  return fonts;
}

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Set a key in the YAML frontmatter. Creates the frontmatter block if absent.
 */
export function setFrontmatterKey(
  markdown: string,
  key: string,
  value: string
): string {
  const formatted = formatYamlValue(key, value);
  const match = markdown.match(FRONTMATTER_RE);

  if (!match) {
    // No frontmatter block — create one
    return `---\n${key}: ${formatted}\n---\n${markdown}`;
  }

  const lines = match[1].split("\n");
  let replaced = false;

  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf(":");
    if (idx === -1) continue;
    if (lines[i].slice(0, idx).trim() === key) {
      lines[i] = `${key}: ${formatted}`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    lines.push(`${key}: ${formatted}`);
  }

  const newBlock = `---\n${lines.join("\n")}\n---`;
  return markdown.replace(FRONTMATTER_RE, newBlock);
}

/**
 * Remove a key from the YAML frontmatter.
 * Also removes indented children when the key is a block-valued map (e.g. `fonts:`).
 * Removes the entire frontmatter block if no keys remain.
 */
export function removeFrontmatterKey(
  markdown: string,
  key: string
): string {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return markdown;

  const input = match[1].split("\n");
  const out: string[] = [];
  let skippingBlock = false;

  for (const line of input) {
    if (skippingBlock) {
      // Keep skipping indented children; stop on next top-level line
      if (line.trim() === "" || /^\s/.test(line)) continue;
      skippingBlock = false;
    }
    const idx = line.indexOf(":");
    if (idx !== -1 && line.slice(0, idx).trim() === key) {
      const value = line.slice(idx + 1).trim();
      // Block-valued key (e.g. `fonts:`) — also strip its indented children
      if (value === "") skippingBlock = true;
      continue;
    }
    out.push(line);
  }

  const remaining = out.filter((l) => l.trim() !== "");

  if (remaining.length === 0) {
    // Remove entire frontmatter block and any leading newline
    return markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
  }

  const newBlock = `---\n${remaining.join("\n")}\n---`;
  return markdown.replace(FRONTMATTER_RE, newBlock);
}

/**
 * Replace (or insert) the `fonts:` nested map in frontmatter.
 * Pass an empty object to remove the block entirely.
 */
export function setFontsMap(
  markdown: string,
  fonts: Record<string, string>
): string {
  const entries = Object.entries(fonts).filter(([f, u]) => f && u);
  const cleared = removeFrontmatterKey(markdown, "fonts");
  if (entries.length === 0) return cleared;

  const block = [
    "fonts:",
    ...entries.map(([family, url]) => `  ${quoteYamlKey(family)}: "${url.replace(/"/g, '\\"')}"`),
  ].join("\n");

  const match = cleared.match(FRONTMATTER_RE);
  if (!match) {
    return `---\n${block}\n---\n${cleared}`;
  }
  const newBlock = `---\n${match[1]}\n${block}\n---`;
  return cleared.replace(FRONTMATTER_RE, newBlock);
}

function quoteYamlKey(key: string): string {
  // Quote if it contains special chars or whitespace
  if (/^[a-zA-Z0-9_-]+$/.test(key)) return key;
  return `"${key.replace(/"/g, '\\"')}"`;
}

/**
 * Remove all theme-related keys from frontmatter, preserving non-theme keys.
 * Also strips indented children of any block-valued theme key (e.g. `fonts:`).
 */
export function removeAllThemeKeys(markdown: string): string {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return markdown;

  const input = match[1].split("\n");
  const out: string[] = [];
  let skippingBlock = false;

  for (const line of input) {
    if (skippingBlock) {
      if (line.trim() === "" || /^\s/.test(line)) continue;
      skippingBlock = false;
    }
    const idx = line.indexOf(":");
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      if (THEME_KEYS.has(key)) {
        const value = line.slice(idx + 1).trim();
        if (value === "") skippingBlock = true;
        continue;
      }
    }
    out.push(line);
  }

  const remaining = out.filter((l) => l.trim() !== "");

  if (remaining.length === 0) {
    return markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
  }

  const newBlock = `---\n${remaining.join("\n")}\n---`;
  return markdown.replace(FRONTMATTER_RE, newBlock);
}

function formatYamlValue(key: string, value: string): string {
  // Colors and simple values don't need quoting
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return `"${value}"`;
  if (/^[\d.]+(%|px|em|rem)?$/.test(value)) return value;
  if (/^[a-zA-Z0-9_-]+$/.test(value)) return value;
  // Quote anything with special YAML characters
  return `"${value.replace(/"/g, '\\"')}"`;
}
