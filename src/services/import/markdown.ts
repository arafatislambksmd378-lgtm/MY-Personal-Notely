/**
 * Markdown → HTML importer.
 * Supports headings, emphasis, code spans/fences, lists, quotes, rules, links,
 * images and simple pipe tables — the subset Notely can export and edit.
 */
import { escapeHtml } from '@/utils/text';

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" />');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/__([^_]+)__/g, '<b>$1</b>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  out = out.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>');
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  return out;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let listStack: { ordered: boolean }[] = [];
  let inCodeFence = false;
  let codeBuffer: string[] = [];
  let paragraph: string[] = [];
  let tableBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeLists = () => {
    while (listStack.length) {
      output.push(listStack.pop()!.ordered ? '</ol>' : '</ul>');
    }
  };
  const flushTable = () => {
    if (!tableBuffer.length) return;
    const rows = tableBuffer
      .filter((row) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(row) || !row.includes('-'))
      .map((row) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim()),
      );
    if (rows.length) {
      const [header, ...body] = rows;
      const head = `<tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr>`;
      const rest = body.map((cells) => `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('');
      output.push(`<table><tbody>${head}${rest}</tbody></table>`);
    }
    tableBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');

    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushTable();
      if (inCodeFence) {
        output.push(`<pre>${escapeHtml(codeBuffer.join('\n'))}</pre>`);
        codeBuffer = [];
        inCodeFence = false;
      } else {
        closeLists();
        inCodeFence = true;
      }
      continue;
    }
    if (inCodeFence) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph();
      tableBuffer.push(line);
      continue;
    }
    flushTable();

    if (!line.trim()) {
      flushParagraph();
      closeLists();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeLists();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      continue;
    };

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      closeLists();
      output.push('<hr />');
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeLists();
      output.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`);
      continue;
    }

    const listItem = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (listItem) {
      flushParagraph();
      const indent = Math.floor(listItem[1].length / 2);
      const ordered = /\d/.test(listItem[2]);
      while (listStack.length > indent + 1) {
        output.push(listStack.pop()!.ordered ? '</ol>' : '</ul>');
      }
      if (listStack.length === indent + 1) {
        const current = listStack[listStack.length - 1];
        if (current.ordered !== ordered) {
          output.push(current.ordered ? '</ol>' : '</ul>');
          listStack.pop();
        }
      }
      while (listStack.length < indent + 1) {
        output.push(ordered ? '<ol>' : '<ul>');
        listStack.push({ ordered });
      }
      output.push(`<li>${inline(listItem[3])}</li>`);
      continue;
    }

    closeLists();
    paragraph.push(line.trim());
  }

  if (inCodeFence) output.push(`<pre>${escapeHtml(codeBuffer.join('\n'))}</pre>`);
  flushParagraph();
  flushTable();
  closeLists();
  return output.join('\n');
}
