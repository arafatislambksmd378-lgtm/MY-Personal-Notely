/**
 * Platform-independent file delivery.
 * Metro resolves `files.native.ts` / `files.web.ts`.
 */
export interface SaveAndShareOptions {
  fileName: string;
  mimeType: string;
  data: string | Uint8Array;
  dialogTitle?: string;
}

export interface SaveResult {
  uri: string;
  shared: boolean;
  locationLabel: string;
}

export async function saveAndShare(options: SaveAndShareOptions): Promise<SaveResult> {
  throw new Error('File delivery is not available on this platform.');
}

export async function printHtmlDocument(html: string, fileName: string): Promise<{ uri: string | null }> {
  throw new Error('Printing is not available on this platform.');
}

export function isShareAvailable(): boolean {
  return false;
}
