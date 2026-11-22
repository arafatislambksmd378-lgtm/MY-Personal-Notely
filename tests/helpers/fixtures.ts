import type { DocumentRecord, PageSetup } from '@/types/models';
import { defaultPageSetup } from '@/types/models';

export const SAMPLE_HTML = `<h1>Quarterly Review</h1>
<p>Hello <b>world</b> — with <i>italics</i>, <u>underline</u> and <s>strike</s>.</p>
<h2>Highlights</h2>
<ul>
<li>Shipped the <b>editor</b></li>
<li>Improved exports</li>
</ul>
<ol>
<li>Plan</li>
<li>Build</li>
</ol>
<blockquote>Consistency is a feature.</blockquote>
<table><tbody>
<tr><th>Week</th><th>Focus</th></tr>
<tr><td>1</td><td>Design</td></tr>
</tbody></table>
<p><a href="https://example.com">Reference link</a></p>
<hr />
<p>Special characters: café — naïve ₹ ৳ 日本語</p>`;

export function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  const now = new Date('2026-01-15T10:00:00.000Z').toISOString();
  return {
    id: 'doc_test',
    notebookId: 'nb_test',
    title: 'Quarterly Review',
    contentHtml: SAMPLE_HTML,
    plainText: 'Quarterly Review\nHello world',
    excerpt: 'Quarterly Review Hello world',
    cardColor: 'purple',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    deletedAt: null,
    pageSetup: defaultPageSetup as PageSetup,
    wordCount: 20,
    charCount: 120,
    readingMinutes: 1,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    ...overrides,
  };
}

/** 1x1 transparent PNG. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
