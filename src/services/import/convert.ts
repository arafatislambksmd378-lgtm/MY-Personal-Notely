/**
 * Import pipeline: pick a file, detect its format, convert it to Notely HTML.
 * Formats that are not implemented throw a descriptive error instead of failing
 * silently (the UI surfaces the message).
 */
import { markdownToHtml } from './markdown';
import { docxToHtml, odtToHtml } from './ooxml';
import { sanitizeHtml } from '@/utils/sanitize';
import { escapeHtml, htmlToPlainText } from '@/utils/text';

export type ImportFormat = 'md' | 'txt' | 'html' | 'docx' | 'odt';

export const IMPORT_FORMAT_INFO: { format: ImportFormat; label: string; extensions: string[] }[] = [
  { format: 'md', label: 'Markdown', extensions: ['.md', '.markdown'] },
  { format: 'txt', label: 'Plain text', extensions: ['.txt'] },
  { format: 'html', label: 'Web page', extensions: ['.html', '.htm'] },
  { format: 'docx', label: 'Word document', extensions: ['.docx'] },
  { format: 'odt', label: 'OpenDocument text', extensions: ['.odt'] },
];

export interface ImportOutcome {
  fileName: string;
  title: string;
  html: string;
  format: ImportFormat;
  plainText: string;
}

export function detectFormat(fileName: string): ImportFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.odt')) return 'odt';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.txt')) return 'txt';
  return null;
}

export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imported note';
}

function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

export function importFromString(fileName: string, content: string): ImportOutcome {
  const format = detectFormat(fileName);
  if (!format) {
    throw new Error(
      `Unsupported file type. Notely can import ${IMPORT_FORMAT_INFO.map((info) => info.extensions[0]).join(', ')}.`,
    );
  }
  if (format === 'docx' || format === 'odt') {
    throw new Error('Binary documents must be read as bytes — use importFromBytes.');
  }
  let html: string;
  if (format === 'md') html = markdownToHtml(content);
  else if (format === 'html') html = sanitizeHtml(content);
  else html = textToHtml(content);

  return {
    fileName,
    title: titleFromFileName(fileName),
    html,
    format,
    plainText: htmlToPlainText(html),
  };
}

export async function importFromBytes(fileName: string, bytes: Uint8Array): Promise<ImportOutcome> {
  const format = detectFormat(fileName);
  if (!format) {
    throw new Error(
      `Unsupported file type. Notely can import ${IMPORT_FORMAT_INFO.map((info) => info.extensions[0]).join(', ')}.`,
    );
  }
  if (format === 'docx') {
    const html = sanitizeHtml(await docxToHtml(bytes));
    return { fileName, title: titleFromFileName(fileName), html, format, plainText: htmlToPlainText(html) };
  }
  if (format === 'odt') {
    const html = sanitizeHtml(await odtToHtml(bytes));
    return { fileName, title: titleFromFileName(fileName), html, format, plainText: htmlToPlainText(html) };
  }
  const text = new TextDecoder('utf-8').decode(bytes);
  return importFromString(fileName, text);
}
