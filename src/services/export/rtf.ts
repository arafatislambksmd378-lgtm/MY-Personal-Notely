/**
 * HTML → RTF converter (RTF 1.5, Unicode-aware).
 * Word, LibreOffice and Google Docs all open the output.
 */
import { parseHtml, tableRows, type HtmlElement, type HtmlNode } from '@/utils/htmlParser';

function rtfEscape(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\\' || char === '{' || char === '}') out += `\\${char}`;
    else if (char === '\n') out += '\\line ';
    else if (code < 128) out += char;
    else if (code <= 0xffff) out += `\\u${code}?`;
    else {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      out += `\\u${high}?\\u${low}?`;
    }
  }
  return out;
}

interface RtfState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

const BASE: RtfState = { bold: false, italic: false, underline: false, strike: false };

function inline(node: HtmlNode, state: RtfState): string {
  if (node.type === 'text') {
    if (!node.value) return '';
    const controls = [
      state.bold ? '\\b' : '',
      state.italic ? '\\i' : '',
      state.underline ? '\\ul' : '',
      state.strike ? '\\strike' : '',
    ]
      .filter(Boolean)
      .join('');
    const reset = [
      state.bold ? '\\b0' : '',
      state.italic ? '\\i0' : '',
      state.underline ? '\\ulnone' : '',
      state.strike ? '\\strike0' : '',
    ]
      .filter(Boolean)
      .join('');
    const content = rtfEscape(node.value.replace(/\u00a0/g, ' '));
    return controls ? `{${controls} ${content}${reset}}` : content;
  }
  const next: RtfState = { ...state };
  if (['b', 'strong'].includes(node.tag)) next.bold = true;
  if (['i', 'em'].includes(node.tag)) next.italic = true;
  if (node.tag === 'u') next.underline = true;
  if (['s', 'strike', 'del'].includes(node.tag)) next.strike = true;
  if (node.tag === 'br') return '\\line ';
  if (node.tag === 'code') return `{\\f1 ${node.children.map((child) => inline(child, next)).join('')}}`;
  return node.children.map((child) => inline(child, next)).join('');
}

function paragraphAlign(node: HtmlElement): string {
  const style = node.attrs.style ?? '';
  if (/text-align\s*:\s*center/i.test(style)) return '\\qc ';
  if (/text-align\s*:\s*right/i.test(style)) return '\\qr ';
  if (/text-align\s*:\s*justify/i.test(style)) return '\\qj ';
  if (node.attrs.align === 'center') return '\\qc ';
  return '';
}

function block(node: HtmlNode, listDepth = 0): string {
  if (node.type === 'text') {
    const trimmed = node.value.trim();
    return trimmed ? `${rtfEscape(trimmed)}\\par\n` : '';
  }
  switch (node.tag) {
    case 'h1':
      return `{\\pard\\sa180\\sb240\\b\\fs40 ${node.children.map((child) => inline(child, BASE)).join('')}\\par}\n`;
    case 'h2':
      return `{\\pard\\sa160\\sb200\\b\\fs32 ${node.children.map((child) => inline(child, BASE)).join('')}\\par}\n`;
    case 'h3':
      return `{\\pard\\sa140\\sb160\\b\\fs28 ${node.children.map((child) => inline(child, BASE)).join('')}\\par}\n`;
    case 'p': {
      const content = node.children.map((child) => inline(child, BASE)).join('');
      return `{\\pard${paragraphAlign(node)}\\sa120 ${content}\\par}\n`;
    }
    case 'ul':
    case 'ol': {
      const items = node.children.filter(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'li',
      );
      return items
        .map((item, index) => {
          const marker = node.tag === 'ol' ? `${index + 1}. ` : '\\bullet  ';
          const indent = 360 * (listDepth + 1);
          const content = item.children
            .filter((child) => !(child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol')))
            .map((child) => inline(child, BASE))
            .join('');
          const nested = item.children
            .filter(
              (child): child is HtmlElement =>
                child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol'),
            )
            .map((child) => block(child, listDepth + 1))
            .join('');
          return `{\\pard\\li${indent}\\fi-180 ${rtfEscape(marker)}${content}\\par}\n${nested}`;
        })
        .join('');
    }
    case 'blockquote': {
      const inner = node.children.map((child) => block(child, listDepth)).join('');
      return `{\\pard\\li360\\ri360 ${inner}}\n`;
    }
    case 'pre':
      return `{\\pard\\f1 ${node.children.map((child) => inline(child, BASE)).join('')}\\par}\n`;
    case 'hr':
      return '{\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par}\n';
    case 'table': {
      const rows = tableRows(node);
      return rows
        .map((row) => {
          const cells = row.children
            .filter((child): child is HtmlElement => child.type === 'element' && (child.tag === 'td' || child.tag === 'th'))
            .map((cell) => cell.children.map((child) => inline(child, BASE)).join(''));
          return `{\\pard\\intbl ${cells.join('\\cell ')}\\cell}\\row\n`;
        })
        .join('');
    }
    case 'figure': {
      const caption = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'figcaption',
      );
      return caption
        ? `{\\pard\\i ${rtfEscape(caption.children.map((child) => inline(child, BASE)).join(''))}\\par}\n`
        : '';
    }
    case 'img':
      return `{\\pard\\i ${rtfEscape(`[image: ${node.attrs.alt ?? 'inserted image'}]`)}\\par}\n`;
    default:
      return node.children.map((child) => block(child, listDepth)).join('');
  }
}

export function htmlToRtf(html: string, title = 'Notely document'): string {
  const root = parseHtml(html);
  const body = root.children.map((child) => block(child)).join('');
  return `{\\rtf1\\ansi\\deff0\\uc1
{\\fonttbl{\\f0 Helvetica;}{\\f1 Courier New;}}
{\\info{\\title ${rtfEscape(title)}}{\\operator Notely}}
\\viewkind4\\uc1\\pard\\f0\\fs24
${body}
}`;
}
