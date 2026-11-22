/**
 * Minimal, dependency-free HTML parser.
 *
 * Documents are sanitised before they are stored, so this parser only has to
 * deal with well-formed, allow-listed markup. It is used by the export/import
 * converters (DOCX, ODT, Markdown, RTF) and by the outline/TOC utilities.
 */
import { decodeEntities } from './text';

export interface HtmlElement {
  type: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

export interface HtmlText {
  type: 'text';
  value: string;
}

export type HtmlNode = HtmlElement | HtmlText;

const VOID_TAGS = new Set([
  'br',
  'hr',
  'img',
  'input',
  'col',
  'meta',
  'link',
  'base',
  'area',
  'source',
  'path',
  'rect',
  'circle',
  'line',
  'polyline',
  'polygon',
  'stop',
]);

const AUTO_CLOSE: Record<string, string[]> = {
  p: ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'blockquote', 'pre'],
  li: ['li'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  tr: ['tr'],
};

export function parseHtml(html: string): HtmlElement {
  const root: HtmlElement = { type: 'element', tag: 'root', attrs: {}, children: [] };
  const stack: HtmlElement[] = [root];
  const tagRegex = /<(\/?)([a-zA-Z][-a-zA-Z0-9]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    if (!text) return;
    const parent = stack[stack.length - 1];
    const value = decodeEntities(text);
    const previous = parent.children[parent.children.length - 1];
    if (previous && previous.type === 'text') previous.value += value;
    else parent.children.push({ type: 'text', value });
  };

  const closeTag = (tag: string) => {
    for (let i = stack.length - 1; i > 0; i -= 1) {
      if (stack[i].tag === tag) {
        stack.length = i;
        return;
      }
    }
  };

  while ((match = tagRegex.exec(html))) {
    pushText(html.slice(lastIndex, match.index));
    lastIndex = tagRegex.lastIndex;
    const isClosing = match[1] === '/';
    const tag = match[2].toLowerCase();
    const selfClosing = match[4] === '/' || VOID_TAGS.has(tag);

    if (isClosing) {
      closeTag(tag);
      continue;
    }

    const autoClose = AUTO_CLOSE[tag];
    if (autoClose) {
      while (stack.length > 1 && autoClose.includes(stack[stack.length - 1].tag)) stack.pop();
    }

    const element: HtmlElement = {
      type: 'element',
      tag,
      attrs: parseAttributes(match[3] ?? ''),
      children: [],
    };
    stack[stack.length - 1].children.push(element);
    if (!selfClosing) stack.push(element);
  }
  pushText(html.slice(lastIndex));
  return root;
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw))) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? '');
  }
  return attrs;
}

export function textContent(node: HtmlNode): string {
  if (node.type === 'text') return node.value;
  return node.children.map(textContent).join('');
}

export function findElements(node: HtmlNode, tags: string[]): HtmlElement[] {
  const result: HtmlElement[] = [];
  const walk = (current: HtmlNode) => {
    if (current.type !== 'element') return;
    if (tags.includes(current.tag)) result.push(current);
    current.children.forEach(walk);
  };
  walk(node);
  return result;
}

/** Flattens a node's children into styled runs (used by DOCX/ODT writers). */
export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color?: string;
  background?: string;
  code: boolean;
  href?: string;
}

const MARK_TAGS: Record<string, keyof Omit<TextRun, 'text'>> = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  s: 'strike',
  strike: 'strike',
  del: 'strike',
  code: 'code',
};

export function flattenRuns(node: HtmlNode, inherited: Partial<TextRun> = {}): TextRun[] {
  if (node.type === 'text') {
    if (!node.value) return [];
    return [
      {
        text: node.value,
        bold: inherited.bold ?? false,
        italic: inherited.italic ?? false,
        underline: inherited.underline ?? false,
        strike: inherited.strike ?? false,
        code: inherited.code ?? false,
        color: inherited.color,
        background: inherited.background,
        href: inherited.href,
      },
    ];
  }

  const next: Partial<TextRun> = { ...inherited };
  if (MARK_TAGS[node.tag]) {
    const key = MARK_TAGS[node.tag];
    if (key === 'bold' || key === 'italic' || key === 'underline' || key === 'strike' || key === 'code') {
      next[key] = true;
    }
  }
  if (node.tag === 'a' && node.attrs.href) next.href = node.attrs.href;
  if (node.attrs.style) {
    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(node.attrs.style);
    if (color) next.color = color[1].trim();
    const background = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(node.attrs.style);
    if (background) next.background = background[1].trim();
  }
  if (node.tag === 'br') {
    const blank: TextRun = {
      text: '\n',
      bold: next.bold ?? false,
      italic: next.italic ?? false,
      underline: next.underline ?? false,
      strike: next.strike ?? false,
      code: next.code ?? false,
    };
    return [blank];
  }

  return node.children.flatMap((child) => flattenRuns(child, next));
}

/** Rows of a table, whether or not they are wrapped in thead/tbody/tfoot. */
export function tableRows(table: HtmlElement): HtmlElement[] {
  const direct = table.children.filter(
    (child): child is HtmlElement => child.type === 'element' && child.tag === 'tr',
  );
  if (direct.length) return direct;
  return table.children
    .filter(
      (child): child is HtmlElement =>
        child.type === 'element' && ['thead', 'tbody', 'tfoot'].includes(child.tag),
    )
    .flatMap((section) =>
      section.children.filter((child): child is HtmlElement => child.type === 'element' && child.tag === 'tr'),
    );
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
