/** Helpers for rendering search matches without pulling in a parser. */

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Splits `text` into plain and matching segments (case-insensitive). */
export function splitHighlight(text: string, query: string): HighlightPart[] {
  const needle = query.trim();
  if (!needle || !text) return [{ text, match: false }];
  const parts: HighlightPart[] = [];
  const haystack = text.toLowerCase();
  const lower = needle.toLowerCase();
  let index = 0;
  let found = haystack.indexOf(lower, index);
  while (found !== -1) {
    if (found > index) parts.push({ text: text.slice(index, found), match: false });
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    index = found + needle.length;
    found = haystack.indexOf(lower, index);
  }
  if (index < text.length) parts.push({ text: text.slice(index), match: false });
  return parts;
}

/** True when every whitespace-separated term appears in the text. */
export function matchesAllTerms(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}
