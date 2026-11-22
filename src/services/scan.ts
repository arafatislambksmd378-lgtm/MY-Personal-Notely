/**
 * Document scanning: capture pages with the camera, optionally recognise their
 * text on-device, and turn the result into note HTML.
 *
 * The capture step is injected so the pipeline can be tested without a camera.
 */
import { escapeHtml } from '@/utils/text';
import { ocrAvailable, recognizePageText, tidyOcrText } from './ocr';
import type { PickedImage } from './media';

export interface ScanPage {
  dataUri: string;
  width: number;
  height: number;
  /** Recognised text, when OCR ran successfully for this page. */
  text?: string;
  ocrError?: string;
}

export interface ScanOptions {
  /** Run ML Kit text recognition on every captured page. */
  recognize?: boolean;
  /** Append the recognised text under each page image. */
  includeText?: boolean;
  title?: string;
}

export type CapturePage = () => Promise<PickedImage | null>;

export interface ScanProgress {
  page: number;
  total?: number;
  stage: 'capturing' | 'recognising' | 'done';
}

/** Captures exactly one page. */
export async function captureScanPage(capture: CapturePage): Promise<ScanPage | null> {
  const image = await capture();
  if (!image) return null;
  return { dataUri: image.dataUri, width: image.width, height: image.height };
}

/** Runs OCR for a captured page, tolerating unsupported devices. */
export async function recognisePage(page: ScanPage): Promise<ScanPage> {
  if (!ocrAvailable().available) {
    return { ...page, ocrError: 'Text recognition is not available on this device.' };
  }
  try {
    const result = await recognizePageText(page.dataUri);
    return { ...page, text: tidyOcrText(result.text) };
  } catch (error) {
    return { ...page, ocrError: error instanceof Error ? error.message : 'Text recognition failed' };
  }
}

/** Captures several pages in a row (the UI ends the loop by cancelling). */
export async function collectScanPages(
  capture: CapturePage,
  options: ScanOptions & { maxPages?: number } = {},
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanPage[]> {
  const maxPages = options.maxPages ?? 10;
  const pages: ScanPage[] = [];
  while (pages.length < maxPages) {
    onProgress?.({ page: pages.length + 1, total: maxPages, stage: 'capturing' });
    const page = await captureScanPage(capture);
    if (!page) break;
    let next = page;
    if (options.recognize) {
      onProgress?.({ page: pages.length + 1, total: maxPages, stage: 'recognising' });
      next = await recognisePage(page);
    }
    pages.push(next);
  }
  onProgress?.({ page: pages.length, total: maxPages, stage: 'done' });
  return pages;
}

/** Builds the HTML inserted into the note. */
export function buildScanHtml(pages: ScanPage[], options: ScanOptions = {}): string {
  if (!pages.length) return '';
  const blocks: string[] = [];
  pages.forEach((page, index) => {
    blocks.push(`<h3>Page ${index + 1}</h3>`);
    blocks.push(`<p><img src="${page.dataUri}" alt="Scanned page ${index + 1}" /></p>`);
    if (options.includeText !== false && page.text) {
      for (const paragraph of page.text.split(/\n{2,}/)) {
        const withBreaks = escapeHtml(paragraph.trim()).replace(/\n/g, '<br />');
        if (withBreaks) blocks.push(`<p>${withBreaks}</p>`);
      }
    }
  });
  return blocks.join('\n');
}

export function scannedPageCountText(count: number): string {
  return count === 1 ? '1 page captured' : `${count} pages captured`;
}
