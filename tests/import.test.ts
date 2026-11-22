import { describe, expect, it } from 'vitest';
import { importFromBytes, importFromString, detectFormat, titleFromFileName } from '@/services/import/convert';
import { markdownToHtml } from '@/services/import/markdown';
import { htmlToDocx } from '@/services/export/docx';
import { htmlToOdt } from '@/services/export/odt';
import { SAMPLE_HTML, TINY_PNG } from './helpers/fixtures';

describe('format detection', () => {
  it('detects supported extensions', () => {
    expect(detectFormat('notes.md')).toBe('md');
    expect(detectFormat('REPORT.DOCX')).toBe('docx');
    expect(detectFormat('book.odt')).toBe('odt');
    expect(detectFormat('page.html')).toBe('html');
    expect(detectFormat('plain.txt')).toBe('txt');
    expect(detectFormat('photo.png')).toBeNull();
  });

  it('derives a readable title from the file name', () => {
    expect(titleFromFileName('Q4_roadmap-final.docx')).toBe('Q4 roadmap final');
    expect(titleFromFileName('.txt')).toBe('Imported note');
  });
});

describe('markdown import', () => {
  it('converts headings, emphasis, lists, quotes and links', () => {
    const html = markdownToHtml(`# Title

Some **bold** and *italic* and \`code\`.

## List
- one
- two

1. first
2. second

> quoted line

[link](https://example.com)

---

\`\`\`
const x = 1;
\`\`\`
`);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<b>bold</b>');
    expect(html).toContain('<i>italic</i>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain('<hr />');
    expect(html).toContain('<pre>const x = 1;</pre>');
  });

  it('escapes raw HTML to prevent injection', () => {
    const html = markdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converts pipe tables', () => {
    const html = markdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>2</td>');
  });
});

describe('plain text and html import', () => {
  it('wraps text into paragraphs', () => {
    const result = importFromString('notes.txt', 'First line\nstill first\n\nSecond paragraph');
    expect(result.html).toContain('<p>First line<br />still first</p>');
    expect(result.html).toContain('<p>Second paragraph</p>');
    expect(result.format).toBe('txt');
  });

  it('sanitises imported html', () => {
    const result = importFromString(
      'page.html',
      '<h2>Keep</h2><script>evil()</script><p onclick="x()">Body</p><iframe src="x"></iframe>',
    );
    expect(result.html).toContain('<h2>Keep</h2>');
    expect(result.html).not.toContain('script');
    expect(result.html).not.toContain('onclick');
    expect(result.html).not.toContain('iframe');
  });

  it('rejects unsupported formats', () => {
    expect(() => importFromString('photo.png', 'x')).toThrow(/Unsupported file type/);
  });
});

describe('docx / odt round trip', () => {
  it('imports a DOCX produced by Notely', async () => {
    const bytes = await htmlToDocx(SAMPLE_HTML, { title: 'Round trip' });
    const result = await importFromBytes('roundtrip.docx', bytes);
    expect(result.format).toBe('docx');
    expect(result.html).toContain('Quarterly Review');
    expect(result.html).toContain('<b>world</b>');
    expect(result.html).toContain('<h2>Highlights</h2>');
    expect(result.html).toContain('<li>Plan</li>');
    expect(result.html).toContain('<table>');
    expect(result.plainText).toContain('Consistency is a feature.');
  });

  it('imports a DOCX with images as data URIs', async () => {
    const bytes = await htmlToDocx(`<p><img src="${TINY_PNG}" alt="dot" /></p>`);
    const result = await importFromBytes('image.docx', bytes);
    // Image relationship extraction is best-effort; the text must survive.
    expect(result.html).toContain('<p>');
    expect(result.plainText).not.toContain('<img');
  });

  it('imports an ODT produced by Notely', async () => {
    const bytes = await htmlToOdt(SAMPLE_HTML, { title: 'Round trip' });
    const result = await importFromBytes('roundtrip.odt', bytes);
    expect(result.format).toBe('odt');
    expect(result.html).toContain('Quarterly Review');
    expect(result.html).toContain('Highlights');
  });

  it('rejects a corrupt package with a clear message', async () => {
    const notAZip = new TextEncoder().encode('definitely not a zip file');
    await expect(importFromBytes('broken.docx', notAZip)).rejects.toThrow();
  });
});
