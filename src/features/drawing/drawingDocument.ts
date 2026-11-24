/**
 * Assembles the self-contained HTML document that hosts the drawing canvas.
 * Shared by the Android WebView and the web iframe so both render identically.
 */
import { DRAWING_SCRIPT } from './drawingScript';

const DRAWING_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #FFFFFF;
  }
  body {
    touch-action: none;
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  #notely-drawing {
    display: block;
    width: 100%;
    height: 100%;
    background: #FFFFFF;
    touch-action: none;
    cursor: crosshair;
  }
`;

export function buildDrawingDocument(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>${DRAWING_CSS}</style>
</head>
<body>
  <canvas id="notely-drawing"></canvas>
  <script>${DRAWING_SCRIPT}</script>
</body>
</html>`;
}
