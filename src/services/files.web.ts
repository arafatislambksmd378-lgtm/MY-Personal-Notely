/**
 * Browser delivery: triggers a real download and, when the Web Share API is
 * available, offers the native share sheet instead.
 */
import type { SaveAndShareOptions, SaveResult } from './files';

function toBlobPart(data: string | Uint8Array): BlobPart {
  if (typeof data === 'string') return data;
  const view = new Uint8Array(data);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

export async function saveAndShare(options: SaveAndShareOptions): Promise<SaveResult> {
  const blob = new Blob([toBlobPart(options.data)], { type: options.mimeType });

  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], options.fileName, { type: options.mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: options.dialogTitle ?? options.fileName });
        return { uri: options.fileName, shared: true, locationLabel: 'Shared' };
      }
    } catch {
      /* fall through to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = options.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { uri: url, shared: false, locationLabel: 'Downloaded' };
}

export async function printHtmlDocument(html: string, fileName: string): Promise<{ uri: string | null }> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Allow pop-ups to print this note.');
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = fileName;
  // Give the browser a tick to lay the document out before printing.
  await new Promise((resolve) => setTimeout(resolve, 250));
  printWindow.focus();
  printWindow.print();
  return { uri: null };
}

export function isShareAvailable(): boolean {
  return typeof document !== 'undefined';
}
