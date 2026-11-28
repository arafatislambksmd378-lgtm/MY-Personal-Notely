/**
 * Full-screen Drawing Editor.
 *
 * Opens when the user taps Drawing in the Insert sheet. Provides a dedicated
 * drawing workspace with tools, colors, stroke width, stabilization, shapes
 * and an Insert button that returns the drawing to the note.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { DrawingToolbar } from '@/components/DrawingToolbar';
import { DrawingColorPalette } from '@/components/DrawingColorPalette';
import { DrawingShapePanel } from '@/components/DrawingShapePanel';
import { useDrawingStore } from '@/store/useDrawingStore';
import { useColors } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { saveDocumentContent } from '@/db/repositories/documents';
import { toast } from '@/store/useToastStore';
import { spacing , radii } from '@/design/tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DrawingEditorScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const refreshLibrary = useLibraryStore((state) => state.refresh);

  const { tool, shape, color, fill, strokeWidth, stabilization, paths, shapes, setTool, setShape, setColor, setFill, setStrokeWidth, setStabilization, clearPaths, clearShapes, reset, dataUrl, setDataUrl, addShape } = useDrawingStore();

  const [shapePanelVisible, setShapePanelVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle Android back button
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (paths.length > 0 || shapes.length > 0) {
        Alert.alert(
          'Leave drawing?',
          'Your drawing has unsaved changes. Leave anyway?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', onPress: () => router.back() },
          ],
        );
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [paths.length, shapes.length, router]);

  // Export canvas to data URL when ready
  const exportDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    setDataUrl(dataUrl);
    return dataUrl;
  }, [setDataUrl]);

  const handleInsert = useCallback(async () => {
    if (!noteId) return;
    if (paths.length === 0 && shapes.length === 0) {
      toast.show('Nothing to insert. Draw something first.');
      return;
    }

    const dataUrl = exportDrawing();
    if (!dataUrl) return;

    // Insert the drawing as an image into the note
    try {
      const doc = await saveDocumentContent(noteId, {
        html: `<img src="${dataUrl}" alt="Drawing" style="max-width:100%;height:auto;display:block;margin:1em 0;" />`,
        plainText: '[Drawing]',
        title: '',
      });
      await refreshLibrary();
      toast.success('Drawing inserted');
      router.back();
    } catch (error) {
      toast.error('Failed to insert drawing');
    }
  }, [noteId, exportDrawing, refreshLibrary, router]);

  const handleClear = useCallback(() => {
    if (paths.length === 0 && shapes.length === 0) return;
    clearPaths();
    clearShapes();
    setDataUrl(null);
    toast.success('Canvas cleared');
  }, [paths.length, shapes.length, clearPaths, clearShapes, setDataUrl]);

  const handleUndo = useCallback(() => {
    // Undo last path or shape
    const state = useDrawingStore.getState();
    if (state.shapes.length > 0 || state.paths.length > 0) {
      toast.show('Use Clear to remove all');
    }
  }, []);

  const canvasWidth = SCREEN_WIDTH - 40;
  const canvasHeight = SCREEN_HEIGHT - 260 - insets.bottom - insets.top;

  return (
    <Screen scroll={false} contentStyle={{ backgroundColor: colors.canvas }}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => {
            if (paths.length > 0 || shapes.length > 0) {
              Alert.alert(
                'Leave drawing?',
                'Your drawing has unsaved changes. Leave anyway?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', onPress: () => router.back() },
                ],
              );
            } else {
              router.back();
            }
          }}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="title2" style={styles.title}>
          Drawing
        </AppText>
        <View style={styles.topBarSpacer} />
        <Button
          label="Shape"
          variant="secondary"
          size="sm"
          icon="shapes-outline"
          onPress={() => setShapePanelVisible(true)}
          style={styles.shapeButton}
        />
        <Button
          label="Insert"
          variant="primary"
          size="sm"
          icon="checkmark-outline"
          onPress={handleInsert}
          style={styles.insertButton}
        />
      </View>

      {/* Drawing canvas area */}
      <View style={styles.canvasArea}>
        <DrawingCanvas
          ref={canvasRef}
          onDataUrlChange={setDataUrl}
          addShape={addShape}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      </View>

      {/* Bottom tool bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: spacing.sm + insets.bottom },
        ]}
      >
        <View style={styles.toolsRow}>
          <DrawingToolbar
            onShapeSelect={() => setShapePanelVisible(true)}
            onInsert={handleInsert}
          />
        </View>
        <View style={styles.controlsRow}>
          <AppText variant="caption" tone="muted" style={styles.label}>
            Color
          </AppText>
          <DrawingColorPalette onColorChange={setColor} />
          <AppText variant="caption" tone="muted" style={styles.label}>
            Width
          </AppText>
          <View style={styles.sliderRow}>
            <Ionicons name="remove" size={16} color={colors.textMuted} />
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  {
                    width: ((strokeWidth - 1) / 9) * 100,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Ionicons name="add" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.strokeValue}>
            <AppText variant="caption" tone="secondary">
              {strokeWidth}px
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stroke stabilization"
            onPress={() => setStabilization(!stabilization)}
            style={[
              styles.toggleRow,
              {
                backgroundColor: stabilization ? colors.primarySoft : colors.surface,
                borderColor: stabilization ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name={stabilization ? 'toggle' : 'toggle-outline'}
              size={18}
              color={stabilization ? colors.primary : colors.textSecondary}
            />
            <AppText variant="caption" tone={stabilization ? 'primary' : 'muted'}>
              Stabilization
            </AppText>
          </Pressable>
        </View>
      </View>

      {shapePanelVisible && (
        <DrawingShapePanel
          visible={shapePanelVisible}
          onClose={() => setShapePanelVisible(false)}
          onShapeSelect={(shapeKey) => {
            setShape(shapeKey);
            setTool('shape');
            setShapePanelVisible(false);
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: '#ECEAF1',
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#24232B',
  },
  topBarSpacer: {
    width: 100,
  },
  shapeButton: {
    marginRight: spacing.sm,
  },
  insertButton: {
    marginLeft: spacing.sm,
  },
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#F8F7FB',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: '#ECEAF1',
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  controlsRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontSize: 12,
    color: '#92909D',
    marginBottom: 2,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#ECEAF1',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: 4,
    borderRadius: 2,
  },
  strokeValue: {
    minWidth: 30,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
