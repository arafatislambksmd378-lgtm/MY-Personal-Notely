/**
 * Import entry point used by the UI. Keeps the Expo-specific file picker out of
 * `convert.ts` so the conversion logic can be unit-tested in Node.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { importFromBytes } from './convert';

export * from './convert';

/** Opens the system file picker and converts the chosen document. */
export async function pickAndImport() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: [
      'text/markdown',
      'text/plain',
      'text/html',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      '*/*',
    ],
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  let bytes: Uint8Array;
  if (asset.file) {
    bytes = new Uint8Array(await asset.file.arrayBuffer());
  } else {
    const file = new File(asset.uri);
    bytes = new Uint8Array(await file.arrayBuffer());
  }
  return importFromBytes(asset.name ?? 'imported.txt', bytes);
}
