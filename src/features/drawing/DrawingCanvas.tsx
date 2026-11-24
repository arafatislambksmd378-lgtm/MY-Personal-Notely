/**
 * Drawing canvas (web implementation).
 *
 * The drawing document runs inside a sandboxed iframe loaded from `srcDoc`,
 * mirroring how the rich-text editor works on web. Commands are posted in and
 * state messages are posted back.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { buildDrawingDocument } from './drawingDocument';
import type { DrawingHostMessage, DrawingMessage } from './types';

export interface DrawingCanvasHandle {
  send: (message: DrawingHostMessage) => void;
}

export interface DrawingCanvasProps {
  onMessage: (message: DrawingMessage) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas(
  { onMessage, style, testID },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;

  const documentHtml = useMemo(() => buildDrawingDocument(), []);

  useImperativeHandle(ref, () => ({
    send: (message: DrawingHostMessage) => {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify(message), '*');
    },
  }));

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as DrawingMessage;
        if (parsed && typeof parsed === 'object' && 'type' in parsed) messageHandler.current(parsed);
      } catch {
        /* ignore malformed messages from inside the canvas */
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <iframe
        ref={frameRef}
        title="Notely drawing canvas"
        srcDoc={documentHtml}
        style={{ border: 'none', width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' },
});
