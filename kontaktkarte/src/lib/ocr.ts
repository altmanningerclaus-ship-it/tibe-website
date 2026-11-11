import { extractTextFromImage, isSupported } from 'expo-text-extractor';

/**
 * Texterkennung komplett auf dem Gerät:
 * Android → Google ML Kit (on-device), iOS → Apple Vision.
 */
export const ocrAvailable = isSupported;

export async function recognizeText(uri: string): Promise<string[]> {
  if (!isSupported) return [];
  return extractTextFromImage(uri);
}
