/**
 * Rich-text editing surface (web implementation).
 *
 * The editor runs inside a sandboxed iframe loaded from `srcDoc`, which means
 * the app's own DOM can never be mutated by user content and the exact same
 * editing runtime is used by the Android WebView implementation.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { buildEditorDocument } from './buildDocument';
import type { EditorMessage, HostMessage } from '@/types/editor';
import type { PageSetup } from '@/types/models';

export interface RichTextEditorHandle {
  send: (message: HostMessage) => void;
}

export interface RichTextEditorProps {
  initialHtml: string;
  pageSetup: PageSetup;
  dark: boolean;
  spellcheck: boolean;
  fontScale?: number;
  fontUrl?: string | null;
  onMessage: (message: EditorMessage) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { initialHtml, pageSetup, dark, spellcheck, fontScale = 1, fontUrl, onMessage, style, testID },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;

  // The document is built once: subsequent updates flow through messages so the
  // caret position and undo stack survive theme/page-setup changes.
  const documentHtml = useMemo(
    () => buildEditorDocument({ html: initialHtml, pageSetup, dark, spellcheck, fontScale, fontUrl }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useImperativeHandle(ref, () => ({
    send: (message: HostMessage) => {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify(message), '*');
    },
  }));

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as EditorMessage;
        if (parsed && typeof parsed === 'object' && 'type' in parsed) messageHandler.current(parsed);
      } catch {
        /* ignore malformed messages from inside the editor */
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Keep the surface in sync with appearance changes without reloading content.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'set-theme', dark }), '*');
  }, [dark]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ type: 'set-page-setup', pageSetup: JSON.stringify(pageSetup), fontScale }),
      '*',
    );
  }, [fontScale, pageSetup]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <iframe
        ref={frameRef}
        title="Notely document editor"
        srcDoc={documentHtml}
        style={{ border: 'none', width: '100%', height: '100%', backgroundColor: 'transparent' }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
