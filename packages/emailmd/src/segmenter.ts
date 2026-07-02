import {
  MARKER_CALLOUT_CLOSE,
  MARKER_CENTERED_CLOSE,
  MARKER_HIGHLIGHT_CLOSE,
  MARKER_HEADER_CLOSE,
  MARKER_FOOTER_CLOSE,
  MARKER_HERO_CLOSE,
} from './constants.js';

export type SegmentType = 'text' | 'callout' | 'centered' | 'highlight' | 'header' | 'footer' | 'button' | 'button-group' | 'image' | 'hr' | 'table' | 'hero';

export interface Segment {
  type: SegmentType;
  content: string;
  attrs?: Record<string, string>;
  buttons?: Array<Record<string, string>>;
}

const DIRECTIVE_PAIRS: Array<{ open: string; close: string; type: SegmentType }> = [
];

const PARAMETERIZED_DIRECTIVES: Array<{
  re: RegExp;
  type: SegmentType;
  close: string;
}> = [
  { re: /<!--EMAILMD:CALLOUT_OPEN((?:\s+[\w-]+="[^"]*")*)-->/, type: 'callout', close: MARKER_CALLOUT_CLOSE },
  { re: /<!--EMAILMD:CENTERED_OPEN((?:\s+[\w-]+="[^"]*")*)-->/, type: 'centered', close: MARKER_CENTERED_CLOSE },
  { re: /<!--EMAILMD:HIGHLIGHT_OPEN((?:\s+[\w-]+="[^"]*")*)-->/, type: 'highlight', close: MARKER_HIGHLIGHT_CLOSE },
  { re: /<!--EMAILMD:HEADER_OPEN((?:\s+[\w-]+="[^"]*")*)-->/, type: 'header', close: MARKER_HEADER_CLOSE },
  { re: /<!--EMAILMD:FOOTER_OPEN((?:\s+[\w-]+="[^"]*")*)-->/, type: 'footer', close: MARKER_FOOTER_CLOSE },
  { re: /<!--EMAILMD:HERO_OPEN((?:\s+[\w-]+="[^"]*")*)-->/, type: 'hero', close: MARKER_HERO_CLOSE },
];

function parseMarkerAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

// Matches <p> containing only <a> tags (one or more) with optional whitespace between them
const BUTTON_PARA_RE = /<p>\s*((?:<a\s+[^>]*>[^<]*<\/a>\s*)+)<\/p>/g;
const INNER_LINK_RE = /<a\s+([^>]*)>([^<]*)<\/a>/g;

function parseButtonAttrs(attrString: string): { isButton: boolean; href: string; variant?: string; color?: string; width?: string; fallback?: string; borderRadius?: string } {
  const result = { isButton: false, href: '', variant: undefined as string | undefined, color: undefined as string | undefined, width: undefined as string | undefined, fallback: undefined as string | undefined, borderRadius: undefined as string | undefined };

  // Check for button attribute with optional variant (secondary, success, danger, warning)
  const variantMatch = attrString.match(/\bbutton\.(secondary|success|danger|warning)\b/);
  if (variantMatch) {
    result.isButton = true;
    result.variant = variantMatch[1];
  } else if (/\bbutton\b/.test(attrString)) {
    result.isButton = true;
  }

  if (!result.isButton) return result;

  // Extract href
  const hrefMatch = attrString.match(/href="([^"]*)"/);
  if (hrefMatch) result.href = hrefMatch[1];

  // Extract color attribute (from {button color="#dc2626"})
  const colorMatch = attrString.match(/\bcolor="([^"]*)"/);
  if (colorMatch) result.color = colorMatch[1];

  // Extract width attribute (from {button width="full"})
  const widthMatch = attrString.match(/\bwidth="([^"]*)"/);
  if (widthMatch) result.width = widthMatch[1];

  // Extract fallback attribute (from {button fallback} or {button fallback="custom text"})
  const fallbackValMatch = attrString.match(/\bfallback="([^"]*)"/);
  if (fallbackValMatch) {
    result.fallback = fallbackValMatch[1] || 'true';
  } else if (/\bfallback\b/.test(attrString)) {
    result.fallback = 'true';
  }

  // Extract border-radius attribute (from {button border-radius="16px"})
  const borderRadiusMatch = attrString.match(/\bborder-radius="([^"]*)"/);
  if (borderRadiusMatch) result.borderRadius = borderRadiusMatch[1];

  return result;
}

function extractButtons(html: string): { html: string; buttons: Segment[] } {
  const buttons: Segment[] = [];
  const result = html.replace(BUTTON_PARA_RE, (match, innerLinks) => {
    // Parse all <a> tags in this paragraph
    const links: Array<{ attrString: string; text: string; parsed: ReturnType<typeof parseButtonAttrs> }> = [];
    const re = new RegExp(INNER_LINK_RE.source, 'g');
    let linkMatch;
    while ((linkMatch = re.exec(innerLinks)) !== null) {
      links.push({ attrString: linkMatch[1], text: linkMatch[2], parsed: parseButtonAttrs(linkMatch[1]) });
    }

    // All links must be buttons, otherwise leave paragraph as-is
    if (links.length === 0 || !links.every(l => l.parsed.isButton)) return match;

    const placeholder = `<!--EMAILMD:BUTTON_${buttons.length}-->`;

    if (links.length === 1) {
      const { parsed, text } = links[0];
      const attrs: Record<string, string> = { href: parsed.href, text };
      if (parsed.variant) attrs.variant = parsed.variant;
      if (parsed.color) attrs.color = parsed.color;
      if (parsed.width) attrs.width = parsed.width;
      if (parsed.fallback) attrs.fallback = parsed.fallback;
      if (parsed.borderRadius) attrs['border-radius'] = parsed.borderRadius;
      buttons.push({ type: 'button', content: text, attrs });
    } else {
      const groupButtons = links.map(({ parsed, text }) => {
        const attrs: Record<string, string> = { href: parsed.href, text };
        if (parsed.variant) attrs.variant = parsed.variant;
        if (parsed.color) attrs.color = parsed.color;
        if (parsed.width) attrs.width = parsed.width;
        if (parsed.fallback) attrs.fallback = parsed.fallback;
        if (parsed.borderRadius) attrs['border-radius'] = parsed.borderRadius;
        return attrs;
      });
      buttons.push({ type: 'button-group', content: '', buttons: groupButtons });
    }

    return placeholder;
  });
  return { html: result, buttons };
}

// Matches block-level images: <p><img ...></p> or <p><a ...><img ...></a></p>
// Group 1: <a> attributes (optional, for linked images)
// Group 2: <img> attributes
const BLOCK_IMAGE_RE = /<p>\s*(?:<a\s+([^>]*)>\s*)?<img\s+([^>]*)\/?\s*>\s*(?:<\/a>\s*)?<\/p>/g;

function parseHtmlAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseImageAttrs(imgAttrString: string, linkAttrString?: string): Record<string, string> | null {
  const imgAttrs = parseHtmlAttrs(imgAttrString);

  if (!imgAttrs.src) return null;

  const attrs: Record<string, string> = { src: imgAttrs.src };

  if (imgAttrs.alt) attrs.alt = imgAttrs.alt;
  if (imgAttrs.title) attrs.title = imgAttrs.title;
  if (imgAttrs.width) attrs.width = imgAttrs.width;
  if (imgAttrs.align) attrs.align = imgAttrs.align;
  if (imgAttrs['border-radius']) attrs['border-radius'] = imgAttrs['border-radius'];

  // For linked images, extract href from the <a> tag
  if (linkAttrString) {
    const linkAttrs = parseHtmlAttrs(linkAttrString);
    if (linkAttrs.href) attrs.href = linkAttrs.href;
    // Pull image-relevant attrs from <a> if not already on <img>
    if (linkAttrs.width && !imgAttrs.width) attrs.width = linkAttrs.width;
    if (linkAttrs.align && !imgAttrs.align) attrs.align = linkAttrs.align;
    if (linkAttrs['border-radius'] && !imgAttrs['border-radius']) attrs['border-radius'] = linkAttrs['border-radius'];
  }

  return attrs;
}

function splitOnImages(segments: Segment[]): Segment[] {
  const result: Segment[] = [];

  for (const seg of segments) {
    if (seg.type !== 'text') {
      result.push(seg);
      continue;
    }

    let text = seg.content;
    const re = new RegExp(BLOCK_IMAGE_RE.source, 'g');
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = re.exec(text)) !== null) {
      const attrs = parseImageAttrs(match[2], match[1]);
      if (!attrs) continue;

      const before = text.slice(lastIndex, match.index);
      if (before.trim()) {
        result.push({ type: 'text', content: before });
      }
      result.push({ type: 'image', content: attrs.alt || '', attrs });
      lastIndex = match.index + match[0].length;
    }

    const remaining = text.slice(lastIndex);
    if (remaining.trim()) {
      result.push({ type: 'text', content: remaining });
    }
  }

  return result;
}

function splitOnDirectives(html: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = html;

  while (remaining.length > 0) {
    let earliest: { pos: number; type: SegmentType; openLen: number; close: string; attrs?: Record<string, string> } | null = null;
    for (const pair of DIRECTIVE_PAIRS) {
      const pos = remaining.indexOf(pair.open);
      if (pos !== -1 && (earliest === null || pos < earliest.pos)) {
        earliest = { pos, type: pair.type, openLen: pair.open.length, close: pair.close };
      }
    }

    // Check parameterized directives (regex-based)
    for (const pd of PARAMETERIZED_DIRECTIVES) {
      pd.re.lastIndex = 0;
      const pdMatch = pd.re.exec(remaining);
      if (pdMatch && (earliest === null || pdMatch.index < earliest.pos)) {
        const attrs = parseMarkerAttrs(pdMatch[1]);
        earliest = {
          pos: pdMatch.index,
          type: pd.type,
          openLen: pdMatch[0].length,
          close: pd.close,
          attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        };
      }
    }


    if (!earliest) {
      if (remaining.trim()) {
        segments.push({ type: 'text', content: remaining });
      }
      break;
    }

    const before = remaining.slice(0, earliest.pos);
    if (before.trim()) {
      segments.push({ type: 'text', content: before });
    }

    const afterOpen = remaining.slice(earliest.pos + earliest.openLen);
    const closePos = afterOpen.indexOf(earliest.close);
    if (closePos === -1) {
      segments.push({ type: 'text', content: remaining.slice(earliest.pos) });
      break;
    }

    const innerContent = afterOpen.slice(0, closePos);
    const segment: Segment = { type: earliest.type, content: innerContent };
    if (earliest.attrs) {
      segment.attrs = earliest.attrs;
    }
    segments.push(segment);

    remaining = afterOpen.slice(closePos + earliest.close.length);
  }

  return segments;
}

function splitOnButtonPlaceholders(segments: Segment[], buttons: Segment[]): Segment[] {
  const result: Segment[] = [];
  const placeholderRe = /<!--EMAILMD:BUTTON_(\d+)-->/;

  for (const seg of segments) {
    if (!placeholderRe.test(seg.content)) {
      result.push(seg);
      continue;
    }

    // Parse text parts and button references
    let text = seg.content;
    let match: RegExpExecArray | null;
    const parts: Array<{ text: string } | { btn: Segment }> = [];

    while ((match = placeholderRe.exec(text)) !== null) {
      const before = text.slice(0, match.index);
      if (before.trim()) parts.push({ text: before });
      const btn = buttons[parseInt(match[1], 10)];
      if (btn) parts.push({ btn });
      text = text.slice(match.index + match[0].length);
    }
    if (text.trim()) parts.push({ text });

    // Directive segments: keep buttons embedded so the directive wrapper is preserved
    if (seg.type !== 'text') {
      const textContent = parts
        .filter((p): p is { text: string } => 'text' in p)
        .map(p => p.text)
        .join('');
      const allAttrs = parts
        .filter((p): p is { btn: Segment } => 'btn' in p)
        .flatMap(p => p.btn.type === 'button-group' ? p.btn.buttons! : [p.btn.attrs!]);
      result.push({ ...seg, content: textContent, buttons: allAttrs });
      continue;
    }

    // Plain text segments: split into separate text and button segments
    for (const part of parts) {
      if ('text' in part) {
        result.push({ ...seg, content: part.text });
      } else {
        result.push(part.btn);
      }
    }
  }

  return result;
}

const HR_RE = /<hr\s*\/?>/i;

function splitOnHr(segments: Segment[]): Segment[] {
  const result: Segment[] = [];
  for (const seg of segments) {
    if (seg.type !== 'text') {
      result.push(seg);
      continue;
    }
    let text = seg.content;
    let match: RegExpExecArray | null;
    while ((match = HR_RE.exec(text)) !== null) {
      const before = text.slice(0, match.index);
      if (before.trim()) {
        result.push({ type: 'text', content: before });
      }
      result.push({ type: 'hr', content: '' });
      text = text.slice(match.index + match[0].length);
    }
    if (text.trim()) {
      result.push({ type: 'text', content: text });
    }
  }
  return result;
}

const TABLE_RE = /<table>[\s\S]*?<\/table>/;

function splitOnTables(segments: Segment[]): Segment[] {
  const result: Segment[] = [];
  for (const seg of segments) {
    if (seg.type !== 'text') {
      result.push(seg);
      continue;
    }
    let text = seg.content;
    let match: RegExpExecArray | null;
    while ((match = TABLE_RE.exec(text)) !== null) {
      const before = text.slice(0, match.index);
      if (before.trim()) {
        result.push({ type: 'text', content: before });
      }
      result.push({ type: 'table', content: match[0] });
      text = text.slice(match.index + match[0].length);
    }
    if (text.trim()) {
      result.push({ type: 'text', content: text });
    }
  }
  return result;
}

// Any internal marker still present after all split passes is an orphan —
// e.g. the markers of a directive nested inside another directive, which the
// segmenter does not unwrap. Orphans must not leak into the output document.
// (User-authored lookalike comments are neutralized in the parser and never
// reach this point as matching markers.)
const ORPHAN_MARKER_RE = /<!--EMAILMD:[A-Z_0-9]+(?:\s+[\w-]+="[^"]*")*-->/g;

function stripOrphanMarkers(segments: Segment[]): Segment[] {
  return segments.map((seg) =>
    seg.content.includes('<!--EMAILMD:')
      ? { ...seg, content: seg.content.replace(ORPHAN_MARKER_RE, '') }
      : seg,
  );
}

export function segment(html: string): Segment[] {
  const { html: htmlWithPlaceholders, buttons } = extractButtons(html);
  const segments = splitOnDirectives(htmlWithPlaceholders);
  const withButtons = splitOnButtonPlaceholders(segments, buttons);
  const withImages = splitOnImages(withButtons);
  const withTables = splitOnTables(withImages);
  return stripOrphanMarkers(splitOnHr(withTables));
}
