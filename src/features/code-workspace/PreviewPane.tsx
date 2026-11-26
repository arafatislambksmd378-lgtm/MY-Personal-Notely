/**
 * Sandboxed HTML / CSS / JS preview.
 *
 * Renders the project's HTML, CSS and JS inside an isolated WebView so the
 * code executes for real (client-side only, no server, no fake output). The
 * WebView has no native bridge, so untrusted user code cannot reach the host
 * app — satisfying the "no arbitrary code in the main process" rule.
 *
 * Languages that cannot run client-side (e.g. Python, Java, C++) are shown as
 * edit-only and are never labelled executable.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';

interface PreviewPaneProps {
  html: string;
  css: string;
  js: string;
  enabled: boolean;
}

const wrap = (html: string, css: string, js: string): string => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;

export function PreviewPane({ html, css, js, enabled }: PreviewPaneProps) {
  const colors = useColors();
  const source = useCallback(
    () => (enabled ? wrap(html, css, js) : ''),
    [enabled, html, css, js],
  );

  if (!enabled) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon} />
        <View style={styles.emptyBody}>
          <View style={styles.emptyTitle}>Preview</View>
          <View style={styles.emptySubtitle}>
            Select an HTML or JavaScript file to preview it here.
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <WebView
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        source={{ html: source() }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: '#00000000',
    overflow: 'hidden',
    backgroundColor: '#00000000',
  },
  webview: { flex: 1, backgroundColor: '#00000000' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: '#00000000',
    padding: spacing.lg,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, textAlign: 'center', maxWidth: 220, color: '#666666' },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(137,80,245,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyBody: { alignItems: 'center' },
});
