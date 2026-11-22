/**
 * HTML → Markdown converter. Handles every construct the Notely editor can
 * produce: headings, emphasis, lists, quotes, code, links, images, tables,
 * dividers and footnotes.
 */
import { parseHtml, tableRows, textContent, type HtmlElement, type HtmlNode } from '@/utils/htmlParser';

function inline(node: HtmlNode, depth = 0): string {
  if (node.type === 'text') return node.value.replace(/\u00a0/g, ' ');
  const children = () => node.children.map((child) => inline(child, depth + 1)).join('');
  switch (node.tag) {
    case 'b':
    case 'strong':
      return `**${children()}**`;
    case 'i':
    case 'em':
      return `*${children()}*`;
    case 'u':
      return `<u>${children()}</u>`;
    case 's':
    case 'strike':
    case 'del':
      return `~~${children()}~~`;
    case 'code':
      return `\`${children()}\``;
    case 'mark':
      return `==${children()}==`;
    case 'br':
      return '  \n';
    case 'a':
      return `[${children()}](${node.attrs.href ?? ''})`;
    case 'img':
      return node.attrs.src?.startsWith('data:')
        ? `![${node.attrs.alt ?? 'image'}](embedded-image)`
        : `![${node.attrs.alt ?? 'image'}](${node.attrs.src ?? ''})`;
    case 'sup':
      return `^${children()}`;
    default:
      return children();
  }
}

function listToMarkdown(list: HtmlElement, indent: string, ordered: boolean): string {
  const items = list.children.filter((child): child is HtmlElement => child.type === 'element' && child.tag === 'li');
  return items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const nested = item.children.filter(
        (child): child is HtmlElement => child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol'),
      );
      const body = item.children
        .filter((child) => !(child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol')))
        .map((child) => inline(child))
        .join('')
        .trim();
      const lines = [`${indent}${marker} ${body}`];
      for (const sub of nested) lines.push(listToMarkdown(sub, `${indent}  `, sub.tag === 'ol'));
      return lines.join('\n');
    })
    .join('\n');
}

function tableToMarkdown(table: HtmlElement): string {
  const rows = tableRows(table);
  if (!rows.length) return '';
  const cellText = (row: HtmlElement) =>
    row.children
      .filter((child): child is HtmlElement => child.type === 'element' && (child.tag === 'td' || child.tag === 'th'))
      .map((cell) => cell.children.map((child) => inline(child)).join('').replace(/\n/g, ' ').trim());
  const header = cellText(rows[0]);
  const divider = header.map(() => '---');
  const body = rows.slice(1).map(cellText).map((cells) => `| ${cells.join(' | ')} |`);
  return [`| ${header.join(' | ')} |`, `| ${divider.join(' | ')} |`, ...body].join('\n');
}

function block(node: HtmlNode): string {
  if (node.type === 'text') {
    const trimmed = node.value.replace(/\u00a0/g, ' ').trim();
    return trimmed ? `${trimmed}\n` : '';
  }
  switch (node.tag) {
    case 'h1':
      return `# ${textContent(node).trim()}\n`;
    case 'h2':
      return `## ${textContent(node).trim()}\n`;
    case 'h3':
      return `### ${textContent(node).trim()}\n`;
    case 'h4':
      return `#### ${textContent(node).trim()}\n`;
    case 'h5':
      return `##### ${textContent(node).trim()}\n`;
    case 'h6':
      return `###### ${textContent(node).trim()}\n`;
    case 'p': {
      const content = node.children.map((child) => inline(child)).join('').trim();
      return content ? `${content}\n` : '';
    }
    case 'ul':
      return `${listToMarkdown(node, '', false)}\n`;
    case 'ol':
      return `${listToMarkdown(node, '', true)}\n`;
    case 'blockquote': {
      const inner = node.children.map(block).join('').trim();
      return `${inner
        .split('\n')
        .map((line) => `> ${line}`.trimEnd())
        .join('\n')}\n`;
    }
    case 'pre':
      return `\`\`\`\n${textContent(node).replace(/\n$/, '')}\n\`\`\`\n`;
    case 'hr':
      return `---\n`;
    case 'table':
      return `${tableToMarkdown(node)}\n`;
    case 'figure': {
      const image = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'img',
      );
      const caption = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'figcaption',
      );
      const svg = node.children.find((child): child is HtmlElement => child.type === 'element' && child.tag === 'svg');
      if (image) return `${inline(image)}\n${caption ? `*${textContent(caption).trim()}*\n` : ''}`;
      if (svg) return `*[chart: ${caption ? textContent(caption).trim() : 'embedded vector chart'}]*\n`;
      return node.children.map(block).join('');
    }
    case 'img':
      return `${inline(node)}\n`;
    case 'div':
    case 'section':
      return node.children.map(block).join('');
    default:
      return node.children.map(block).join('');
  }
}

export function htmlToMarkdown(html: string): string {
  const root = parseHtml(html);
  const markdown = root.children
    .map(block)
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${markdown}\n`;
}
