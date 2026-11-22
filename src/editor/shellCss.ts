/**
 * Stylesheet embedded in the editor surface.
 *
 * The same CSS drives the on-screen page (page size, margins, page colour,
 * headers/footers, typography) and the PDF export, so what the user sees is what
 * gets printed.
 */
export const EDITOR_CSS = `
  :root {
    --canvas: #F7F6FB;
    --page: #FFFFFF;
    --ink: #151223;
    --muted: #6F6C80;
    --border: #E7E3F2;
    --accent: #7C3AED;
    --paper-width: 794px;
    --paper-height: 1123px;
    --margin-top: 56px;
    --margin-right: 48px;
    --margin-bottom: 56px;
    --margin-left: 48px;
    --line-height: 1.55;
    --font-scale: 1;
    --editor-font: 'PlusJakartaSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; background: var(--canvas); }
  body {
    font-family: var(--editor-font);
    color: var(--ink);
    padding: 16px 12px 60px;
    overscroll-behavior: contain;
  }
  #page {
    position: relative;
    width: 100%;
    max-width: var(--paper-width);
    min-height: var(--paper-height);
    margin: 0 auto;
    background: var(--page);
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(37, 24, 71, 0.10);
    padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
    display: flex;
    flex-direction: column;
  }
  #page-header, #page-footer {
    font-size: 11px;
    letter-spacing: 0.4px;
    color: var(--muted);
    text-transform: uppercase;
    display: none;
  }
  #page-header { border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 18px; }
  #page-footer {
    border-top: 1px solid var(--border);
    padding-top: 8px;
    margin-top: 24px;
    display: none;
    justify-content: space-between;
    gap: 8px;
  }
  #page.with-header #page-header { display: block; }
  #page.with-footer #page-footer { display: flex; }
  #editor {
    flex: 1;
    outline: none;
    font-size: calc(16px * var(--font-scale));
    line-height: var(--line-height);
    color: var(--ink);
    word-wrap: break-word;
    overflow-wrap: anywhere;
    caret-color: var(--accent);
    min-height: 40vh;
  }
  #editor:empty:before {
    content: attr(data-placeholder);
    color: var(--muted);
    pointer-events: none;
  }
  #editor h1 { font-size: 1.9em; line-height: 1.25; margin: 0.55em 0 0.35em; letter-spacing: -0.02em; }
  #editor h2 { font-size: 1.45em; line-height: 1.3; margin: 0.6em 0 0.3em; letter-spacing: -0.015em; }
  #editor h3 { font-size: 1.18em; line-height: 1.35; margin: 0.6em 0 0.3em; }
  #editor p { margin: 0 0 0.75em; }
  #editor ul, #editor ol { margin: 0 0 0.8em; padding-left: 1.45em; }
  #editor li { margin-bottom: 0.28em; }
  #editor blockquote {
    margin: 0.8em 0;
    padding: 0.55em 0.9em;
    border-left: 3px solid var(--accent);
    background: rgba(124, 58, 237, 0.06);
    border-radius: 0 8px 8px 0;
    color: var(--ink);
  }
  #editor pre {
    background: rgba(21, 18, 35, 0.06);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.88em;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  #editor a { color: var(--accent); text-decoration: underline; }
  #editor img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0.6em 0; }
  #editor hr { border: none; border-top: 1px solid var(--border); margin: 1.4em 0; }
  #editor table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.94em; }
  #editor th, #editor td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
  #editor th { background: rgba(124, 58, 237, 0.08); font-weight: 700; }
  #editor figure { margin: 1em 0; }
  #editor figcaption { font-size: 0.82em; color: var(--muted); text-align: center; margin-top: 6px; }
  #editor sup[data-footnote] { color: var(--accent); font-weight: 700; }
  .notely-footnotes {
    margin-top: 2em; border-top: 1px solid var(--border); padding-top: 12px; font-size: 0.86em; color: var(--muted);
  }
  .notely-footnotes p { margin: 0 0 0.4em; }
  .notely-toc {
    border: 1px dashed var(--border); border-radius: 10px; padding: 12px 16px; margin: 0.8em 0;
  }
  .notely-toc p:first-child { font-weight: 700; margin-bottom: 0.4em; }
  .notely-toc ul { margin: 0; padding-left: 1.1em; }
  .notely-bookmark { display: inline-block; width: 0; }
  .notely-bookmark-target { scroll-margin-top: 24px; }
  ::highlight(notely-find) { background: rgba(245, 165, 36, 0.42); color: inherit; }
  .misspelled { text-decoration: underline wavy #EF4444; text-decoration-skip-ink: none; }
  #drawing-overlay {
    position: fixed; inset: 0; background: rgba(21, 18, 35, 0.55);
    display: none; align-items: flex-end; z-index: 50;
  }
  #drawing-overlay.open { display: flex; }
  #drawing-sheet {
    background: #FFFFFF; width: 100%; border-radius: 24px 24px 0 0; padding: 14px 16px 20px;
    box-shadow: 0 -8px 30px rgba(21, 18, 35, 0.22);
  }
  #drawing-title { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
  #drawing-canvas-wrap { background: #FFFFFF; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  #drawing-canvas { display: block; width: 100%; height: 300px; touch-action: none; cursor: crosshair; }
  #drawing-controls { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  #drawing-colors { display: flex; gap: 8px; flex: 1; }
  .swatch { width: 24px; height: 24px; border-radius: 12px; border: 2px solid transparent; }
  .swatch.active { border-color: #151223; }
  .d-btn {
    border: none; border-radius: 12px; padding: 10px 16px; font-size: 13px; font-weight: 700;
    font-family: var(--editor-font);
  }
  #drawing-clear { background: #F1EFF8; color: #67647A; }
  #drawing-insert { background: var(--accent); color: #FFFFFF; }
  .dark { --canvas: #100D18; --page: #181424; --ink: #F6F4FF; --muted: #AFABC2; --border: #2B2540; }
  .dark #page { box-shadow: 0 6px 24px rgba(0,0,0,0.45); }
  .dark #drawing-sheet { background: #181424; color: #F6F4FF; }
  .dark #drawing-canvas-wrap { background: #100D18; }
  .dark #editor pre { background: rgba(255,255,255,0.08); }
  .dark #drawing-clear { background: #2A2440; color: #AFABC2; }
  @media print {
    body { padding: 0; background: #FFFFFF; }
    #page { box-shadow: none; border-radius: 0; max-width: none; width: 100%; min-height: 0; }
    #drawing-overlay { display: none !important; }
  }
`;
