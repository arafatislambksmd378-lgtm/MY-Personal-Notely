import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildExport, EXPORT_FORMATS, safeFileName } from '@/services/export';
import { htmlToMarkdown } from '@/services/export/markdown';
import { htmlToRtf } from '@/services/export/rtf';
import { htmlToDocx } from '@/services/export/docx';
import { htmlToOdt } from '@/services/export/odt';
import { buildStandaloneHtml } from '@/services/export/htmlDocument';
import { SAMPLE_HTML, TINY_PNG, makeDocument } from './helpers/fixtures';

const doc = makeDocument();

describe('export facade', () => {
  it('advertises exactly the formats it implements', () => {
    expect(EXPORT_FORMATS.map((format) => format.format).sort()).toEqual(
      ['docx', 'html', 'md', 'odt', 'pdf', 'rtf', 'txt'].sort(),
    );
  });

  it('builds every advertised format without throwing', async () => {
    for (const info of EXPORT_FORMATS) {
      const payload = await buildExport(doc, info.format);
      expect(payload.fileName.endsWith(`.${info.extension}`)).toBe(true);
      expect(payload.mimeType).toBe(info.mimeType);
      if (info.format === 'pdf' || info.format === 'html') {
        expect(typeof payload.data).toBe('string');
        expect(Boolean(payload.isPrintJob)).toBe(info.format === 'pdf');
      } else {
        expect(payload.data).toBeTruthy();
      }
    }
  });

  it('sanitises file names', () => {
    expect(safeFileName('Q4 / Roadmap: "final"', 'pdf')).toBe('Q4 Roadmap final.pdf');
    expect(safeFileName('   ', 'txt')).toBe('Untitled.txt');
  });
});

describe('markdown export', () => {
  const markdown = htmlToMarkdown(SAMPLE_HTML);

  it('converts structure', () => {
    expect(markdown).toContain('# Quarterly Review');
    expect(markdown).toContain('## Highlights');
    expect(markdown).toContain('**world**');
    expect(markdown).toContain('*italics*');
    expect(markdown).toContain('~~strike~~');
    expect(markdown).toContain('- Shipped the **editor**');
    expect(markdown).toContain('1. Plan');
    expect(markdown).toContain('> Consistency is a feature.');
    expect(markdown).toContain('| Week | Focus |');
    expect(markdown).toContain('[Reference link](https://example.com)');
    expect(markdown).toContain('---');
  });

  it('keeps unicode text intact', () => {
    expect(markdown).toContain('café — naïve ₹ ৳ 日本語');
  });
});

describe('rtf export', () => {
  const rtf = htmlToRtf(SAMPLE_HTML, 'Quarterly Review');

  it('produces a valid RTF header and unicode escapes', () => {
    expect(rtf.startsWith('{\\rtf1')).toBe(true);
    expect(rtf).toContain('\\fonttbl');
    expect(rtf).toContain('\\u233?'); // é
    expect(rtf.trim().endsWith('}')).toBe(true);
  });

  it('keeps emphasis controls', () => {
    expect(rtf).toContain('{\\b ');
    expect(rtf).toContain('{\\i ');
  });
});

describe('docx export', () => {
  it('creates a valid OOXML package', async () => {
    const bytes = await htmlToDocx(SAMPLE_HTML, { title: 'Quarterly Review' });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('word/document.xml');
    expect(names).toContain('word/styles.xml');
    expect(names).toContain('word/numbering.xml');
    expect(names).toContain('word/_rels/document.xml.rels');

    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(documentXml).toContain('Quarterly Review');
    expect(documentXml).toContain('<w:tbl>');
    expect(documentXml).toContain('<w:numPr>');
    expect(documentXml).toContain('<w:b/>');
    expect(documentXml).toContain('café');

    const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
    expect(contentTypes).toContain('wordprocessingml.document.main+xml');
  });

  it('embeds images with relationships', async () => {
    const html = `<p>Before</p><p><img src="${TINY_PNG}" alt="dot" /></p>`;
    const bytes = await htmlToDocx(html);
    const zip = await JSZip.loadAsync(bytes);
    const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !name.endsWith('/'));
    expect(media).toHaveLength(1);
    const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
    expect(rels).toContain('rIdImage1');
    expect(rels).toContain('media/image1.png');
    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('<w:drawing>');
  });
});

describe('odt export', () => {
  it('creates a valid OpenDocument package with stored mimetype', async () => {
    const bytes = await htmlToOdt(SAMPLE_HTML, { title: 'Quarterly Review' });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    expect(names[0]).toBe('mimetype');
    expect(names).toContain('META-INF/manifest.xml');
    expect(names).toContain('content.xml');

    const mimetype = await zip.file('mimetype')!.async('string');
    expect(mimetype).toBe('application/vnd.oasis.opendocument.text');

    const content = await zip.file('content.xml')!.async('string');
    expect(content).toContain('office:document-content');
    expect(content).toContain('Heading_20_1');
    expect(content).toContain('Quarterly Review');
    expect(content).toContain('<text:list');
    expect(content).toContain('<table:table');
    expect(content).toContain('café');
  });

  it('embeds pictures and lists them in the manifest', async () => {
    const bytes = await htmlToOdt(`<p><img src="${TINY_PNG}" alt="dot" /></p>`);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toContain('Pictures/image1.png');
    const manifest = await zip.file('META-INF/manifest.xml')!.async('string');
    expect(manifest).toContain('Pictures/image1.png');
  });
});

describe('html / pdf source', () => {
  it('renders a standalone document with page setup', () => {
    const html = buildStandaloneHtml({ html: SAMPLE_HTML, title: 'Quarterly Review', forPrint: true });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
    expect(html).toContain('Quarterly Review');
    expect(html).toContain('--paper-width:794px');
    expect(html).toContain('Consistency is a feature.');
  });
});

describe('share flow', () => {
  it('produces the exact payload that the platform layer writes', async () => {
    const payload = await buildExport(doc, 'md');
    expect(payload.fileName).toBe('Quarterly Review.md');
    expect(String(payload.data)).toContain('# Quarterly Review');
  });

  it('rejects unsupported formats instead of pretending to work', async () => {
    await expect(buildExport(doc, 'pages' as never)).rejects.toThrow(/Unsupported export format/);
  });
});
