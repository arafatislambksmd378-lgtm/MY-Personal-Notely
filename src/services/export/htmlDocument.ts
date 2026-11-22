/**
 * Standalone HTML document used for HTML export, printing and PDF rendering.
 * Reuses the editor stylesheet so exported pages match the app exactly.
 */
import { EDITOR_CSS } from '@/editor/shellCss';
import { paperDimensions } from '@/editor/buildDocument';
import { defaultPageSetup, type PageSetup } from '@/types/models';

export interface HtmlDocumentOptions {
  html: string;
  title: string;
  pageSetup?: PageSetup;
  forPrint?: boolean;
}

function pageDefaults(setup: PageSetup): string {
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
}`;
}

export function buildStandaloneHtml({ html, title, pageSetup, forPrint }: HtmlDocumentOptions): string {
  const setup = pageSetup ?? defaultPageSetup;
  const [width, height] = paperDimensions(setup);
  const size = forPrint
    ? `@page { size: ${setup.orientation === 'landscape' ? `${height}px ${width}px` : `${width}px ${height}px`}; margin: 0; }`
    : '';
  const headerBlock = setup.headerText
    ? `<div id="page-header" style="display:block;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:18px">${escapeHtml(
        setup.headerText,
      )}</div>`
    : '';
  const footerBlock =
    setup.footerText || setup.pageNumbers
      ? `<div id="page-footer" style="display:flex;border-top:1px solid var(--border);padding-top:8px;margin-top:24px;justify-content:space-between"><span>${
          setup.footerText ? escapeHtml(setup.footerText) : ''
        }</span>${setup.pageNumbers ? '<span>Page 1</span>' : ''}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${EDITOR_CSS}</style>
<style>${pageDefaults(setup)}${size}</style>
<style>body{padding:0;background:#FFFFFF}#page{box-shadow:none;border-radius:0}#editor{outline:none}</style>
</head>
<body>
<div id="page">
${headerBlock}
<div id="editor">${html}</div>
${footerBlock}
</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
