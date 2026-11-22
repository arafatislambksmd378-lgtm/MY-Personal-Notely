/**
 * Android/iOS file delivery: writes into the app cache and hands the file to the
 * system share sheet, where the user can save it to Downloads, Drive, email it,
 * or open it in Word / WPS / LibreOffice.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { SaveAndShareOptions, SaveResult } from './files';

export async function saveAndShare(options: SaveAndShareOptions): Promise<SaveResult> {
  const file = new File(Paths.cache, options.fileName);
  try {
    if (file.exists) file.delete();
  } catch {
    /* nothing to delete */
  }
  file.create({ overwrite: true, intermediates: true });
  await file.write(options.data);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: options.mimeType,
      dialogTitle: options.dialogTitle ?? options.fileName,
      UTI: options.mimeType,
    });
  }
  return {
    uri: file.uri,
    shared: canShare,
    locationLabel: canShare ? 'Shared from Notely' : `Saved to ${file.uri}`,
  };
}

export async function printHtmlDocument(html: string, fileName: string): Promise<{ uri: string | null }> {
  const result = await Print.printToFileAsync({ html });
  const source = new File(result.uri);
  const target = new File(Paths.cache, fileName);
  try {
    if (target.exists) target.delete();
  } catch {
    /* ignore */
  }
  source.move(target);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(target.uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
      UTI: 'com.adobe.pdf',
    });
  }
  return { uri: target.uri };
}

export function isShareAvailable(): boolean {
  return true;
}
