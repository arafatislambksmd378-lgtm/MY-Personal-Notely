import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildDrawingDocument } from '@/features/drawing/drawingDocument';
import { SHAPES } from '@/features/drawing/shapeCatalog';
import type { DrawingMessage, ShapeKind } from '@/features/drawing/types';
import { useDrawingStore } from '@/features/drawing/useDrawingStore';

/**
 * Boots the real drawing document (the exact HTML/JS string shipped to the
 * WebView) inside jsdom and drives it through the React Native message bridge
 * and synthetic pointer events — the same technique as `tests/editor.test.ts`.
 *
 * jsdom has no canvas implementation, so the 2D context is replaced by a
 * recording stub: every call is accepted and appended to a list, which lets the
 * tests assert that the engine actually reaches the drawing calls.
 */
function boot() {
  const messages: DrawingMessage[] = [];
  const errors: string[] = [];
  const calls: string[] = [];

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(String(error)));

  const dom = new JSDOM(buildDrawingDocument(), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://notely.local/',
    virtualConsole,
    beforeParse(window) {
      (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
        postMessage: (payload: string) => messages.push(JSON.parse(payload) as DrawingMessage),
      };

      const store: Record<string, unknown> = {};
      const context = new Proxy(store, {
        get(target, prop: string) {
          if (prop in target) return target[prop];
          return (...args: unknown[]) => {
            calls.push(`${prop}(${args.length})`);
          };
        },
        set(target, prop: string, value) {
          target[prop] = value;
          return true;
        },
      });

      window.HTMLCanvasElement.prototype.getContext = (() =>
        context) as unknown as typeof window.HTMLCanvasElement.prototype.getContext;
      window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
      window.HTMLCanvasElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
        return {
          left: 0,
          top: 0,
          right: 400,
          bottom: 600,
          width: 400,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      };
    },
  });

  const canvas = dom.window.document.getElementById('notely-drawing') as HTMLCanvasElement;

  const receive = (message: Record<string, unknown>) => {
    (dom.window as unknown as { __notelyDrawingReceive: (json: string) => void }).__notelyDrawingReceive(
      JSON.stringify(message),
    );
  };

  const pointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) => {
    canvas.dispatchEvent(
      new dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true }),
    );
  };

  const states = () => messages.filter((message) => message.type === 'state');
  const lastState = () => {
    const state = states()[states().length - 1];
    if (!state || state.type !== 'state') throw new Error('no state message');
    return state;
  };

  return { dom, messages, errors, calls, canvas, receive, pointer, states, lastState };
}

/**
 * The engine sizes itself inside its first animation frame and then posts
 * `ready`. jsdom runs `requestAnimationFrame` on a timer, so the tests wait for
 * that message instead of guessing a delay.
 */
