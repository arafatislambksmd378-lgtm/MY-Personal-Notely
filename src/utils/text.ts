/** Pure text helpers — shared by the editor, list cards, exports and tests. */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&[a-z#0-9]+;/gi, (match) => {
      if (ENTITIES[match.toLowerCase()]) return ENTITIES[match.toLowerCase()];
      const numeric = /^&#(\d+);$/.exec(match) ?? /^&#x([0-9a-f]+);$/i.exec(match);
      if (numeric) {
        const code = match.toLowerCase().startsWith('&#x')
          ? parseInt(numeric[1], 16)
          : parseInt(numeric[1], 10);
        if (Number.isFinite(code)) return String.fromCodePoint(code);
      }
      return match;
    });
}

/** Converts stored document HTML into the plain text used for search + counting. */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|pre|figcaption|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  text = decodeEntities(text);
  text = text.replace(/\u00a0/g, ' ');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Word count: whitespace separated tokens, numbers and symbols count. */
export function countWords(text: string): number {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return 0;
  return normalized.split(' ').filter(Boolean).length;
}

/** Characters excluding trailing whitespace runs (matches typical word-processor counts). */
export function countChars(text: string): number {
  return text.replace(/\u00a0/g, ' ').length;
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?…]+[.!?…]+/g);
  if (matches) return matches.length;
  return normalizeWhitespace(text) ? 1 : 0;
}

export function readingMinutes(words: number, wordsPerMinute = 200): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

/** Truncated preview text for note cards. */
export function makeExcerpt(plainText: string, maxLength = 120): string {
  const normalized = normalizeWhitespace(plainText);
  if (normalized.length <= maxLength) return normalized;
  const cut = normalized.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function titleOrDefault(title: string, plainText: string): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  const firstLine = plainText.split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : 'Untitled';
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
