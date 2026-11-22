/**
 * Voice input.
 *
 * Web preview: uses the browser SpeechRecognition API (Chrome/Edge).
 * Android: speech-to-text requires a native module (e.g. @react-native-voice or
 * an ML Kit recogniser) that is not part of this Expo build, so the feature
 * reports its status honestly instead of pretending to work.
 */
import { Platform } from 'react-native';

export interface DictationSession {
  stop: () => void;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const candidate =
    (window as unknown as { SpeechRecognition?: RecognitionConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
  return candidate ?? null;
}

export function voiceInputStatus(): { available: boolean; reason: string } {
  if (getRecognitionConstructor()) {
    return { available: true, reason: 'Browser speech recognition available' };
  }
  return {
    available: false,
    reason:
      Platform.OS === 'web'
        ? 'This browser does not expose a speech recognition API.'
        : 'On-device speech recognition needs a native module that is not included in this build. Use the keyboard dictation key on your device instead.',
  };
}

export function startDictation(
  onTranscript: (text: string) => void,
  onError: (message: string) => void,
): DictationSession | null {
  const Constructor = getRecognitionConstructor();
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    onTranscript(transcript.trim());
  };
  recognition.onerror = (event) => onError(event.error);
  recognition.onend = () => undefined;
  try {
    recognition.start();
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Could not start dictation');
    return null;
  }
  return { stop: () => recognition.stop() };
}