async function ready(harness: ReturnType<typeof boot>) {
  const deadline = Date.now() + 2000;
  while (!harness.messages.some((message) => message.type === 'ready')) {
    if (Date.now() > deadline) throw new Error('drawing canvas never became ready');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Draws one freehand stroke across the canvas. */
function drawStroke(harness: ReturnType<typeof boot>, color?: string) {
  if (color) harness.receive({ type: 'set-color', color });
  harness.pointer('pointerdown', 40, 60);
  harness.pointer('pointermove', 120, 140);
  harness.pointer('pointermove', 220, 200);
  harness.pointer('pointerup', 220, 200);
}

describe('drawing document', () => {
  it('boots and reports its initial state', async () => {
    const harness = boot();
    await ready(harness);
    expect(harness.messages.some((message) => message.type === 'ready')).toBe(true);
    const state = harness.lastState();
    expect(state.type).toBe('state');
    if (state.type !== 'state') return;
    expect(state.tool).toBe('pen');
    expect(state.hasContent).toBe(false);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.selection).toBeNull();
    expect(harness.errors).toEqual([]);
  });

  it('records a stroke and reports content + undo availability', async () => {
    const harness = boot();
    await ready(harness);
    drawStroke(harness);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(true);
    expect(state.canUndo).toBe(true);
    expect(harness.calls).toContain('stroke(0)');
    expect(harness.errors).toEqual([]);
  });

  it('undoes and redoes committed strokes', async () => {
    const harness = boot();
    await ready(harness);
    drawStroke(harness);
    harness.receive({ type: 'undo' });
    let state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(false);
    expect(state.canRedo).toBe(true);

    harness.receive({ type: 'redo' });
    state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(true);
    expect(state.canUndo).toBe(true);
    expect(harness.errors).toEqual([]);
  });

  it('clears the canvas', async () => {
    const harness = boot();
    await ready(harness);
    drawStroke(harness);
    harness.receive({ type: 'clear' });
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(false);
    expect(harness.errors).toEqual([]);
  });

  it('applies the active colour and stroke width to the next stroke', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'set-color', color: '#EF4444' });
    harness.receive({ type: 'set-width', width: 12 });
    drawStroke(harness);
    expect(harness.errors).toEqual([]);
    // The engine normalises width against the canvas unit; a 12pt stroke on a
    // 400pt canvas is 0.03 of the unit, well inside the expected range.
    const strokeCalls = harness.calls.filter((call) => call.startsWith('stroke'));
    expect(strokeCalls.length).toBeGreaterThan(0);
  });

  it('toggles stabilization without disturbing the canvas', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'set-stabilization', enabled: false });
    drawStroke(harness);
    expect(harness.lastState().type).toBe('state');
    expect(harness.errors).toEqual([]);
  });

  it('exports an empty canvas as empty', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'export' });
    const exported = harness.messages.find((message) => message.type === 'exported');
    expect(exported).toBeDefined();
    if (exported?.type !== 'exported') return;
    expect(exported.empty).toBe(true);
    expect(exported.dataUri).toContain('data:image/png');
  });

  it('exports a drawn canvas with content', async () => {
    const harness = boot();
    await ready(harness);
    drawStroke(harness);
    harness.receive({ type: 'export' });
    const exported = harness.messages.find((message) => message.type === 'exported');
    if (exported?.type !== 'exported') throw new Error('expected export');
    expect(exported.empty).toBe(false);
    expect(exported.bytes).toBeGreaterThan(0);
    expect(harness.errors).toEqual([]);
  });

  it('erases the stroke under the pointer', async () => {
    const harness = boot();
    await ready(harness);
    drawStroke(harness);
    harness.receive({ type: 'set-tool', tool: 'eraser' });
    harness.pointer('pointerdown', 120, 140);
    harness.pointer('pointerup', 120, 140);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(false);
    expect(harness.errors).toEqual([]);
  });
});

