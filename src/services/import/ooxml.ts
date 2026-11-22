/**
 * DOCX / ODT import.
 *
 * Both formats are ZIP packages containing XML. The XML is namespace-stripped and
 * walked into Notely's HTML subset, preserving headings, emphasis, lists,
 * tables and images (embedded media become data URIs, so the imported note is
 * fully self-contained).
 */
import JSZip from 'jszip';
import { escapeHtml } from '@/utils/text';

function toBytesArray(base64: string): string {
  return base64;
}

function stripNamespaces(xml: string): string {
  return xml
    .replace(/<(\/)?([a-zA-Z0-9]+):/g, '<$1')
    .replace(/\s([a-zA-Z0-9]+):([a-zA-Z0-9-]+)=/g, ' $2=')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner: string) => escapeHtml(inner));
}

function textOf(xml: string): string {
  return xml.replace(/<[^>]+>/g, '');
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

/* ----------------------------------- DOCX ----------------------------------- */

export async function docxToHtml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('This file is not a valid DOCX document (word/document.xml missing).');
  const xml = stripNamespaces(await documentFile.async('string'));

  // Media parts, keyed by the path Word uses inside the package.
  const mediaMap = new Map<string, string>();
  const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  for (const name of mediaFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const base64 = await file.async('base64');
    const extension = name.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : extension === 'svg' ? 'svg+xml' : extension;
    mediaMap.set(name.replace('word/', ''), `data:image/${mime};base64,${base64}`);
  }

  // relationship id → data URI, so `r:embed="rId5"` becomes a real <img>.
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const relMap = new Map<string, string>();
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    for (const tag of relsXml.match(/<Relationship\b[^>]*>/g) ?? []) {
      const id = attr(tag, 'Id');
      const target = attr(tag, 'Target');
      if (!id || !target) continue;
      const normalised = target.replace(/^\.\//, '').replace(/^\/word\//, '');
      const dataUri = mediaMap.get(normalised);
      if (dataUri) relMap.set(id, dataUri);
    }
  }

  // numId → bullet or decimal, so ordered lists survive the trip.
  const numberingFile = zip.file('word/numbering.xml');
  const orderedNumerations = new Set<string>();
  if (numberingFile) {
    const numberingXml = stripNamespaces(await numberingFile.async('string'));
    const abstractFormats = new Map<string, string>();
    for (const abstractTag of numberingXml.match(/<abstractNum\b[^>]*>/g) ?? []) {
      const abstractId = attr(abstractTag, 'abstractNumId');
      if (!abstractId) continue;
      const block = new RegExp(`<abstractNum abstractNumId="${abstractId}"[^>]*>([\\s\\S]*?)</abstractNum>`).exec(
        numberingXml,
      )?.[1];
      const format = block ? /<numFmt val="([^"]+)"/.exec(block)?.[1] : undefined;
      if (format) abstractFormats.set(abstractId, format);
    }
    for (const numTag of numberingXml.match(/<num\b[^>]*>/g) ?? []) {
      const numId = attr(numTag, 'numId');
      if (!numId) continue;
      const block = new RegExp(`<num numId="${numId}"[^>]*>([\\s\\S]*?)</num>`).exec(numberingXml)?.[1];
      const abstractId = block ? /<abstractNumId val="(\d+)"/.exec(block)?.[1] : undefined;
      const format = abstractId ? abstractFormats.get(abstractId) : undefined;
      if (format && format !== 'bullet' && format !== 'none') orderedNumerations.add(numId);
    }
  }

  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/.exec(xml);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const output: string[] = [];
  let listOpen: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listOpen) {
      output.push(listOpen === 'ol' ? '</ol>' : '</ul>');
      listOpen = null;
    }
  };

  const processedTables = new Set<number>();

  const paragraphRegex = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>|<tbl>([\s\S]*?)<\/tbl>/g;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(body))) {
    const [, paragraphContent, tableContent] = match;

    if (tableContent) {
      closeList();
      const rows = tableContent.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
      const rendered = rows
        .map((row) => {
          const cells = row.match(/<tc>[\s\S]*?<\/tc>/g) ?? [];
          return `<tr>${cells
            .map((cell) => {
              const runs = renderRuns(cell);
              return `<td>${runs || '&nbsp;'}</td>`;
            })
            .join('')}</tr>`;
        })
        .join('');
      output.push(`<table><tbody>${rendered}</tbody></table>`);
      continue;
    }

    const pPrMatch = /<pPr>([\s\S]*?)<\/pPr>/.exec(paragraphContent ?? '');
    const pPr = pPrMatch ? pPrMatch[1] : '';
    const styleId = attr(/<pStyle[^>]*>/.exec(pPr)?.[0] ?? '', 'val') ?? '';
    const isList = /<numPr>/.test(pPr);
    const numId = /<numId val="(\d+)"/.exec(pPr)?.[1];
    const isOrdered = numId ? orderedNumerations.has(numId) : false;
    const runs = renderRuns(paragraphContent ?? '');

    if (isList) {
      const wanted = isOrdered ? 'ol' : 'ul';
      if (listOpen !== wanted) {
        closeList();
        output.push(wanted === 'ol' ? '<ol>' : '<ul>');
        listOpen = wanted;
      }
      output.push(`<li>${runs || '&nbsp;'}</li>`);
      continue;
    }
    closeList();

    if (/heading\s*1|Heading1/i.test(styleId)) output.push(`<h1>${runs}</h1>`);
    else if (/heading\s*2|Heading2/i.test(styleId)) output.push(`<h2>${runs}</h2>`);
    else if (/heading\s*3|Heading3/i.test(styleId)) output.push(`<h3>${runs}</h3>`);
    else if (runs.trim()) output.push(`<p>${runs}</p>`);
  }
  closeList();

  void processedTables;
  void toBytesArray;
  return output.join('\n') || '<p></p>';

  function renderRuns(content: string): string {
    const chunks: string[] = [];
    const runRegex = /<r(?:\s[^>]*)?>([\s\S]*?)<\/r>/g;
    let runMatch: RegExpExecArray | null;
    while ((runMatch = runRegex.exec(content))) {
      const run = runMatch[1];

      // A run may carry a picture instead of text: resolve it through the
      // document relationships so the image lands in place.
      const embed =
        /<blip[^>]*embed="([^"]+)"/.exec(run)?.[1] ??
        /<imagedata[^>]*id="([^"]+)"/.exec(run)?.[1] ??
        /<blip[^>]*embed="([^"]+)"/.exec(content)?.[1];
      if (embed) {
        const src = relMap.get(embed) ?? mediaMap.get(embed.replace(/^rId/, '')) ?? null;
        if (src) {
          const alt = /<docPr[^>]*descr="([^"]*)"/.exec(run)?.[1] ?? 'Imported image';
          chunks.push(`<img src="${src}" alt="${alt}" />`);
          continue;
        }
      }

      const rPr = /<rPr>([\s\S]*?)<\/rPr>/.exec(run)?.[1] ?? '';
      const bold = /<b\s*\/>|<b>/.test(rPr);
      const italic = /<i\s*\/>|<i>/.test(rPr);
      const underline = /<u\s/.test(rPr) || /<u\/>/.test(rPr);
      const strike = /<strike/.test(rPr);
      const colorMatch = /<color val="([0-9A-Fa-f]{6})"/.exec(rPr);
      const texts = Array.from(run.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((entry) => entry[1]);
      const breaks = /<br\/>|<br>/.test(run) ? '\n' : '';
      let text = texts.join('') + breaks;
      if (!text) continue;
      let escaped = escapeHtml(text);
      if (bold) escaped = `<b>${escaped}</b>`;
      if (italic) escaped = `<i>${escaped}</i>`;
      if (underline) escaped = `<u>${escaped}</u>`;
      if (strike) escaped = `<s>${escaped}</s>`;
      if (colorMatch) escaped = `<span style="color:#${colorMatch[1]}">${escaped}</span>`;
      chunks.push(escaped);
    }

    return chunks.join('');
  }
}

