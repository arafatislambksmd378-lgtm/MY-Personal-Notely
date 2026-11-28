import { describe, expect, it, vi } from 'vitest';

import {
  buildScanHtml,
  captureScanPage,
  collectScanPages,
  recognisePage,
  scannedPageCountText,
  type ScanPage,
} from '@/services/scan';
import { ocrAvailable, recognizePageText, tidyOcrText } from '@/services/ocr';
import { startDictation, voiceInputStatus } from '@/services/voice';

const state = vi.hoisted(() => ({
  platform: 'android' as 'android' | 'web' | 'ios',
  mlkitSupported: true,
  ocrShouldThrow: false,
  ocrText: 'Invoice 42\nTotal 99.00\n\nThank you',
  permissionGranted: true,
  started: [] as Record<string, unknown>[],
  listeners: new Map<string, ((event: unknown) => void)[]>(),
  stopped: 0,
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
    select: (options: Record<string, unknown>) => options[state.platform] ?? options.default,
  },
  Appearance: { getColorScheme: () => 'light' },
}));

vi.mock('expo-mlkit-ocr', () => ({
  isSupported: () => state.mlkitSupported,
  recognizeText: async () => {
    if (state.ocrShouldThrow) throw new Error('recogniser crashed');
    return {
      text: state.ocrText,
      blocks: [
        { text: 'Invoice 42', boundingBox: { x: 0, y: 0, width: 1, height: 1 }, lines: [{ text: 'Invoice 42', elements: [], boundingBox: { x: 0, y: 0, width: 1, height: 1 } }] },
        { text: 'Total 99.00', boundingBox: { x: 0, y: 0, width: 1, height: 1 }, lines: [{ text: 'Total 99.00', elements: [], boundingBox: { x: 0, y: 0, width: 1, height: 1 } }] },
      ],
    };
  },
}));

vi.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => true,
    requestPermissionsAsync: async () => ({ granted: state.permissionGranted, status: 'granted' }),
    start: (options: Record<string, unknown>) => state.started.push(options),
    stop: () => {
      state.stopped += 1;
    },
    addListener: (event: string, listener: (payload: unknown) => void) => {
      const list = state.listeners.get(event) ?? [];
      list.push(listener);
      state.listeners.set(event, list);
      return {
        remove: () => {
          const current = state.listeners.get(event) ?? [];
          state.listeners.set(event, current.filter((entry) => entry !== listener));
        },
      };
    },
  },
}));

const PAGE: ScanPage = { dataUri: 'data:image/jpeg;base64,AAA', width: 1200, height: 1600 };

function emit(event: string, payload: unknown) {
  for (const listener of state.listeners.get(event) ?? []) listener(payload);
}

