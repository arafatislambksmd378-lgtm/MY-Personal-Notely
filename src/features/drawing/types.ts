/**
 * Drawing-editor protocol and shape catalogue.
 *
 * The canvas runs as a self-contained HTML document (inside a WebView on
 * Android, an iframe on web) and talks to the React Native host through the
 * JSON messages declared here — the same pattern the rich-text editor uses.
 */

export type DrawingTool = 'select' | 'pen' | 'highlighter' | 'eraser';

export type ShapeKind =
  // Basic
  | 'rectangle'
  | 'roundedRectangle'
  | 'square'
  | 'circle'
  | 'oval'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  // Lines and arrows
  | 'line'
  | 'dashedLine'
  | 'dottedLine'
  | 'arrow'
  | 'doubleArrow'
  | 'curvedArrow'
  | 'connector'
  | 'horizontalLine'
  | 'verticalLine'
  // Geometric elements
  | 'arc'
  | 'semicircle'
  | 'trapezoid'
  | 'parallelogram'
  | 'star'
  | 'cross'
  | 'plus'
  | 'minus'
  | 'bracket'
  | 'brace'
  // Flowchart
  | 'process'
  | 'decision'
  | 'inputOutput'
  | 'startEnd'
  | 'document'
  | 'database'
  | 'connectorNode';

export type ShapeCategory = 'basic' | 'lines' | 'geometric' | 'flowchart';

/** Colours offered by the horizontal palette. */
export const DRAWING_COLORS: { name: string; value: string }[] = [
  { name: 'Black', value: '#151223' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Green', value: '#059669' },
  { name: 'Yellow', value: '#F5A524' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
];

/** Stroke-width slider range, in on-screen points. */
export const MIN_STROKE = 1;
export const MAX_STROKE = 24;
export const DEFAULT_STROKE = 4;

export interface SelectedInfo {
  id: string;
  kind: 'stroke' | 'shape';
  shape: ShapeKind | null;
  /** Only closed shapes can take a fill. */
  fillable: boolean;
  filled: boolean;
}

/** canvas → host */
export type DrawingMessage =
  | { type: 'ready' }
  | {
      type: 'state';
      tool: DrawingTool;
      canUndo: boolean;
      canRedo: boolean;
      hasContent: boolean;
      selection: SelectedInfo | null;
      armedShape: ShapeKind | null;
    }
  | { type: 'exported'; dataUri: string; empty: boolean; bytes: number }
  | { type: 'error'; message: string };

/** host → canvas */
export type DrawingHostMessage =
  | { type: 'set-tool'; tool: DrawingTool }
  | { type: 'set-color'; color: string }
  | { type: 'set-width'; width: number }
  | { type: 'set-stabilization'; enabled: boolean }
  | { type: 'arm-shape'; shape: ShapeKind }
  | { type: 'disarm-shape' }
  | { type: 'set-fill'; fill: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'delete-selected' }
  | { type: 'export' };
