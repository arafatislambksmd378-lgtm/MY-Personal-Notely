/**
 * HTML → DOCX (Office Open XML) writer.
 *
 * Produces a real .docx package: content types, relationships, styles,
 * numbering, embedded images and the document body with paragraphs, headings,
 * lists, tables, links, colour and emphasis.
 */
import JSZip from 'jszip';
import { escapeXml, flattenRuns, tableRows, type HtmlElement, type HtmlNode } from '@/utils/htmlParser';
import { parseHtml } from '@/utils/htmlParser';
import { readImageInfo, fitImage } from '@/utils/imageMeta';

const EMU_PER_PIXEL = 9525;

interface DocxContext {
  images: Array<{ name: string; base64: string; rid: string; width: number; height: number }>;
  relationships: string[];
}

function colorToHex(value: string | undefined): string | null {
  if (!value) return null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const raw = hex[1];
    return raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
          .toUpperCase()
      : raw.toUpperCase();
  }
  const named: Record<string, string> = {
    black: '000000',
    red: 'FF0000',
    blue: '0000FF',
    green: '008000',
    purple: '7C3AED',
    orange: 'F97316',
    gray: '808080',
    grey: '808080',
  };
  return named[value.trim().toLowerCase()] ?? null;
}

function runXml(run: ReturnType<typeof flattenRuns>[number]): string {
  const props: string[] = [];
  if (run.bold) props.push('<w:b/>');
  if (run.italic) props.push('<w:i/>');
  if (run.underline) props.push('<w:u w:val="single"/>');
  if (run.strike) props.push('<w:strike/>');
  const color = colorToHex(run.color);
  if (color) props.push(`<w:color w:val="${color}"/>`);
  const background = colorToHex(run.background);
  if (background) props.push(`<w:shd w:val="clear" w:fill="${background}"/>`);
  if (run.code) props.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');

  const segments = run.text.split('\n');
  const body = segments
    .map((segment, index) => `${index > 0 ? '<w:br/>' : ''}${segment ? `<w:t xml:space="preserve">${escapeXml(segment)}</w:t>` : ''}`)
    .join('');
  return `<w:r>${props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''}${body || '<w:t xml:space="preserve"></w:t>'}</w:r>`;
}

function paragraphRuns(node: HtmlElement): string {
  return flattenRuns(node)
    .filter((run) => run.text.length > 0)
    .map(runXml)
    .join('');
}

function alignmentXml(node: HtmlElement): string {
  const style = node.attrs.style ?? '';
  if (/text-align\s*:\s*center/i.test(style)) return '<w:jc w:val="center"/>';
  if (/text-align\s*:\s*right/i.test(style)) return '<w:jc w:val="right"/>';
  if (/text-align\s*:\s*justify/i.test(style)) return '<w:jc w:val="both"/>';
  return '';
}