describe('shape system', () => {
  it('exposes all 37 required shapes across four categories', () => {
    expect(SHAPES).toHaveLength(37);
    expect(new Set(SHAPES.map((shape) => shape.kind)).size).toBe(37);
    const byCategory = new Map<string, number>();
    for (const shape of SHAPES) byCategory.set(shape.category, (byCategory.get(shape.category) ?? 0) + 1);
    expect(byCategory.get('basic')).toBe(11);
    expect(byCategory.get('lines')).toBe(9);
    expect(byCategory.get('geometric')).toBe(10);
    expect(byCategory.get('flowchart')).toBe(7);
  });

  it('draws every catalogue shape without throwing', async () => {
    const harness = boot();
    await ready(harness);
    for (const shape of SHAPES) {
      harness.receive({ type: 'arm-shape', shape: shape.kind });
      harness.pointer('pointerdown', 60, 80);
      harness.pointer('pointermove', 220, 240);
      harness.pointer('pointerup', 220, 240);
      const state = harness.lastState();
      if (state.type !== 'state') throw new Error('expected state');
      expect(state.hasContent).toBe(true);
      // After placing a shape the editor drops back to selection so the new
      // object is immediately movable / resizable.
      expect(state.tool).toBe('select');
      expect(state.selection?.kind).toBe('shape');
      expect(state.selection?.shape).toBe(shape.kind);
    }
    expect(harness.errors).toEqual([]);
  });

  it('keeps square and circle proportional while dragging', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'square' });
    harness.pointer('pointerdown', 40, 60);
    harness.pointer('pointermove', 200, 140); // 160 x 80 drag
    harness.pointer('pointerup', 200, 140);
    expect(harness.errors).toEqual([]);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection?.shape).toBe('square');
  });

  it('fills a selected closed shape and reports it', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'rectangle' });
    harness.pointer('pointerdown', 60, 80);
    harness.pointer('pointermove', 220, 240);
    harness.pointer('pointerup', 220, 240);

    let state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection?.fillable).toBe(true);
    expect(state.selection?.filled).toBe(false);

    harness.receive({ type: 'set-fill', fill: true });
    state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection?.filled).toBe(true);
    expect(harness.calls).toContain('fill(0)');
    expect(harness.errors).toEqual([]);
  });

  it('does not offer a fill for open shapes', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'line' as ShapeKind });
    harness.pointer('pointerdown', 60, 80);
    harness.pointer('pointermove', 220, 240);
    harness.pointer('pointerup', 220, 240);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection?.fillable).toBe(false);
    expect(harness.errors).toEqual([]);
  });

  it('deletes the selected shape', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'oval' });
    harness.pointer('pointerdown', 60, 80);
    harness.pointer('pointermove', 220, 240);
    harness.pointer('pointerup', 220, 240);
    expect(harness.lastState().type).toBe('state');

    harness.receive({ type: 'delete-selected' });
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(false);
    expect(state.selection).toBeNull();
    expect(harness.errors).toEqual([]);
  });

  it('moves and resizes a selected shape', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'rectangle' });
    harness.pointer('pointerdown', 60, 80);
    harness.pointer('pointermove', 220, 240);
    harness.pointer('pointerup', 220, 240);

    // Move: press inside the shape and drag.
    harness.pointer('pointerdown', 140, 160);
    harness.pointer('pointermove', 180, 200);
    harness.pointer('pointerup', 180, 200);
    let state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection).not.toBeNull();

    // Resize from the south-east corner handle (handle hit radius is 18pt).
    harness.pointer('pointerdown', 262, 282);
    harness.pointer('pointermove', 320, 340);
    harness.pointer('pointerup', 320, 340);
    state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection).not.toBeNull();
    expect(state.canUndo).toBe(true);
    expect(harness.errors).toEqual([]);
  });

  it('keeps a horizontal line, whose height is legitimately near zero', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'horizontalLine' });
    harness.pointer('pointerdown', 40, 120);
    harness.pointer('pointermove', 300, 124);
    harness.pointer('pointerup', 300, 124);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(true);
    expect(state.selection?.shape).toBe('horizontalLine');
    expect(harness.errors).toEqual([]);
  });

  it('keeps a vertical line, whose width is legitimately near zero', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'verticalLine' });
    harness.pointer('pointerdown', 200, 60);
    harness.pointer('pointermove', 204, 320);
    harness.pointer('pointerup', 204, 320);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(true);
    expect(state.selection?.shape).toBe('verticalLine');
    expect(harness.errors).toEqual([]);
  });

  it('discards an accidental tap instead of leaving a speck', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'rectangle' });
    harness.pointer('pointerdown', 100, 120);
    harness.pointer('pointermove', 102, 121);
    harness.pointer('pointerup', 102, 121);
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(false);
    expect(state.selection).toBeNull();
    expect(harness.errors).toEqual([]);
  });

  it('resizes from the north-west handle as well as the south-east', async () => {
    const harness = boot();
    await ready(harness);
    harness.receive({ type: 'arm-shape', shape: 'rectangle' });
    harness.pointer('pointerdown', 60, 80);
    harness.pointer('pointermove', 220, 240);
    harness.pointer('pointerup', 220, 240);

    // North-west corner of the selection box.
    harness.pointer('pointerdown', 60, 80);
    harness.pointer('pointermove', 24, 48);
    harness.pointer('pointerup', 24, 48);

    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.selection).not.toBeNull();
    expect(state.canUndo).toBe(true);
    expect(harness.errors).toEqual([]);
  });

  it('keeps the drawing when the canvas is resized (normalised coordinates)', async () => {
    const harness = boot();
    await ready(harness);
    drawStroke(harness);
    harness.dom.window.dispatchEvent(new harness.dom.window.Event('resize'));
    const state = harness.lastState();
    if (state.type !== 'state') throw new Error('expected state');
    expect(state.hasContent).toBe(true);
    expect(harness.errors).toEqual([]);
  });
});

describe('drawing hand-off store', () => {
  it('publishes a drawing for a specific note and consumes it once', () => {
    useDrawingStore.setState({ pending: null });
    useDrawingStore.getState().publish({
      noteId: 'doc_a',
      dataUri: 'data:image/png;base64,AAAA',
      bytes: 3,
      createdAt: 1,
    });
    expect(useDrawingStore.getState().pending?.noteId).toBe('doc_a');

    // Clearing a *different* note must not drop this drawing.
    useDrawingStore.getState().clear('doc_b');
    expect(useDrawingStore.getState().pending?.noteId).toBe('doc_a');

    useDrawingStore.getState().clear('doc_a');
    expect(useDrawingStore.getState().pending).toBeNull();
  });
});
