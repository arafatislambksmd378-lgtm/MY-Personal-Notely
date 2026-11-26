/**
 * Full-screen drawing canvas.
 *
 * Handles touch/stylus input, smooth stroke rendering, color, width and
 * stabilization. Paths are stored in the drawing store and re-rendered on
 * every frame so the canvas stays in sync with undo/redo.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  type RefObject,
} from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useDrawingStore } from '@/store/useDrawingStore';
import { type DrawingPath, type DrawingShapeObject } from '@/store/useDrawingStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DrawingCanvasProps {
  onDataUrlChange: (dataUrl: string | null) => void;
  addShape?: (shape: DrawingShapeObject) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

export const DrawingCanvas = forwardRef<HTMLCanvasElement, DrawingCanvasProps>(
  function DrawingCanvas({
    onDataUrlChange,
    addShape,
    canvasWidth = SCREEN_WIDTH - 40,
    canvasHeight = SCREEN_HEIGHT - 280,
  }, ref) {
  const {
    tool,
    shape: selectedShape,
    color,
    fill,
    strokeWidth,
    stabilization,
    paths,
    shapes,
    addPath,
    addShape: storeAddShape,
  } = useDrawingStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const stabilizationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Render all paths + shapes to canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear to white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw all paths
    for (const path of paths) {
      if (path.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'eraser' ? '#FFFFFF' : path.color;
      ctx.lineWidth = path.width;
      ctx.globalAlpha =
        path.tool === 'highlighter' ? 0.35 : 1;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i += 1) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw all shapes
    for (const shape of shapes) {
      ctx.beginPath();
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.fillStyle = shape.fill;
      const { x, y, width, height } = shape;

      switch (shape.kind) {
        case 'rectangle':
        case 'square':
          ctx.rect(x, y, width, height);
          break;
        case 'rounded-rectangle': {
          const r = Math.min(width, height) * 0.12;
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + width - r, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + r);
          ctx.lineTo(x + width, y + height - r);
          ctx.quadraticCurveTo(
            x + width,
            y + height,
            x + width - r,
            y + height,
          );
          ctx.lineTo(x + r, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          break;
        }
        case 'circle':
        case 'oval': {
          const rx = width / 2;
          const ry = height / 2;
          const cx = x + rx;
          const cy = y + ry;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          break;
        }
        case 'triangle': {
          ctx.moveTo(x + width / 2, y);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x, y + height);
          ctx.closePath();
          break;
        }
        case 'right-triangle': {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x, y + height);
          ctx.closePath();
          break;
        }
        case 'diamond': {
          ctx.moveTo(x + width / 2, y);
          ctx.lineTo(x + width, y + height / 2);
          ctx.lineTo(x + width / 2, y + height);
          ctx.lineTo(x, y + height / 2);
          ctx.closePath();
          break;
        }
        case 'pentagon': {
          const cx = x + width / 2;
          const cy = y + height / 2;
          const r = Math.min(width, height) / 2;
          for (let i = 0; i < 5; i += 1) {
            const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / 5;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        }
        case 'hexagon': {
          const cx = x + width / 2;
          const cy = y + height / 2;
          const r = Math.min(width, height) / 2;
          for (let i = 0; i < 6; i += 1) {
            const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / 6;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        }
        case 'octagon': {
          const cx = x + width / 2;
          const cy = y + height / 2;
          const r = Math.min(width, height) / 2;
          for (let i = 0; i < 8; i += 1) {
            const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / 8;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        }
        case 'line': {
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + width, y + height / 2);
          break;
        }
        case 'dashed-line': {
          ctx.moveTo(x, y + height / 2);
          const dash = 8;
          const gap = 6;
          let cx = x;
          while (cx < x + width) {
            ctx.lineTo(Math.min(cx + dash, x + width), y + height / 2);
            cx += dash + gap;
            if (cx < x + width) ctx.moveTo(cx, y + height / 2);
          }
          break;
        }
        case 'dotted-line': {
          ctx.moveTo(x, y + height / 2);
          const dot = 4;
          const gap = 6;
          let cx = x;
          while (cx < x + width) {
            ctx.moveTo(cx, y + height / 2);
            ctx.lineTo(cx + dot, y + height / 2);
            cx += dot + gap;
          }
          break;
        }
        case 'arrow': {
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + width - 12, y + height / 2);
          ctx.lineTo(x + width, y + height / 2 - 6);
          ctx.moveTo(x + width - 12, y + height / 2);
          ctx.lineTo(x + width, y + height / 2 + 6);
          break;
        }
        case 'double-arrow': {
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + width, y + height / 2);
          ctx.lineTo(x + width - 12, y + height / 2 - 6);
          ctx.moveTo(x + width, y + height / 2);
          ctx.lineTo(x + width - 12, y + height / 2 + 6);
          ctx.lineTo(x + 12, y + height / 2 - 6);
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + 12, y + height / 2 + 6);
          break;
        }
        case 'curved-arrow': {
          ctx.beginPath();
          ctx.moveTo(x, y + height / 2);
          ctx.quadraticCurveTo(x + width / 2, y, x + width, y + height / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + width, y + height / 2);
          ctx.lineTo(x + width - 10, y + height / 2 - 6);
          ctx.moveTo(x + width, y + height / 2);
          ctx.lineTo(x + width - 10, y + height / 2 + 6);
          break;
        }
        case 'connector-line': {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width, y + height);
          break;
        }
        case 'horizontal-line': {
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + width, y + height / 2);
          break;
        }
        case 'vertical-line': {
          ctx.moveTo(x + width / 2, y);
          ctx.lineTo(x + width / 2, y + height);
          break;
        }
        case 'arc': {
          ctx.beginPath();
          ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI);
          break;
        }
        case 'semicircle': {
          ctx.beginPath();
          ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI);
          ctx.lineTo(x + width / 2, y + height / 2);
          ctx.closePath();
          break;
        }
        case 'trapezoid': {
          ctx.moveTo(x + width * 0.25, y);
          ctx.lineTo(x + width * 0.75, y);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x, y + height);
          ctx.closePath();
          break;
        }
        case 'parallelogram': {
          ctx.moveTo(x + width * 0.2, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x + width * 0.8, y + height);
          ctx.lineTo(x, y + height);
          ctx.closePath();
          break;
        }
        case 'star': {
          const cx = x + width / 2;
          const cy = y + height / 2;
          const outerR = Math.min(width, height) / 2;
          const innerR = outerR * 0.4;
          for (let i = 0; i < 10; i += 1) {
            const angle = (-Math.PI / 2) + (i * Math.PI) / 5;
            const r = i % 2 === 0 ? outerR : innerR;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        }
        case 'cross': {
          ctx.moveTo(x + width * 0.3, y);
          ctx.lineTo(x + width * 0.3, y + height * 0.3);
          ctx.lineTo(x, y + height * 0.3);
          ctx.lineTo(x, y + height * 0.7);
          ctx.lineTo(x + width * 0.3, y + height * 0.7);
          ctx.lineTo(x + width * 0.3, y + height);
          ctx.lineTo(x + width * 0.7, y + height);
          ctx.lineTo(x + width * 0.7, y + height * 0.7);
          ctx.lineTo(x + width, y + height * 0.7);
          ctx.lineTo(x + width, y + height * 0.3);
          ctx.lineTo(x + width * 0.7, y + height * 0.3);
          ctx.lineTo(x + width * 0.7, y);
          ctx.closePath();
          break;
        }
        case 'plus': {
          ctx.moveTo(x + width * 0.4, y);
          ctx.lineTo(x + width * 0.4, y + height * 0.4);
          ctx.lineTo(x, y + height * 0.4);
          ctx.lineTo(x, y + height * 0.6);
          ctx.lineTo(x + width * 0.4, y + height * 0.6);
          ctx.lineTo(x + width * 0.4, y + height);
          ctx.lineTo(x + width * 0.6, y + height);
          ctx.lineTo(x + width * 0.6, y + height * 0.6);
          ctx.lineTo(x + width, y + height * 0.6);
          ctx.lineTo(x + width, y + height * 0.4);
          ctx.lineTo(x + width * 0.6, y + height * 0.4);
          ctx.lineTo(x + width * 0.6, y);
          ctx.closePath();
          break;
        }
        case 'minus': {
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + width, y + height / 2);
          break;
        }
        case 'bracket': {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width * 0.3, y);
          ctx.moveTo(x, y + height);
          ctx.lineTo(x + width * 0.3, y + height);
          ctx.lineTo(x + width * 0.3, y + height / 2);
          break;
        }
        case 'brace': {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x, y + height / 4, x + width * 0.2, y + height / 4);
          ctx.moveTo(x, y + height * 0.75);
          ctx.quadraticCurveTo(x, y + height * 0.75, x + width * 0.2, y + height * 0.75);
          ctx.moveTo(x + width * 0.2, y + height / 2);
          ctx.lineTo(x + width * 0.4, y + height / 2);
          break;
        }
        case 'process': {
          ctx.rect(x, y, width, height);
          break;
        }
        case 'decision': {
          const cx = x + width / 2;
          const cy = y + height / 2;
          ctx.moveTo(cx, y);
          ctx.lineTo(x + width, cy);
          ctx.lineTo(cx, y + height);
          ctx.lineTo(x, cy);
          ctx.closePath();
          break;
        }
        case 'input-output': {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width * 0.8, y);
          ctx.lineTo(x + width * 0.6, y + height);
          ctx.lineTo(x * 0.2, y + height);
          ctx.closePath();
          break;
        }
        case 'start-end': {
          const r = Math.min(width, height) / 2;
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + width - r, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + r);
          ctx.lineTo(x + width, y + height - r);
          ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
          ctx.lineTo(x + r, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          break;
        }
        case 'document': {
          const fold = Math.min(width, height) * 0.2;
          ctx.moveTo(x + fold, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x, y + height);
          ctx.lineTo(x, y + fold);
          ctx.lineTo(x + fold, y + fold);
          break;
        }
        case 'database': {
          ctx.moveTo(x, y + height / 2);
          ctx.ellipse(x + width / 2, y, width / 2, height / 6, 0, 0, Math.PI);
          ctx.moveTo(x, y + height / 2);
          ctx.ellipse(x + width / 2, y + height, width / 2, height / 6, 0, 0, Math.PI);
          ctx.lineTo(x + width, y + height / 2);
          break;
        }
        case 'flow-connector': {
          ctx.moveTo(x, y + height / 2);
          ctx.lineTo(x + width / 3, y + height / 2);
          ctx.lineTo(x + width / 3, y + height);
          ctx.lineTo(x + width * 0.66, y + height);
          ctx.lineTo(x + width * 0.66, y);
          ctx.lineTo(x + width, y);
          break;
        }
      }

      if (shape.fill !== 'transparent') {
        ctx.fill();
      }
      ctx.stroke();
    }
  }, [paths, shapes]);

  // Re-render when paths/shapes change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Export data URL
  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }, []);

  // Touch handlers
  const getPoint = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const e = event as unknown as { clientX?: number; clientY?: number; touches?: TouchList };
      const touch = e.touches?.[0];
      const clientX = touch?.clientX ?? e.clientX ?? 0;
      const clientY = touch?.clientY ?? e.clientY ?? 0;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [],
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      const point = getPoint(event);
      if (!point) return;

      isDrawingRef.current = true;
      lastPointRef.current = point;
      pointsRef.current = [point];

      if (tool === 'brush' || tool === 'highlighter' || tool === 'eraser') {
        // Start a new path
      }
    },
    [tool, getPoint],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      event.preventDefault();
      const point = getPoint(event);
      if (!point) return;

      if (stabilization && lastPointRef.current) {
        // Stabilization: smooth by delaying point capture
        if (stabilizationTimerRef.current) {
          clearTimeout(stabilizationTimerRef.current);
        }
        stabilizationTimerRef.current = setTimeout(() => {
          pointsRef.current.push(point);
          lastPointRef.current = point;
          renderCanvas();
        }, 16);
      } else {
        pointsRef.current.push(point);
        lastPointRef.current = point;
        renderCanvas();
      }
    },
    [stabilization, getPoint, renderCanvas],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      if (stabilizationTimerRef.current) {
        clearTimeout(stabilizationTimerRef.current);
        stabilizationTimerRef.current = null;
      }

      // Shape placement: add selected shape at tap location
      if (tool === 'shape' && selectedShape) {
        const point = getPoint(event);
        if (point) {
          const shape: DrawingShapeObject = {
            id: `shape-${Date.now()}`,
            kind: selectedShape,
            x: point.x - 40,
            y: point.y - 40,
            width: 80,
            height: 60,
            color,
            fill,
            strokeWidth,
          };
          (addShape ?? storeAddShape)(shape);
          renderCanvas();
        }
        onDataUrlChange(exportCanvas());
        return;
      }

      const currentPoints = pointsRef.current;
      if (
        currentPoints.length > 0 &&
        (tool === 'brush' || tool === 'highlighter' || tool === 'eraser')
      ) {
        addPath({
          id: `path-${Date.now()}`,
          points: currentPoints,
          color: tool === 'eraser' ? '#FFFFFF' : color,
          width: strokeWidth,
          tool: tool === 'eraser' ? 'eraser' : tool,
        });
        pointsRef.current = [];
        renderCanvas();
      }

      onDataUrlChange(exportCanvas());
    },
    [
      tool,
      selectedShape,
      color,
      fill,
      strokeWidth,
      addPath,
      addShape,
      storeAddShape,
      onDataUrlChange,
      renderCanvas,
      getPoint,
      exportCanvas,
    ],
  );

  // Attach ref to canvas element
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(canvasRef.current);
      } else {
        ref.current = canvasRef.current;
      }
    }
  }, [canvasRef.current, ref]);

  return (
    <View style={styles.wrapper}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
      />
    </View>
  );
})

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  canvas: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEAF1',
    marginVertical: 8,
  },
});
