/**
 * Rich-text editing surface (Android / iOS implementation).
 *
 * The same shell document runs inside a WebView; commands are delivered through
 * `injectJavaScript` and events come back through `onMessage`.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { buildEditorDocument } from './buildDocument';
import type { EditorMessage, HostMessage } from '@/types/editor';
import type { RichTextEditorHandle, RichTextEditorProps } from './RichTextEditor';

export type { RichTextEditorHandle, RichTextEditorProps };

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { initialHtml, pageSetup, dark, spellcheck, fontScale = 1, onMessage, style, testID },
  ref,
) {
  const webviewRef = useRef<ComponentRef<typeof WebView> | null>(null);
  const messageHandler = useRef(onMessage);
  messageHandler.current = onMessage;

  const documentHtml = useMemo(
    () => buildEditorDocument({ html: initialHtml, pageSetup, dark, spellcheck, fontScale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dispatch = (message: HostMessage) => {
    const payload = JSON.stringify(JSON.stringify(message));
    webviewRef.current?.injectJavaScript(`window.__notelyReceive(${payload}); true;`);
  };

  useImperativeHandle(ref, () => ({ send: dispatch }));

  useEffect(() => {
    dispatch({ type: 'set-theme', dark });
     
  }, [dark]);

  useEffect(() => {
    dispatch({ type: 'set-page-setup', pageSetup: JSON.stringify(pageSetup), fontScale });
     
  }, [fontScale, pageSetup]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as EditorMessage;
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
        onMessage={handleMessage}
        style={styles.webview}
        containerStyle={styles.webview}
        // The shell renders its own background and page card.
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