/* ------------------------------------ ODT ----------------------------------- */

export async function odtToHtml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const contentFile = zip.file('content.xml');
  if (!contentFile) throw new Error('This file is not a valid ODT document (content.xml missing).');
  const xml = stripNamespaces(await contentFile.async('string'));

  const pictures = new Map<string, string>();
  for (const name of Object.keys(zip.files).filter((entry) => entry.startsWith('Pictures/') && !entry.endsWith('/'))) {
    const file = zip.file(name);
    if (!file) continue;
    const base64 = await file.async('base64');
    const extension = name.split('.').pop()?.toLowerCase() ?? 'png';
    pictures.set(name, `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${base64}`);
  }

  const bodyMatch = /<text>([\s\S]*)<\/text>/.exec(xml);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const output: string[] = [];
  let listOpen = false;

  /** Converts the inline content of one ODT block into Notely inline HTML. */
  const convertInline = (fragment: string): string => {
    const normalised = fragment.replace(/<line-break\s*\/>/g, '\n');

    const imagesHtml = Array.from(normalised.matchAll(/<image[^>]*href="([^"]+)"/g))
      .map((entry) => pictures.get(entry[1]))
      .filter((value): value is string => Boolean(value))
      .map((src) => `<img src="${src}" alt="Imported image" />`)
      .join('');

    const withoutImages = normalised.replace(/<image[^>]*\/>/g, '');
    const spans = /<span[^^>]*style-name="([^"]*)"[^>]*>([\s\S]*?)<\/span>/g;
    let html = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const plain = (chunk: string) =>
      escapeHtml(textOf(chunk.replace(/<line-break\s*\/>/g, '\n'))).replace(/\n/g, '<br />');

    while ((match = spans.exec(withoutImages))) {
      html += plain(withoutImages.slice(lastIndex, match.index));
      let inner = plain(match[2]);
      const styleName = match[1];
      if (styleName.includes('strike')) inner = `<s>${inner}</s>`;
      if (styleName.includes('underline')) inner = `<u>${inner}</u>`;
      if (styleName.includes('italic')) inner = `<i>${inner}</i>`;
      if (styleName.includes('bold')) inner = `<b>${inner}</b>`;
      html += inner;
      lastIndex = spans.lastIndex;
    }
    html += plain(withoutImages.slice(lastIndex));
    return `${imagesHtml}${html}`;
  };

  const blockRegex =
    /<h\b([^>]*)>([\s\S]*?)<\/h>|<p\b[^>]*>([\s\S]*?)<\/p>|<list\b[^>]*>([\s\S]*?)<\/list>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(body))) {
    if (match[1] !== undefined) {
      const levelMatch = /outline-level="(\d)"/.exec(match[1]);
      const level = Math.min(6, Math.max(1, Number(levelMatch?.[1] ?? 1)));
      const content = convertInline(match[2]);
      if (content.trim()) output.push(`<h${level}>${content}</h${level}>`);
      continue;
    }
    if (match[3] !== undefined) {
      const content = convertInline(match[3]);
      if (content.trim()) output.push(`<p>${content}</p>`);
      continue;
    }
    if (match[4] !== undefined) {
      const items = match[4].match(/<list-item>([\s\S]*?)<\/list-item>/g) ?? [];
      if (!listOpen) {
        output.push('<ul>');
        listOpen = true;
      }
      for (const item of items) {
        output.push(`<li>${convertInline(item)}</li>`);
      }
    }
  }
  if (listOpen) output.push('</ul>');
  return output.join('\n') || '<p></p>';
}
