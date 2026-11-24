/**
 * Shape catalogue for the full-screen drawing editor.
 *
 * Every entry is a real, drawable shape — the same `kind` is what the canvas
 * engine switches on, so nothing here is decorative.
 */
import type { IoniconName } from '@/components/IconTile';
import type { ShapeCategory, ShapeKind } from './types';

export interface ShapeDefinition {
  kind: ShapeKind;
  label: string;
  icon: IoniconName;
  category: ShapeCategory;
}

export const SHAPE_CATEGORIES: { id: ShapeCategory; title: string }[] = [
  { id: 'basic', title: 'Basic shapes' },
  { id: 'lines', title: 'Lines & arrows' },
  { id: 'geometric', title: 'Geometric elements' },
  { id: 'flowchart', title: 'Flowchart' },
];

export const SHAPES: ShapeDefinition[] = [
  /* ------------------------------- basic ------------------------------- */
  { kind: 'rectangle', label: 'Rectangle', icon: 'square-outline', category: 'basic' },
  { kind: 'roundedRectangle', label: 'Rounded rect', icon: 'stop-outline', category: 'basic' },
  { kind: 'square', label: 'Square', icon: 'square', category: 'basic' },
  { kind: 'circle', label: 'Circle', icon: 'radio-button-off', category: 'basic' },
  { kind: 'oval', label: 'Oval', icon: 'ellipse-outline', category: 'basic' },
  { kind: 'triangle', label: 'Triangle', icon: 'triangle-outline', category: 'basic' },
  { kind: 'rightTriangle', label: 'Right triangle', icon: 'triangle', category: 'basic' },
  { kind: 'diamond', label: 'Diamond', icon: 'diamond-outline', category: 'basic' },
  { kind: 'pentagon', label: 'Pentagon', icon: 'shapes-outline', category: 'basic' },
  { kind: 'hexagon', label: 'Hexagon', icon: 'cube-outline', category: 'basic' },
  { kind: 'octagon', label: 'Octagon', icon: 'prism-outline', category: 'basic' },

  /* --------------------------- lines & arrows --------------------------- */
  { kind: 'line', label: 'Straight line', icon: 'remove', category: 'lines' },
  { kind: 'dashedLine', label: 'Dashed line', icon: 'reorder-two-outline', category: 'lines' },
  { kind: 'dottedLine', label: 'Dotted line', icon: 'ellipsis-horizontal', category: 'lines' },
  { kind: 'arrow', label: 'Arrow', icon: 'arrow-forward', category: 'lines' },
  { kind: 'doubleArrow', label: 'Double arrow', icon: 'swap-horizontal-outline', category: 'lines' },
  { kind: 'curvedArrow', label: 'Curved arrow', icon: 'return-up-forward-outline', category: 'lines' },
  { kind: 'connector', label: 'Connector', icon: 'git-network-outline', category: 'lines' },
  { kind: 'horizontalLine', label: 'Horizontal', icon: 'remove', category: 'lines' },
  { kind: 'verticalLine', label: 'Vertical', icon: 'swap-vertical-outline', category: 'lines' },

  /* ------------------------------ geometric ----------------------------- */
  { kind: 'arc', label: 'Arc', icon: 'pulse-outline', category: 'geometric' },
  { kind: 'semicircle', label: 'Semicircle', icon: 'egg-outline', category: 'geometric' },
  { kind: 'trapezoid', label: 'Trapezoid', icon: 'albums-outline', category: 'geometric' },
  { kind: 'parallelogram', label: 'Parallelogram', icon: 'prism-outline', category: 'geometric' },
  { kind: 'star', label: 'Star', icon: 'star-outline', category: 'geometric' },
  { kind: 'cross', label: 'Cross', icon: 'close', category: 'geometric' },
  { kind: 'plus', label: 'Plus', icon: 'add', category: 'geometric' },
  { kind: 'minus', label: 'Minus', icon: 'remove', category: 'geometric' },
  { kind: 'bracket', label: 'Bracket', icon: 'code-outline', category: 'geometric' },
  { kind: 'brace', label: 'Brace', icon: 'git-compare-outline', category: 'geometric' },

  /* ------------------------------ flowchart ----------------------------- */
  { kind: 'process', label: 'Process', icon: 'square-outline', category: 'flowchart' },
  { kind: 'decision', label: 'Decision', icon: 'diamond-outline', category: 'flowchart' },
  { kind: 'inputOutput', label: 'Input / output', icon: 'prism-outline', category: 'flowchart' },
  { kind: 'startEnd', label: 'Start / end', icon: 'ellipse-outline', category: 'flowchart' },
  { kind: 'document', label: 'Document', icon: 'document-text-outline', category: 'flowchart' },
  { kind: 'database', label: 'Database', icon: 'server-outline', category: 'flowchart' },
  { kind: 'connectorNode', label: 'Connector', icon: 'git-network-outline', category: 'flowchart' },
];

export function shapeLabel(kind: ShapeKind): string {
  return SHAPES.find((shape) => shape.kind === kind)?.label ?? kind;
}
