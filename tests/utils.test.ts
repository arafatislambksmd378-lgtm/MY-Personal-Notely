import { describe, expect, it } from 'vitest';
import {
  countChars,
  countCharsNoSpaces,
  countOccurrences,
  countParagraphs,
  countSentences,
  countWords,
  htmlToPlainText,
  makeExcerpt,
  readingMinutes,
  titleOrDefault,
} from '@/utils/text';
import { sanitizeHtml } from '@/utils/sanitize';
import { diffLines } from '@/utils/diff';
import { buildChartSvg, parseChartValues } from '@/utils/chart';
import { reviewText, suggestCorrections, editDistance } from '@/services/spellcheck';
import { readImageInfo, fitImage, parseDataUri } from '@/utils/imageMeta';
import { parseHtml, tableRows, textContent } from '@/utils/htmlParser';
import { TINY_PNG } from './helpers/fixtures';

describe('text utilities', () => {
  it('strips html into readable plain text', () => {
    const plain = htmlToPlainText('<h1>Title</h1><p>Hello <b>bold</b> world</p><ul><li>One</li></ul>');
    expect(plain).toContain('Title');
    expect(plain).toContain('Hello bold world');
    expect(plain).toContain('• One');
    expect(plain).not.toContain('<');
  });

  it('counts words, characters, sentences and paragraphs', () => {
    const text = 'One two three. Four five!\n\nSecond paragraph here.';
    expect(countWords(text)).toBe(8);
    expect(countChars(text)).toBe(text.length);
    expect(countCharsNoSpaces('a b c')).toBe(3);
    expect(countSentences(text)).toBe(3);
    expect(countParagraphs(text)).toBe(2);
    expect(readingMinutes(400)).toBe(2);
  });

  it('builds excerpts and fallback titles', () => {
    const excerpt = makeExcerpt('a'.repeat(300), 50);
    expect(excerpt.length).toBeLessThanOrEqual(51);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(titleOrDefault('  ', 'First line\nsecond')).toBe('First line');
    expect(titleOrDefault('', '')).toBe('Untitled');
  });

  it('counts non-overlapping occurrences case-insensitively', () => {
    expect(countOccurrences('Hello hello HELLO', 'hello')).toBe(3);
    expect(countOccurrences('Hello hello', 'hello', true)).toBe(1);
    expect(countOccurrences('aaa', 'aa')).toBe(1);
  });
});

describe('sanitizer', () => {
  it('removes scripts, handlers and unsafe urls', () => {
    const dirty = `<p onclick="steal()">Hi</p><script>x()</script><a href="javascript:alert(1)">bad</a><img src="data:image/png;base64,AAA" onerror="x()" />`;
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('data:image/png;base64,AAA');
  });

  it('keeps allow-listed formatting and tables', () => {
    const clean = sanitizeHtml('<h2>H</h2><p><b>b</b><i>i</i><u>u</u></p><table><tbody><tr><td>c</td></tr></tbody></table>');
    expect(clean).toContain('<h2>H</h2>');
    expect(clean).toContain('<b>b</b>');
    expect(clean).toContain('<td>c</td>');
  });
});

describe('diff', () => {
  it('detects added and removed lines', () => {
    const result = diffLines('a\nb\nc', 'a\nc\nd');
    expect(result.removed).toBe(1);
    expect(result.added).toBe(1);
    expect(result.segments.some((segment) => segment.kind === 'equal')).toBe(true);
  });

  it('handles identical documents', () => {
    const result = diffLines('same', 'same');
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });
});

describe('charts', () => {
  it('parses values and ignores junk', () => {
    expect(parseChartValues('4, 7; 9\n12')).toEqual([4, 7, 9, 12]);
    expect(parseChartValues('abc, 3')).toEqual([3]);
  });

  it('renders svg for each chart type', () => {
    for (const type of ['bar', 'line', 'pie'] as const) {
      const svg = buildChartSvg({ type, title: 'Focus <hours>', labels: ['Mon', 'Tue'], values: [3, 5] });
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('</svg>');
      expect(svg).toContain('Focus &lt;hours&gt;');
    }
  });
});

describe('spellcheck', () => {
  it('computes edit distance and suggests corrections', () => {
    expect(editDistance('form', 'farm')).toBe(1);
    expect(suggestCorrections('wrold')).toContain('world');
  });

  it('flags misspellings and grammar issues', () => {
    const result = reviewText('This is teh wrold. This is is fine.');
    const kinds = result.issues.map((issue) => issue.message);
    expect(result.issues.some((issue) => issue.kind === 'spelling')).toBe(true);
    expect(kinds.some((message) => message === 'Repeated word')).toBe(true);
  });

  it('does not flag correct text', () => {
    const result = reviewText('The quick brown fox jumps over the lazy dog.');
    expect(result.issues).toHaveLength(0);
  });
});

describe('image metadata', () => {
  it('reads png dimensions from a data uri', () => {
    expect(parseDataUri(TINY_PNG)?.mime).toBe('image/png');
    const info = readImageInfo(TINY_PNG);
    expect(info?.width).toBe(1);
    expect(info?.height).toBe(1);
    expect(info?.extension).toBe('png');
  });

  it('scales images to a maximum width', () => {
    expect(fitImage(1000, 500, 480)).toEqual({ width: 480, height: 240 });
    expect(fitImage(100, 50, 480)).toEqual({ width: 100, height: 50 });
  });
});

describe('html parser', () => {
  it('parses nested markup and table rows inside tbody', () => {
    const root = parseHtml('<table><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>');
    const table = root.children[0];
    expect(textContent(table)).toBe('AB');
    expect(table.type === 'element' && tableRows(table).length).toBe(2);
  });

  it('auto-closes list items', () => {
    const root = parseHtml('<ul><li>one<li>two</ul>');
    const list = root.children[0];
    expect(list.type === 'element' && list.children.length).toBe(2);
  });
});