describe('scan pipeline', () => {
  it('captures a page and keeps the image metadata', async () => {
    const page = await captureScanPage(async () => ({ dataUri: PAGE.dataUri, byteSize: 3, width: 1200, height: 1600 }));
    expect(page).toEqual({ dataUri: PAGE.dataUri, width: 1200, height: 1600 });
  });

  it('stops cleanly when the user cancels the camera', async () => {
    expect(await captureScanPage(async () => null)).toBeNull();
  });

  it('collects pages until cancelled and reports progress', async () => {
    const queue: ({ dataUri: string; width: number; height: number; byteSize: number } | null)[] = [
      { ...PAGE, byteSize: 3 },
      { ...PAGE, byteSize: 3 },
      null,
    ];
    const progress: string[] = [];
    const pages = await collectScanPages(
      async () => queue.shift() ?? null,
      { recognize: false },
      (update) => progress.push(`${update.stage}:${update.page}`),
    );
    expect(pages).toHaveLength(2);
    expect(progress[0]).toBe('capturing:1');
    expect(progress.at(-1)).toBe('done:2');
  });

  it('respects the page limit', async () => {
    const pages = await collectScanPages(async () => ({ ...PAGE, byteSize: 3 }), { maxPages: 3 });
    expect(pages).toHaveLength(3);
  });

  it('recognises text on-device when ML Kit is available', async () => {
    state.mlkitSupported = true;
    const page = await recognisePage(PAGE);
    expect(page.text).toContain('Invoice 42');
    expect(page.ocrError).toBeUndefined();
  });

  it('degrades gracefully when ML Kit is unavailable', async () => {
    state.mlkitSupported = false;
    const page = await recognisePage(PAGE);
    expect(page.text).toBeUndefined();
    expect(page.ocrError).toMatch(/not available/i);
    state.mlkitSupported = true;
  });

  it('reports recogniser failures without losing the image', async () => {
    state.ocrShouldThrow = true;
    const page = await recognisePage(PAGE);
    expect(page.dataUri).toBe(PAGE.dataUri);
    expect(page.ocrError).toMatch(/crashed/);
    state.ocrShouldThrow = false;
  });

  it('builds note HTML with page headings, images and text', () => {
    const html = buildScanHtml([{ ...PAGE, text: 'Line one\nLine two\n\nSecond paragraph' }]);
    expect(html).toContain('<h3>Page 1</h3>');
    expect(html).toContain('<img src="data:image/jpeg;base64,AAA" alt="Scanned page 1" />');
    expect(html).toContain('Line one<br />Line two');
    expect(html).toContain('<p>Second paragraph</p>');
  });

  it('can omit the recognised text', () => {
    const html = buildScanHtml([{ ...PAGE, text: 'hidden' }], { includeText: false });
    expect(html).not.toContain('hidden');
    expect(html).toContain('<img');
  });

  it('escapes recognised text so OCR cannot inject markup', () => {
    const html = buildScanHtml([{ ...PAGE, text: '<script>alert(1)</script>' }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns nothing for an empty scan', () => {
    expect(buildScanHtml([])).toBe('');
    expect(scannedPageCountText(1)).toBe('1 page captured');
    expect(scannedPageCountText(4)).toBe('4 pages captured');
  });

  it('tidyOcrText collapses blank lines and trims', () => {
    expect(tidyOcrText('  a  \n\n\n\nb  ')).toBe('a\n\nb');
  });

  it('exposes OCR availability per platform', () => {
    state.platform = 'web';
    expect(ocrAvailable().available).toBe(false);
    state.platform = 'android';
    expect(ocrAvailable().available).toBe(true);
    state.mlkitSupported = false;
    expect(ocrAvailable().available).toBe(false);
    state.mlkitSupported = true;
  });

  it('recognizePageText summarises blocks and lines', async () => {
    const result = await recognizePageText(PAGE.dataUri);
    expect(result.text).toContain('Invoice 42');
    expect(result.blockCount).toBe(2);
    expect(result.lineCount).toBe(2);
  });
});

describe('voice typing', () => {
  it('reports availability on the native path', () => {
    state.platform = 'android';
    const status = voiceInputStatus();
    expect(status.available).toBe(true);
    expect(status.reason).toMatch(/on-device/i);
  });

  it('streams recognised text and stops on request', async () => {
    state.platform = 'android';
    state.started.length = 0;
    state.listeners.clear();
    state.stopped = 0;
    const transcripts: { text: string; final: boolean }[] = [];
    const errors: string[] = [];

    const session = startDictation(
      (text, isFinal) => transcripts.push({ text, final: isFinal }),
      (message) => errors.push(message),
    );
    expect(session).not.toBeNull();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.started[0]).toMatchObject({ lang: 'en-US', interimResults: true });
    emit('result', { isFinal: false, results: [{ transcript: 'hello wor', confidence: 0.4 }] });
    emit('result', { isFinal: true, results: [{ transcript: 'hello world', confidence: 0.9 }] });
    expect(transcripts).toEqual([
      { text: 'hello wor', final: false },
      { text: 'hello world', final: true },
    ]);

    session?.stop();
    expect(state.stopped).toBe(1);
    expect(errors).toHaveLength(0);
  });

  it('explains a denied microphone permission', async () => {
    state.platform = 'android';
    state.permissionGranted = false;
    state.listeners.clear();
    const errors: string[] = [];
    startDictation(() => undefined, (message) => errors.push(message));
    await Promise.resolve();
    await Promise.resolve();
    expect(errors[0]).toMatch(/microphone/i);
    state.permissionGranted = true;
  });

  it('maps recogniser errors to human text', async () => {
    state.platform = 'android';
    state.permissionGranted = true;
    state.listeners.clear();
    const errors: string[] = [];
    startDictation(() => undefined, (message) => errors.push(message));
    await Promise.resolve();
    await Promise.resolve();
    emit('error', { error: 'no-speech' });
    expect(errors[0]).toMatch(/no speech/i);
  });

  it('uses the browser API on web and reports when it is missing', () => {
    state.platform = 'web';
    (globalThis as unknown as { window?: unknown }).window = {};
    expect(voiceInputStatus().available).toBe(false);
    expect(startDictation(() => undefined, () => undefined)).toBeNull();

    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      started = false;
      start() {
        this.started = true;
      }
      stop() {
        this.started = false;
      }
    }
    const created: FakeRecognition[] = [];
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      SpeechRecognition: class extends FakeRecognition {
        constructor() {
          super();
          created.push(this);
        }
      },
    };
    const transcripts: string[] = [];
    const session = startDictation((text) => transcripts.push(text), () => undefined);
    expect(voiceInputStatus().available).toBe(true);
    expect(session).not.toBeNull();
    created[0].onresult?.({
      resultIndex: 0,
      results: Object.assign([[{ transcript: 'spoken words' }]], { 0: Object.assign([{ transcript: 'spoken words' }], { isFinal: true }) }),
    });
    expect(transcripts.join(' ')).toContain('spoken words');
    delete (globalThis as unknown as { window?: unknown }).window;
  });
});