function imageXml(dataUri: string, context: DocxContext): string {
  const info = readImageInfo(dataUri);
  if (!info) return '<w:r><w:t xml:space="preserve">[image]</w:t></w:r>';
  const index = context.images.length + 1;
  const name = `image${index}.${info.extension}`;
  const rid = `rIdImage${index}`;
  const size = fitImage(info.width, info.height, 480);
  context.images.push({ name, base64: info.base64, rid, width: size.width, height: size.height });
  context.relationships.push(
    `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`,
  );
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${Math.round(
    size.width * EMU_PER_PIXEL,
  )}" cy="${Math.round(size.height * EMU_PER_PIXEL)}"/><wp:docPr id="${index}" name="Picture ${index}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${index}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(
    size.width * EMU_PER_PIXEL,
  )}" cy="${Math.round(size.height * EMU_PER_PIXEL)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function listParagraphs(list: HtmlElement, ordered: boolean, depth: number, context: DocxContext): string {
  const numId = ordered ? 2 : 1;
  const items = list.children.filter(
    (child): child is HtmlElement => child.type === 'element' && child.tag === 'li',
  );
  return items
    .map((item) => {
      const inlineContent = item.children
        .filter((child) => !(child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol')))
        .map((child) => {
          if (child.type === 'element' && child.tag === 'img') return imageXml(child.attrs.src ?? '', context);
          if (child.type === 'text') return runXml(flattenRuns(child)[0] ?? { text: child.value, bold: false, italic: false, underline: false, strike: false, code: false });
          return flattenRuns(child)
            .filter((run) => run.text.length > 0)
            .map(runXml)
            .join('');
        })
        .join('');
      const nested = item.children
        .filter(
          (child): child is HtmlElement => child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol'),
        )
        .map((child) => listParagraphs(child, child.tag === 'ol', depth + 1, context))
        .join('');
      return `<w:p><w:pPr><w:numPr><w:ilvl w:val="${Math.min(depth, 8)}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${inlineContent}</w:p>${nested}`;
    })
    .join('');
}

function tableXml(table: HtmlElement, context: DocxContext): string {
  const rows = tableRows(table);
  const body = rows
    .map((row) => {
      const cells = row.children.filter(
        (child): child is HtmlElement => child.type === 'element' && (child.tag === 'td' || child.tag === 'th'),
      );
      return `<w:tr>${cells
        .map((cell) => {
          const header = cell.tag === 'th';
          const content = paragraphRuns(cell) || '<w:r><w:t xml:space="preserve"></w:t></w:r>';
          return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${
            header ? '<w:shd w:val="clear" w:fill="EFE8FF"/>' : ''
          }</w:tcPr><w:p>${header ? `<w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr>${
            flattenRuns(cell)
              .filter((run) => run.text.length > 0)
              .map((run) => `<w:t xml:space="preserve">${escapeXml(run.text)}</w:t>`)
              .join('')
          }</w:r>` : content}</w:p></w:tc>`;
        })
        .join('')}</w:tr>`;
    })
    .join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${[
    'top',
    'left',
    'bottom',
    'right',
    'insideH',
    'insideV',
  ]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D9D5E8"/>`)
    .join('')}</w:tblBorders></w:tblPr>${body}</w:tbl><w:p/>`;
}

function blockXml(node: HtmlNode, context: DocxContext): string {
  if (node.type === 'text') {
    const trimmed = node.value.replace(/\s+/g, ' ').trim();
    return trimmed ? `<w:p><w:r><w:t xml:space="preserve">${escapeXml(trimmed)}</w:t></w:r></w:p>` : '';
  }
  switch (node.tag) {
    case 'h1':
      return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${paragraphRuns(node)}</w:p>`;
    case 'h2':
      return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${paragraphRuns(node)}</w:p>`;
    case 'h3':
      return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>${paragraphRuns(node)}</w:p>`;
    case 'p': {
      const runs = node.children
        .map((child) => {
          if (child.type === 'element' && child.tag === 'img') return imageXml(child.attrs.src ?? '', context);
          return flattenRuns(child)
            .filter((run) => run.text.length > 0)
            .map(runXml)
            .join('');
        })
        .join('');
      return `<w:p><w:pPr>${alignmentXml(node)}</w:pPr>${runs}</w:p>`;
    }
    case 'ul':
      return listParagraphs(node, false, 0, context);
    case 'ol':
      return listParagraphs(node, true, 0, context);
    case 'blockquote': {
      const inner = node.children.map((child) => blockXml(child, context)).join('');
      return inner.replace(/<w:pPr>/g, '<w:pPr><w:ind w:left="480"/>');
    }
    case 'pre':
      return `<w:p><w:pPr><w:shd w:val="clear" w:fill="F1EFF8"/></w:pPr>${flattenRuns(node)
        .map((run) => `<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr><w:t xml:space="preserve">${escapeXml(
          run.text,
        )}</w:t></w:r>`)
        .join('')}</w:p>`;
    case 'hr':
      return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D9D5E8"/></w:pBdr></w:pPr></w:p>';
    case 'table':
      return tableXml(node, context);
    case 'figure': {
      const image = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'img',
      );
      const caption = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'figcaption',
      );
      const svg = node.children.find((child): child is HtmlElement => child.type === 'element' && child.tag === 'svg');
      return [
        image ? `<w:p>${imageXml(image.attrs.src ?? '', context)}</w:p>` : '',
        !image && svg ? '<w:p><w:r><w:t xml:space="preserve">[vector chart]</w:t></w:r></w:p>' : '',
        caption
          ? `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${flattenRuns(caption)
              .map((run) => `<w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`)
              .join('')}</w:p>`
          : '',
      ].join('');
    }
    case 'img':
      return `<w:p>${imageXml(node.attrs.src ?? '', context)}</w:p>`;
    default:
      return node.children.map((child) => blockXml(child, context)).join('');
  }
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="23"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="27"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="420" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="420" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

export interface DocxOptions {
  title?: string;
  author?: string;
  pageSize?: 'A4' | 'Letter' | 'A5' | 'Legal';
  landscape?: boolean;
}

export async function htmlToDocx(html: string, options: DocxOptions = {}): Promise<Uint8Array> {
  const root = parseHtml(html);
  const context: DocxContext = { images: [], relationships: [] };
  const body = root.children.map((child) => blockXml(child, context)).join('');
  const title = options.title ?? 'Notely document';
  const author = options.author ?? 'Notely';

  const pageSizes: Record<string, { w: number; h: number }> = {
    A4: { w: 11906, h: 16838 },
    A5: { w: 8391, h: 11906 },
    Letter: { w: 12240, h: 15840 },
    Legal: { w: 12240, h: 20160 },
  };
  const size = pageSizes[options.pageSize ?? 'A4'] ?? pageSizes.A4;
  const width = options.landscape ? size.h : size.w;
  const height = options.landscape ? size.w : size.h;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${body || '<w:p/>'}
    <w:sectPr><w:pgSz w:w="${width}" w:h="${height}"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Default Extension="bin" ContentType="application/octet-stream"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  ${context.relationships.join('\n  ')}
</Relationships>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>${escapeXml(author)}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(author)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Notely</Application></Properties>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', STYLES_XML);
  zip.file('word/numbering.xml', NUMBERING_XML);
  zip.file('word/_rels/document.xml.rels', documentRels);
  zip.file('docProps/core.xml', core);
  zip.file('docProps/app.xml', app);
  for (const image of context.images) {
    zip.file(`word/media/${image.name}`, image.base64, { base64: true });
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
