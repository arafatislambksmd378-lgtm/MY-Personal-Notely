/**
 * Conservative HTML allow-list sanitizer.
 *
 * Imported documents (HTML / DOCX / Markdown) are untrusted input. The editor
 * renders stored HTML inside a WebView/iframe, so every string that reaches the
 * editor is passed through this sanitizer first to strip scripts, event
 * handlers and unsafe URLs.
 */

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'mark', 'sub', 'sup', 'small', 'code', 'pre',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'svg', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'stop',
  'section', 'article', 'header', 'footer', 'nav', 'aside', 'main',
  'input', 'label', 'dl', 'dt', 'dd', 'abbr', 'time', 'q', 'cite', 'kbd', 'samp', 'var', 'ruby', 'rt', 'rp',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'col', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'stop']);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'width', 'height', 'style', 'class', 'id',
  'colspan', 'rowspan', 'align', 'dir', 'lang', 'type', 'checked', 'disabled',
  'data-anchor', 'data-footnote', 'data-bookmark', 'data-marker',
  'viewbox', 'd', 'fill', 'stroke', 'stroke-width', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'offset', 'stop-color', 'stop-opacity',
  'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'opacity',
  'gradientunits', 'preserveaspectratio', 'role', 'aria-label',
]);

const UNSAFE_URL = /^(javascript|vbscript|data:text\/html|data:application\/xhtml)/i;
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i;

function sanitizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UNSAFE_URL.test(trimmed)) return null;
  if (trimmed.toLowerCase().startsWith('data:')) {
    return DATA_IMAGE.test(trimmed) ? trimmed : null;
  }
  return trimmed;
}

function sanitizeAttributes(rawAttrs: string): string {
  const result: string[] = [];
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs))) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (!ALLOWED_ATTRS.has(name)) continue;
    if (name.startsWith('on')) continue;
    if (name === 'style') {
      // Drop positioning/script-capable declarations but keep typography.
      if (/expression|javascript:|url\s*\(/i.test(value)) continue;
      result.push(`style="${value.replace(/"/g, '&quot;')}"`);
      continue;
    }
    if (name === 'href' || name === 'src') {
      const safe = sanitizeUrl(value);
      if (!safe) continue;
      result.push(`${name}="${safe.replace(/"/g, '&quot;')}"`);
      continue;
    }
    if (name === 'checked' || name === 'disabled') {
      result.push(name);
      continue;
    }
    result.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
  }
  return result.length ? ` ${result.join(' ')}` : '';
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Remove comments, doctypes and processing instructions first.
  let working = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\?[\s\S]*?\?>/g, '');

  // Strip dangerous containers entirely (including their content).
  working = working
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '');

  const tagRegex = /<\/?([a-zA-Z][-a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
  let output = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(working))) {
    output += working.slice(lastIndex, match.index);
    lastIndex = tagRegex.lastIndex;
    const isClosing = match[0].startsWith('</');
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (isClosing) {
      if (!VOID_TAGS.has(tag)) output += `</${tag}>`;
      continue;
    }
    const attrs = sanitizeAttributes(match[2] ?? '');
    output += VOID_TAGS.has(tag) || match[3] === '/' ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
  }
  output += working.slice(lastIndex);
  return output.trim();
}

/** Removes all markup — used before injecting user text into the editor shell. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
