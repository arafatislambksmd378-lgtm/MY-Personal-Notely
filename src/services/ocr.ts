/**
 * On-device OCR for scanned pages (Google ML Kit via `expo-mlkit-ocr`).
 *
 * Everything runs on the device; no image ever leaves the phone. When the
 * native module is unavailable (web build, or a device without ML Kit support)
 * `ocrAvailable()` explains why and the scan flow still saves the images.
 */
import { Platform } from 'react-native';
import { isSupported, recognizeText } from 'expo-mlkit-ocr';

export interface OcrResult {
  text: string;
  lineCount: number;
  blockCount: number;
}

export function ocrAvailable(): { available: boolean; reason: string } {
  if (Platform.OS === 'web') {
    return { available: false, reason: 'Text recognition runs in the Android/iOS app, not in the browser preview.' };
  }
  try {
    if (isSupported()) return { available: true, reason: 'On-device text recognition ready' };
  } catch {
    /* fall through */
  }
  return { available: false, reason: 'This device build does not include ML Kit text recognition.' };
}

/** Recognises text in a local file URI or data URI. */
export async function recognizePageText(uri: string): Promise<OcrResult> {
  const result = await recognizeText(uri);
  const lineCount = result.blocks?.reduce((total, block) => total + (block.lines?.length ?? 0), 0) ?? 0;
  return {
    text: (result.text ?? '').trim(),
    lineCount,
    blockCount: result.blocks?.length ?? 0,
  };
}

/** Paragraph-friendly text: joins recognised lines, keeps blank lines. */
export function tidyOcrText(rawText: string): string {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
