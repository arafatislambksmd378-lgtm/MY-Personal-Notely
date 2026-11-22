/**
 * Voice typing.
 *
 * - Android / iOS: `expo-speech-recognition` (on-device recognition service).
 * - Web: the browser SpeechRecognition API (Chrome/Edge).
 *
 * Both paths expose the same tiny session interface, and when no recogniser is
 * available the status explains why instead of failing silently.
 */
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

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

function getBrowserRecognition(): RecognitionConstructor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const candidate =
    (window as unknown as { SpeechRecognition?: RecognitionConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
  return candidate ?? null;
}

function nativeAvailable(): boolean {
  try {
    return typeof ExpoSpeechRecognitionModule?.isRecognitionAvailable === 'function'
      ? ExpoSpeechRecognitionModule.isRecognitionAvailable()
      : false;
  } catch {
    return false;
  }
}

export function voiceInputStatus(): { available: boolean; reason: string } {
  if (getBrowserRecognition()) return { available: true, reason: 'Browser speech recognition available' };
  if (Platform.OS !== 'web' && nativeAvailable()) {
    return { available: true, reason: 'On-device speech recognition ready (Android speech service)' };
  }
  return {
    available: false,
    reason:
      Platform.OS === 'web'
        ? 'This browser does not expose a speech recognition API. Chrome and Edge do.'
        : 'This device has no speech recognition service installed. Add one from Android settings → Languages → Voice input, or use the keyboard’s dictation key.',
  };
}

/** Starts dictation; returns null when no recogniser is available. */
export function startDictation(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (message: string) => void,
): DictationSession | null {
  if (Platform.OS === 'web') return startBrowserDictation(onTranscript, onError);
  return startNativeDictation(onTranscript, onError);
}

function startBrowserDictation(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (message: string) => void,
): DictationSession | null {
  const Constructor = getBrowserRecognition();
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript ?? '';
      if (!transcript) continue;
      if (result.isFinal) onTranscript(transcript.trim(), true);
      else interim += transcript;
    }
    if (interim.trim()) onTranscript(interim.trim(), false);
  };
  recognition.onerror = (event) => {
    onError(
      event.error === 'not-allowed'
        ? 'Microphone access was blocked. Allow it in the browser site settings.'
        : `Speech recognition error: ${event.error}`,
    );
  };
  recognition.onend = () => undefined;
  try {
    recognition.start();
  } catch {
    return null;
  }
  return { stop: () => recognition.stop() };
}

function startNativeDictation(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (message: string) => void,
): DictationSession | null {
  if (!nativeAvailable()) return null;

  const subscriptions: Array<{ remove: () => void }> = [];
  let stopped = false;

  const cleanup = () => {
    for (const subscription of subscriptions) {
      try {
        subscription.remove();
      } catch {
        /* listener already gone */
      }
    }
    subscriptions.length = 0;
  };

  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript?.trim() ?? '';
      if (transcript) onTranscript(transcript, Boolean(event.isFinal));
    }),
  );
  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      const code = (event as { error?: string }).error ?? 'unknown';
      onError(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'Microphone access was denied. Allow the microphone for Notely in Android settings.'
          : code === 'no-speech'
            ? 'No speech detected — try again a little closer to the microphone.'
            : `Speech recognition error: ${code}`,
      );
      cleanup();
    }),
  );
  subscriptions.push(
    ExpoSpeechRecognitionModule.addListener('end', () => {
      cleanup();
    }),
  );

  ExpoSpeechRecognitionModule.requestPermissionsAsync()
    .then((permission) => {
      if (!permission.granted) {
        onError('Microphone access was denied. Allow the microphone for Notely in Android settings.');
        cleanup();
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    })
    .catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Could not start speech recognition');
      cleanup();
    });

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
