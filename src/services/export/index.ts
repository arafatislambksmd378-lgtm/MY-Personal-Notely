/**
 * Export facade.
 *
 * `buildExport` produces the bytes/string for a format; `shareDocument` writes
 * and hands it to the platform. Only formats wired here are advertised in the
 * UI, so the app never claims an unimplemented export.
 */
import type { DocumentRecord, PageSetup } from '@/types/models';
import { htmlToMarkdown } from './markdown';
import { htmlToRtf } from './rtf';
import { htmlToDocx } from './docx';
import { htmlToOdt } from './odt';
import { buildStandaloneHtml } from './htmlDocument';
import { htmlToPlainText } from '@/utils/text';
import { sanitizeHtml } from '@/utils/sanitize';
import { saveAndShare, printHtmlDocument } from '@/services/files';
import { recordShare } from '@/db/repositories/shares';

export type ExportFormat = 'pdf' | 'docx' | 'odt' | 'rtf' | 'html' | 'md' | 'txt';

export interface ExportFormatInfo {
  format: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  { format: 'pdf', label: 'PDF', extension: 'pdf', mimeType: 'application/pdf', description: 'Print-ready, fixed layout' },
  { format: 'docx', label: 'Word (DOCX)', extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: 'Editable in Word & WPS' },
  { format: 'odt', label: 'OpenDocument (ODT)', extension: 'odt', mimeType: 'application/vnd.oasis.opendocument.text', description: 'LibreOffice & OpenOffice' },
  { format: 'rtf', label: 'Rich Text (RTF)', extension: 'rtf', mimeType: 'application/rtf', description: 'Universal rich text' },
  { format: 'html', label: 'Web page (HTML)', extension: 'html', mimeType: 'text/html', description: 'Keeps full formatting' },
  { format: 'md', label: 'Markdown', extension: 'md', mimeType: 'text/markdown', description: 'Plain text with structure' },
  { format: 'txt', label: 'Plain text', extension: 'txt', mimeType: 'text/plain', description: 'Text only, no formatting' },
];

export interface ExportPayload {
  fileName: string;
  mimeType: string;
  data: string | Uint8Array;
  isPrintJob?: boolean;
}

export function safeFileName(title: string, extension: string): string {
  const base = (title || 'Untitled')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 60) || 'Untitled';
  return `${base}.${extension}`;
}

function prepareHtml(doc: DocumentRecord): string {
  return sanitizeHtml(doc.contentHtml ?? '');
}

export async function buildExport(doc: DocumentRecord, format: ExportFormat): Promise<ExportPayload> {
  const title = doc.title?.trim() || 'Untitled';
  const setup: PageSetup = doc.pageSetup;
  const html = prepareHtml(doc);

  switch (format) {
    case 'md':
      return {
        fileName: safeFileName(title, 'md'),
        mimeType: 'text/markdown',
        data: htmlToMarkdown(html),
      };
    case 'txt':
      return {
        fileName: safeFileName(title, 'txt'),
        mimeType: 'text/plain',
        data: `${htmlToPlainText(html)}\n`,
      };
    case 'rtf':
      return {
        fileName: safeFileName(title, 'rtf'),
        mimeType: 'application/rtf',
        data: htmlToRtf(html, title),
      };
    case 'html':
      return {
        fileName: safeFileName(title, 'html'),
        mimeType: 'text/html',
        data: buildStandaloneHtml({ html, title, pageSetup: setup }),
      };
    case 'docx':
      return {
        fileName: safeFileName(title, 'docx'),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: await htmlToDocx(html, {
          title,
          pageSize: setup.paperSize,
          landscape: setup.orientation === 'landscape',
        }),
      };
    case 'odt':
      return {
        fileName: safeFileName(title, 'odt'),
        mimeType: 'application/vnd.oasis.opendocument.text',
        data: await htmlToOdt(html, { title }),
      };
    case 'pdf':
      return {
        fileName: safeFileName(title, 'pdf'),
        mimeType: 'application/pdf',
        data: buildStandaloneHtml({ html, title, pageSetup: setup, forPrint: true }),
        isPrintJob: true,
      };
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export interface ShareOutcome {
  fileName: string;
  shared: boolean;
  locationLabel: string;
}

export async function shareDocument(doc: DocumentRecord, format: ExportFormat): Promise<ShareOutcome> {
  const payload = await buildExport(doc, format);

  if (payload.isPrintJob) {
    const result = await printHtmlDocument(String(payload.data), payload.fileName);
    await recordShare({ documentId: doc.id, format, target: result.uri ?? 'print-dialog' });
    return {
      fileName: payload.fileName,
      shared: Boolean(result.uri),
      locationLabel: result.uri ? 'PDF created' : 'Print dialog opened — choose “Save as PDF”',
    };
  }

  const result = await saveAndShare({
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    data: payload.data,
    dialogTitle: payload.fileName,
  });
  await recordShare({ documentId: doc.id, format, target: result.locationLabel });
  return { fileName: payload.fileName, shared: result.shared, locationLabel: result.locationLabel };
}
