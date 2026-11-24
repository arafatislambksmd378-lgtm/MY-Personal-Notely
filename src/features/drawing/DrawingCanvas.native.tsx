/**
 * Drawing canvas (Android / iOS implementation).
 *
 * The same drawing document runs inside a WebView; commands are delivered
 * through `injectJavaScript` and state messages come back through `onMessage`.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

import { buildDrawingDocument } from './drawingDocument';
import type { DrawingHostMessage, DrawingMessage } from './types';
import type { DrawingCanvasHandle, DrawingCanvasProps } from './DrawingCanvas';

export type { DrawingCanvasHandle, DrawingCanvasProps };

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas(
  { onMessage, style, testID },
  ref,
) {
  const webviewRef = useRef<ComponentRef<typeof WebView> | null>(null);
  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;

  const documentHtml = useMemo(() => buildDrawingDocument(), []);

  useImperativeHandle(ref, () => ({
    send: (message: DrawingHostMessage) => {
      const payload = JSON.stringify(JSON.stringify(message));
      webviewRef.current?.injectJavaScript(`window.__notelyDrawingReceive(${payload}); true;`);
    },
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as DrawingMessage;
      if (parsed && typeof parsed === 'object' && 'type' in parsed) messageHandler.current(parsed);
    } catch {
      /* ignore malformed payloads */
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <WebView
        ref={webviewRef}
        source={{ html: documentHtml }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        setSupportMultipleWindows={false}
        // The canvas must never scroll or bounce; it owns every gesture.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        scalesPageToFit={false}
        onMessage={handleMessage}
        style={styles.webview}
        containerStyle={styles.webview}
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  webview: { flex: 1, backgroundColor: '#FFFFFF' },
});
