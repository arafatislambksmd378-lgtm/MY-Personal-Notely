/**
 * Image insertion pipeline: capture from camera or gallery, downscale large
 * photos, and return a data URI that can be embedded directly in the document
 * (so exports and backups stay self-contained).
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { APP_CONFIG } from '@/config/app';

export interface PickedImage {
  dataUri: string;
  byteSize: number;
  width: number;
  height: number;
}

export type ImageSource = 'camera' | 'library';

function estimateBytes(base64: string): number {
  return Math.round((base64.length * 3) / 4);
}

export async function pickImage(source: ImageSource): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission was denied. Enable it in system settings to scan documents.'
        : 'Photo library permission was denied. Enable it in system settings to insert images.',
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          exif: false,
        });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error('The selected image could not be read.');

  let base64 = asset.base64;
  let width = asset.width ?? 0;
  let height = asset.height ?? 0;

  if (estimateBytes(base64) > APP_CONFIG.maxImageBytes) {
    const scale = Math.sqrt(APP_CONFIG.maxImageBytes / estimateBytes(base64));
    const resized = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: Math.floor(width * scale) } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (resized.base64) {
      base64 = resized.base64;
      width = resized.width ?? width;
      height = resized.height ?? height;
    }
  }

  const mime = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  return {
    dataUri: `data:${mime};base64,${base64}`,
    byteSize: estimateBytes(base64),
    width,
    height,
  };
}

/** Converts a remote/asset URI into a data URI (used by imports). */
export async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image data.'));
    reader.readAsDataURL(blob);
  });
}
