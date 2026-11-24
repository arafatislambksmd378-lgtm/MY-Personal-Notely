/**
 * Full-screen Drawing / Sketch editor.
 *
 * Replaces the old in-editor bottom-sheet drawing pad. The canvas is a
 * self-contained vector surface (see `src/features/drawing/drawingScript.ts`);
 * this screen owns only the native chrome around it:
 *
 *   [ × ]            Drawing            [ Insert ] [ Shape ]
 *   ┌───────────────────────────────────────────────┐ ┌──┐
 *   │                                               │ │✋│
 *   │                 canvas                        │ │✏️│
 *   │                                               │ │▮ │
 *   │                                               │ │⌫ │
 *   │                                               │ │↶ │
 *   │                                               │ │↷ │
 *   │                                               │ │🗑│
 *   └───────────────────────────────────────────────┘ └──┘
 *   ● ● ● ● ● ● ● ●
 *   Stroke size ────────●──── 4
 *   Stroke stabilization                     [ ⬤ ]
 *
 * Tapping Insert exports the canvas as a PNG, hands it to the note editor
 * through `useDrawingStore`, and pops back to the note.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors } from '@/store/useSettingsStore';
import { toast } from '@/store/useToastStore';
import { radii, shadows, spacing } from '@/design/tokens';
import { DrawingCanvas, type DrawingCanvasHandle } from '@/features/drawing/DrawingCanvas';
import { ShapeSheet } from '@/features/drawing/ShapeSheet';
import { StrokeSlider } from '@/features/drawing/StrokeSlider';
import { shapeLabel } from '@/features/drawing/shapeCatalog';
import { useDrawingStore } from '@/features/drawing/useDrawingStore';
import {
  DEFAULT_STROKE,
  DRAWING_COLORS,
  type DrawingMessage,
  type DrawingTool,
  type SelectedInfo,
  type ShapeKind,
} from '@/features/drawing/types';

const TOOLS: { tool: DrawingTool; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { tool: 'select', icon: 'hand-left-outline', label: 'Selection tool' },
  { tool: 'pen', icon: 'pencil-outline', label: 'Pen' },
  { tool: 'highlighter', icon: 'color-fill-outline', label: 'Highlighter' },
  { tool: 'eraser', icon: 'bandage-outline', label: 'Eraser' },
];

export default function DrawingScreen() {
  const { noteId, mode } = useLocalSearchParams<{ noteId?: string; mode?: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState(DRAWING_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE);
  const [stabilization, setStabilization] = useState(true);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [ready, setReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [selection, setSelection] = useState<SelectedInfo | null>(null);
  const [armedShape, setArmedShape] = useState<ShapeKind | null>(null);
  const [exporting, setExporting] = useState(false);

  const title = mode === 'sketch' ? 'Sketch' : 'Drawing';

  /* ------------------------------ messages ------------------------------ */

  const handleMessage = useCallback(
    (message: DrawingMessage) => {
      switch (message.type) {
        case 'ready':
          setReady(true);
          break;
        case 'state':
          setTool(message.tool);
          setCanUndo(message.canUndo);
          setCanRedo(message.canRedo);
          setHasContent(message.hasContent);
          setSelection(message.selection);
          setArmedShape(message.armedShape);
          break;
        case 'exported':
          setExporting(false);
          if (message.empty) {
            toast.show('Draw something first — the canvas is empty.');
            return;
          }
          if (!noteId) {
            toast.error('This drawing has no note to go into.');
            return;
          }
          useDrawingStore.getState().publish({
            noteId,
            dataUri: message.dataUri,
            bytes: message.bytes,
            createdAt: Date.now(),
          });
          toast.success('Drawing inserted');
          router.back();
          break;
        case 'error':
          setExporting(false);
          toast.error('The drawing canvas reported a problem.');
          break;
        default:
          break;
      }
    },
    [noteId, router],
  );

  /* ------------------------------- actions ------------------------------ */

  const selectTool = useCallback(
    (next: DrawingTool) => {
      setTool(next);
      setArmedShape(null);
      canvasRef.current?.send({ type: 'set-tool', tool: next });
    },
    [],
  );

  const selectColor = useCallback(
    (next: string) => {
      setColor(next);
      canvasRef.current?.send({ type: 'set-color', color: next });
    },
    [],
  );

  const changeWidth = useCallback(
    (next: number) => {
      setStrokeWidth(next);
      canvasRef.current?.send({ type: 'set-width', width: next });
    },
    [],
  );

  const changeStabilization = useCallback(
    (next: boolean) => {
      setStabilization(next);
      canvasRef.current?.send({ type: 'set-stabilization', enabled: next });
    },
    [],
  );

  const armShape = useCallback((shape: ShapeKind) => {
    setArmedShape(shape);
    setTool('select');
    canvasRef.current?.send({ type: 'arm-shape', shape });
  }, []);

  const insert = useCallback(() => {
    if (!ready) {
      toast.show('The canvas is still loading.');
      return;
    }
    setExporting(true);
    canvasRef.current?.send({ type: 'export' });
  }, [ready]);

  const requestClose = useCallback(() => {
    if (hasContent) {
      setConfirmDiscard(true);
      return;
    }
    router.back();
  }, [hasContent, router]);

  /* ------------------------- hardware back button ----------------------- */

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [requestClose]);

  /* -------------------------------- render ------------------------------ */

  const toolButtons = useMemo(
    () =>
      TOOLS.map((entry) => ({
        ...entry,
        active: tool === entry.tool && !armedShape,
        onPress: () => selectTool(entry.tool),
      })),
    [armedShape, selectTool, tool],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas, paddingTop: insets.top }]}>
      {/* ------------------------------ top bar ---------------------------- */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close drawing editor"
          onPress={requestClose}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' },
          ]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <AppText variant="title3" style={styles.headerTitle} pointerEvents="none">
          {title}
        </AppText>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Insert drawing into the note"
            onPress={insert}
            disabled={exporting}
            accessibilityState={{ disabled: exporting, busy: exporting }}
            testID="drawing-insert"
            style={({ pressed }) => [
              styles.insertButton,
              { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
            ]}
          >
            <Ionicons name="checkmark" size={15} color={colors.scheme === 'dark' ? '#151223' : '#FFFFFF'} />
            <AppText
              variant="label"
              style={{ color: colors.scheme === 'dark' ? '#151223' : '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Insert
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a shape"
            onPress={() => setShapeOpen(true)}
            testID="drawing-shapes"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="shapes-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* --------------------------- canvas + rail ------------------------- */}
      <View style={styles.canvasRow}>
        <View
          style={[
            styles.canvasFrame,
            shadows.card,
            { borderColor: colors.border, backgroundColor: '#FFFFFF' },
          ]}
        >
          <DrawingCanvas ref={canvasRef} onMessage={handleMessage} testID="drawing-canvas" />

          {!hasContent ? (
            <View pointerEvents="none" style={styles.canvasHint}>
              <Ionicons name="brush-outline" size={22} color="#C7C3D6" />
              <AppText variant="caption" style={{ color: '#9C99AC', marginTop: spacing.xs }}>
                Draw with your finger or a stylus
              </AppText>
            </View>
          ) : null}

          {armedShape ? (
            <View
              pointerEvents="none"
              style={[styles.armedChip, { backgroundColor: colors.primarySoft }]}
            >
              <AppText variant="label" style={{ color: colors.primary }}>
                Drag to draw · {shapeLabel(armedShape)}
              </AppText>
            </View>
          ) : null}

          {exporting ? (
            <View pointerEvents="none" style={[styles.armedChip, { backgroundColor: colors.primarySoft }]}>
              <AppText variant="label" style={{ color: colors.primary }}>
                Preparing drawing…
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={[styles.rail, shadows.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {toolButtons.map((entry) => (
            <Pressable
              key={entry.tool}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
              accessibilityState={{ selected: entry.active }}
              onPress={entry.onPress}
              testID={`drawing-tool-${entry.tool}`}
              style={[
                styles.railButton,
                { backgroundColor: entry.active ? colors.primary : 'transparent' },
              ]}
            >
              <Ionicons
                name={entry.icon}
                size={20}
                color={entry.active ? (colors.scheme === 'dark' ? '#151223' : '#FFFFFF') : colors.textSecondary}
              />
            </Pressable>
          ))}

          <View style={[styles.railDivider, { backgroundColor: colors.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            accessibilityState={{ disabled: !canUndo }}
            disabled={!canUndo}
            onPress={() => canvasRef.current?.send({ type: 'undo' })}
            testID="drawing-undo"
            style={[styles.railButton, !canUndo && styles.railButtonDisabled]}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Redo"
            accessibilityState={{ disabled: !canRedo }}
            disabled={!canRedo}
            onPress={() => canvasRef.current?.send({ type: 'redo' })}
            testID="drawing-redo"
            style={[styles.railButton, !canRedo && styles.railButtonDisabled]}
          >
            <Ionicons name="arrow-redo-outline" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear canvas"
            accessibilityState={{ disabled: !hasContent }}
            disabled={!hasContent}
            onPress={() => canvasRef.current?.send({ type: 'clear' })}
            testID="drawing-clear"
            style={[styles.railButton, !hasContent && styles.railButtonDisabled]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      {/* --------------------------- bottom controls ----------------------- */}
      <View style={[styles.controls, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
        {selection ? (
          <View style={[styles.selectionBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <AppText variant="label" tone="secondary" numberOfLines={1} style={styles.selectionLabel}>
              {selection.shape ? shapeLabel(selection.shape) : 'Stroke'}
            </AppText>
            {selection.fillable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selection.filled ? 'Remove fill' : 'Fill shape'}
                accessibilityState={{ selected: selection.filled }}
                onPress={() =>
                  canvasRef.current?.send({ type: 'set-fill', fill: !selection.filled })
                }
                style={[
                  styles.chip,
                  {
                    backgroundColor: selection.filled ? colors.primary : colors.surface,
                    borderColor: selection.filled ? colors.primary : colors.borderStrong,
                  },
                ]}
              >
                <Ionicons
                  name="color-fill-outline"
                  size={14}
                  color={selection.filled ? (colors.scheme === 'dark' ? '#151223' : '#FFFFFF') : colors.textSecondary}
                />
                <AppText
                  variant="label"
                  style={{
                    color: selection.filled ? (colors.scheme === 'dark' ? '#151223' : '#FFFFFF') : colors.textSecondary,
                  }}
                >
                  Fill
                </AppText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete selected object"
              onPress={() => canvasRef.current?.send({ type: 'delete-selected' })}
              style={[styles.chip, { backgroundColor: colors.dangerSoft, borderColor: 'transparent' }]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <AppText variant="label" style={{ color: colors.danger }}>
                Delete
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.palette}
        >
          {DRAWING_COLORS.map((entry) => {
            const active = entry.value === color;
            return (
              <Pressable
                key={entry.value}
                accessibilityRole="button"
                accessibilityLabel={`${entry.name} color`}
                accessibilityState={{ selected: active }}
                onPress={() => selectColor(entry.value)}
                testID={`drawing-color-${entry.name.toLowerCase()}`}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: entry.value,
                    borderColor: active ? colors.primary : colors.border,
                    borderWidth: active ? 2.5 : 1,
                  },
                ]}
              />
            );
          })}
        </ScrollView>

        <StrokeSlider value={strokeWidth} onChange={changeWidth} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="label" tone="secondary">
              Stroke stabilization
            </AppText>
            <AppText variant="label" tone="muted">
              Smooths out shaky finger movement
            </AppText>
          </View>
          <ToggleSwitch
            value={stabilization}
            onChange={changeStabilization}
            accessibilityLabel="Stroke stabilization"
            testID="drawing-stabilization"
          />
        </View>
      </View>

      <ShapeSheet visible={shapeOpen} onClose={() => setShapeOpen(false)} onSelect={armShape} />

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this drawing?"
        message="The canvas has strokes or shapes that have not been inserted into the note. Discarding cannot be undone."
        confirmLabel="Discard"
        onConfirm={() => router.back()}
        onClose={() => setConfirmDiscard(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  insertButton: {
    height: 36,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  canvasRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  canvasFrame: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  canvasHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  armedChip: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rail: {
    width: 52,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  // Buttons share the rail height (flex: 1) and clamp between 34 and 44, so the
  // seven-tool rail fits a short phone as well as a tall one.
  railButton: {
    flex: 1,
    width: 40,
    minHeight: 34,
    maxHeight: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railButtonDisabled: { opacity: 0.35 },
  railDivider: { width: 26, height: StyleSheet.hairlineWidth * 2, marginVertical: spacing.xs },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectionLabel: { flex: 1 },
  chip: {
    height: 30,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  palette: { gap: spacing.sm, paddingVertical: spacing.xs },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
