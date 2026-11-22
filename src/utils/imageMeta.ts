/** Reads pixel dimensions + mime type from a base64 data URI (pure, testable). */
export interface ImageInfo {
  mime: string;
  extension: 'png' | 'jpeg' | 'gif' | 'webp' | 'bin';
  width: number;
  height: number;
  base64: string;
}

const MIME_EXTENSIONS: Record<string, ImageInfo['extension']> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export function parseDataUri(dataUri: string): { mime: string; base64: string } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUri.trim());
  if (!match) return null;
  if (!match[2]) return { mime: match[1], base64: '' };
  return { mime: match[1], base64: match[3] };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pngSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function gifSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 10) return null;
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49) return null;
  return [bytes[6] | (bytes[7] << 8), bytes[8] | (bytes[9] << 8)];
}

function jpegSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < bytes.length - 9) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return [width, height];
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 30) return null;
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[8] !== 0x57) return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunk === 'VP8 ') {
    return [(bytes[26] | (bytes[27] << 8)) & 0x3fff, (bytes[28] | (bytes[29] << 8)) & 0x3fff];
  }
  if (chunk === 'VP8L') {
    const b = bytes;
    const width = 1 + (((b[22] & 0x3f) << 8) | b[21]);
    const height = 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6));
    return [width, height];
  }
  if (chunk === 'VP8X') {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return [width, height];
  }
  return null;
}

export function readImageInfo(dataUri: string): ImageInfo | null {
  const parsed = parseDataUri(dataUri);
  if (!parsed || !parsed.base64) return null;
  const extension = MIME_EXTENSIONS[parsed.mime.toLowerCase()] ?? 'bin';
  const bytes = base64ToBytes(parsed.base64);
  const size =
    (extension === 'png' ? pngSize(bytes) : null) ??
    (extension === 'jpeg' ? jpegSize(bytes) : null) ??
    (extension === 'gif' ? gifSize(bytes) : null) ??
    (extension === 'webp' ? webpSize(bytes) : null) ??
    ([640, 480] as [number, number]);
  return {
    mime: parsed.mime,
    extension,
    width: size[0],
    height: size[1],
    base64: parsed.base64,
  };
}

/** Scales an image to fit `maxWidth` while keeping its aspect ratio. */
export function fitImage(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: Math.round(maxWidth * 0.75) };
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.round((height * maxWidth) / width) };
}
