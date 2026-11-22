/**
 * Assembles the HTML document that hosts the rich-text editing surface.
 * Shared by the Android WebView and the web iframe so both render identically.
 */
import { EDITOR_CSS } from './shellCss';
import { EDITOR_SCRIPT } from './shellScript';
import { defaultPageSetup, type PageSetup } from '@/types/models';
import { sanitizeHtml } from '@/utils/sanitize';

const PAPER_SIZES: Record<string, [number, number]> = {
  A4: [794, 1123],
  A5: [559, 794],
  Letter: [816, 1056],
  Legal: [816, 1344],
};

export function paperDimensions(setup: PageSetup): [number, number] {
  const base = PAPER_SIZES[setup.paperSize] ?? PAPER_SIZES.A4;
  return setup.orientation === 'landscape' ? [base[1], base[0]] : base;
}

export interface EditorDocumentOptions {
  html: string;
  pageSetup?: PageSetup;
  dark?: boolean;
  spellcheck?: boolean;
  fontScale?: number;
  /** Optional @font-face URL (used by the web build to match the app font). */
  fontUrl?: string | null;
  placeholder?: string;
}

function rootVariables(setup: PageSetup, fontScale: number): string {
  const [width, height] = paperDimensions(setup);
  return `:root{
  --paper-width:${width}px;
  --paper-height:${height}px;
  --margin-top:${setup.margins.top}px;
  --margin-right:${setup.margins.right}px;
  --margin-bottom:${setup.margins.bottom}px;
  --margin-left:${setup.margins.left}px;
  --page:${setup.pageColor};
  --line-height:${setup.lineHeight};
  --font-scale:${fontScale};
}`;
}

function fontFace(fontUrl?: string | null): string {
  if (!fontUrl) return '';
  return `@font-face{font-family:'PlusJakartaSans';src:url('${fontUrl}') format('woff2'),url('${fontUrl}') format('truetype');font-weight:100 900;font-display:swap;}`;
}

export function buildEditorDocument(options: EditorDocumentOptions): string {
  const setup = options.pageSetup ?? defaultPageSetup;
  const fontScale = options.fontScale ?? 1;
  const content = sanitizeHtml(options.html ?? '');
  const bodyClass = options.dark ? 'dark' : '';
  const pageClass = `${setup.headerText ? 'with-header ' : ''}${setup.footerText || setup.pageNumbers ? 'with-footer' : ''}`;
  const placeholder = options.placeholder ?? 'Tap to keep writing';

  return `<!DOCTYPE html>
<html lang="en" class="${bodyClass}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>${fontFace(options.fontUrl)}</style>
<style>${EDITOR_CSS}</style>
<style>${rootVariables(setup, fontScale)}</style>
</head>
<body>
  <div id="page" class="${pageClass}">
    <div id="page-header">${escapeForHtml(setup.headerText)}</div>
    <div id="editor" contenteditable="true" spellcheck="${options.spellcheck === false ? 'false' : 'true'}" data-placeholder="${escapeForHtml(placeholder)}" autocapitalize="sentences">${content}</div>
    <div id="page-footer">
      <span id="page-footer-text">${escapeForHtml(setup.footerText)}</span>
      <span id="page-number" style="display:${setup.pageNumbers ? 'inline' : 'none'}">Page 1</span>
    </div>
  </div>
  <div id="drawing-overlay">
    <div id="drawing-sheet">
      <div id="drawing-title">Sketch</div>
      <div id="drawing-canvas-wrap"><canvas id="drawing-canvas"></canvas></div>
      <div id="drawing-controls">
        <div id="drawing-colors">
          <button class="swatch active" style="background:#151223" data-color="#151223" aria-label="Ink"></button>
          <button class="swatch" style="background:#7C3AED" data-color="#7C3AED" aria-label="Purple"></button>
          <button class="swatch" style="background:#2563EB" data-color="#2563EB" aria-label="Blue"></button>
          <button class="swatch" style="background:#059669" data-color="#059669" aria-label="Green"></button>
          <button class="swatch" style="background:#EF4444" data-color="#EF4444" aria-label="Red"></button>
        </div>
        <button id="drawing-clear" class="d-btn">Clear</button>
        <button id="drawing-cancel" class="d-btn">Cancel</button>
        <button id="drawing-insert" class="d-btn">Insert</button>
      </div>
    </div>
  </div>
  <script>${EDITOR_SCRIPT}</script>
</body>
</html>`;
}

function escapeForHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
