/**
 * Drawing editor state management.
 *
 * Holds the active tool, color, stroke width, stabilization, paths and shapes
 * for the full-screen drawing editor. Kept separate from the note editor so
 * the drawing surface can be opened, used and closed without disturbing note
 * state.
 */
import { create } from 'zustand';

export type DrawingTool =
  | 'select'
  | 'brush'
  | 'highlighter'
  | 'eraser'
  | 'shape';

export type DrawingShape =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'square'
  | 'circle'
  | 'oval'
  | 'triangle'
  | 'right-triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'line'
  | 'dashed-line'
  | 'dotted-line'
  | 'arrow'
  | 'double-arrow'
  | 'curved-arrow'
  | 'connector-line'
  | 'horizontal-line'
  | 'vertical-line'
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
  | 'process'
  | 'decision'
  | 'input-output'
  | 'start-end'
  | 'document'
  | 'database'
  | 'flow-connector';

export interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'brush' | 'highlighter' | 'eraser';
}

export interface DrawingShapeObject {
  id: string;
  kind: DrawingShape;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fill: string;
  strokeWidth: number;
}

interface DrawingState {
  // Active tool
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;

  // Active shape (when tool === 'shape')
  shape: DrawingShape | null;
  setShape: (shape: DrawingShape | null) => void;

  // Color
  color: string;
  setColor: (color: string) => void;

  // Fill color (for shapes)
  fill: string;
  setFill: (fill: string) => void;

  // Stroke width
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;

  // Stabilization
  stabilization: boolean;
  setStabilization: (enabled: boolean) => void;

  // Paths
  paths: DrawingPath[];
  addPath: (path: DrawingPath) => void;
  clearPaths: () => void;
  undo: () => void;
  redo: () => void;

  // Shapes
  shapes: DrawingShapeObject[];
  addShape: (shape: DrawingShapeObject) => void;
  removeShape: (id: string) => void;
  clearShapes: () => void;

  // Canvas data URL (for insertion into note)
  dataUrl: string | null;
  setDataUrl: (url: string | null) => void;

  // Reset everything
  reset: () => void;
}

const DEFAULT_COLOR = '#24232B';
const DEFAULT_FILL = '#FFFFFF';

export const useDrawingStore = create<DrawingState>((set, get) => ({
  tool: 'brush',
  setTool: (tool) => set({ tool }),

  shape: null,
  setShape: (shape) => set({ shape }),

  color: DEFAULT_COLOR,
  setColor: (color) => set({ color }),

  fill: DEFAULT_FILL,
  setFill: (fill) => set({ fill }),

  strokeWidth: 3,
  setStrokeWidth: (width) => set({ strokeWidth: width }),

  stabilization: false,
  setStabilization: (enabled) => set({ stabilization: enabled }),

  paths: [],
  addPath: (path) =>
    set((state) => ({ paths: [...state.paths, path] })),
  clearPaths: () => set({ paths: [] }),
  undo: () => {
    const state = get();
    if (state.paths.length === 0 && state.shapes.length === 0) return;
    const lastPathIndex = state.paths.length - 1;
    const lastShapeIndex = state.shapes.length - 1;
    if (lastShapeIndex > lastPathIndex) {
      set((s) => ({ shapes: s.shapes.slice(0, -1) }));
    } else if (lastPathIndex >= 0) {
      set((s) => ({ paths: s.paths.slice(0, -1) }));
    }
  },
  redo: () => {
    // Redo not yet implemented; kept for API compatibility
  },

  shapes: [],
  addShape: (shape) =>
    set((state) => ({ shapes: [...state.shapes, shape] })),
  removeShape: (id) =>
    set((state) => ({ shapes: state.shapes.filter((s) => s.id !== id) })),
  clearShapes: () => set({ shapes: [] }),

  dataUrl: null,
  setDataUrl: (url) => set({ dataUrl: url }),

  reset: () =>
    set({
      tool: 'brush',
      shape: null,
      color: DEFAULT_COLOR,
      fill: DEFAULT_FILL,
      strokeWidth: 3,
      stabilization: false,
      paths: [],
      shapes: [],
      dataUrl: null,
    }),
}));
