/*
 * Shareable-link encoding: markdown → deflate → base64url, carried in the URL
 * fragment (never sent to the server). Falls back to plain base64url where
 * CompressionStream is unavailable. Format: "<version>.<payload>" where
 * version 1 is deflate-raw and version 0 is uncompressed.
 */

const b64encode = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64decode = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function pipeThrough(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const writePromise = (async () => {
    const writer = stream.writable.getWriter();
    // Copy so the chunk is plain-ArrayBuffer-backed, as WritableStream requires.
    await writer.write(new Uint8Array(bytes));
    await writer.close();
  })();

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await writePromise;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function encodeShare(markdown: string): Promise<string> {
  const bytes = new TextEncoder().encode(markdown);
  if (typeof CompressionStream !== 'undefined') {
    const deflated = await pipeThrough(bytes, new CompressionStream('deflate-raw'));
    return `1.${b64encode(deflated)}`;
  }
  return `0.${b64encode(bytes)}`;
}

export async function decodeShare(encoded: string): Promise<string | null> {
  try {
    const dot = encoded.indexOf('.');
    if (dot === -1) return null;
    const version = encoded.slice(0, dot);
    const bytes = b64decode(encoded.slice(dot + 1));
    if (version === '1') {
      if (typeof DecompressionStream === 'undefined') return null;
      const inflated = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
      return new TextDecoder().decode(inflated);
    }
    if (version === '0') {
      return new TextDecoder().decode(bytes);
    }
    return null;
  } catch {
    return null;
  }
}

export const SHARE_HASH_PREFIX = '#md=';

/** Read shared markdown from the current URL fragment, if present. */
export async function readShareFromLocation(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { hash } = window.location;
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  return decodeShare(hash.slice(SHARE_HASH_PREFIX.length));
}

/** Write shared markdown into the URL fragment and return the full URL. */
export async function writeShareToLocation(markdown: string): Promise<string> {
  const encoded = await encodeShare(markdown);
  const url = new URL(window.location.href);
  url.hash = `${SHARE_HASH_PREFIX}${encoded}`;
  window.history.replaceState(null, '', url);
  return url.toString();
}
