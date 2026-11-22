/**
 * HTML → ODT (OpenDocument Text) writer.
 * Produces a standards-compliant package: `mimetype` (stored first, uncompressed),
 * META-INF/manifest.xml, styles.xml, content.xml and embedded pictures.
 */
import JSZip from 'jszip';
import { escapeXml, parseHtml, tableRows, type HtmlElement, type HtmlNode } from '@/utils/htmlParser';
import { readImageInfo, fitImage } from '@/utils/imageMeta';

interface OdtContext {
  images: Array<{ name: string; base64: string; width: number; height: number }>;
  styles: Set<string>;
}

function spanXml(html: string, text: string, context: OdtContext): string {
  const styleParts: string[] = [];
  if (/<(b|strong)>/i.test(html)) styleParts.push('bold');
  if (/<(i|em)>/i.test(html)) styleParts.push('italic');
  if (/<u>/i.test(html)) styleParts.push('underline');
  if (/<(s|strike|del)>/i.test(html)) styleParts.push('strike');
  const styleName = styleParts.length ? `T${styleParts.join('')}` : null;
  if (styleName) context.styles.add(styleName);
  const escaped = escapeXml(text).replace(/\n/g, '<text:line-break/>');
  return styleName ? `<text:span text:style-name="${styleName}">${escaped}</text:span>` : escaped;
}

function inlineXml(node: HtmlNode, context: OdtContext, inheritedMarks = ''): string {
  if (node.type === 'text') {
    if (!node.value) return '';
    const text = node.value.replace(/\u00a0/g, ' ');
    const marks = inheritedMarks;
    const styleName = marks ? `T${marks}` : null;
    if (!styleName) return escapeXml(text).replace(/\n/g, '<text:line-break/>');
    context.styles.add(styleName);
    return `<text:span text:style-name="${styleName}">${escapeXml(text)}</text:span>`;
  }
  let marks = inheritedMarks;
  if (['b', 'strong'].includes(node.tag) && !marks.includes('bold')) marks += 'bold';
  if (['i', 'em'].includes(node.tag) && !marks.includes('italic')) marks += 'italic';
  if (node.tag === 'u' && !marks.includes('underline')) marks += 'underline';
  if (['s', 'strike', 'del'].includes(node.tag) && !marks.includes('strike')) marks += 'strike';
  if (node.tag === 'br') return '<text:line-break/>';
  if (node.tag === 'a' && node.attrs.href) {
    return `<text:a xlink:type="simple" xlink:href="${escapeXml(node.attrs.href)}">${node.children
      .map((child) => inlineXml(child, context, marks))
      .join('')}</text:a>`;
  }
  if (node.tag === 'img') return imageXml(node.attrs.src ?? '', node.attrs.alt ?? 'image', context);
  if (node.tag === 'sup') marks += 'sup';
  return node.children.map((child) => inlineXml(child, context, marks)).join('');
}

function imageXml(dataUri: string, alt: string, context: OdtContext): string {
  const info = readImageInfo(dataUri);
  if (!info) return '';
  const index = context.images.length + 1;
  const name = `image${index}.${info.extension}`;
  const size = fitImage(info.width, info.height, 460);
  context.images.push({ name, base64: info.base64, width: size.width, height: size.height });
  const cmWidth = ((size.width / 96) * 2.54).toFixed(2);
  const cmHeight = ((size.height / 96) * 2.54).toFixed(2);
  return `<draw:frame draw:name="Image${index}" text:anchor-type="paragraph" svg:width="${cmWidth}cm" svg:height="${cmHeight}cm"><draw:image xlink:href="Pictures/${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/><svg:title>${escapeXml(alt)}</svg:title></draw:frame>`;
}

function listXml(list: HtmlElement, ordered: boolean, depth: number, context: OdtContext): string {
  const styleName = ordered ? 'ListNumber' : 'ListBullet';
  const items = list.children.filter(
    (child): child is HtmlElement => child.type === 'element' && child.tag === 'li',
  );
  const content = items
    .map((item) => {
      const inline = item.children
        .filter((child) => !(child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol')))
        .map((child) => inlineXml(child, context))
        .join('');
      const nested = item.children
        .filter(
          (child): child is HtmlElement => child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol'),
        )
        .map((child) => listXml(child, child.tag === 'ol', depth + 1, context))
        .join('');
      return `<text:list-item><text:p text:style-name="P${depth}">${inline}</text:p>${nested}</text:list-item>`;
    })
    .join('');
  return `<text:list text:style-name="${styleName}" xml:id="list${Math.random().toString(36).slice(2, 8)}">${content}</text:list>`;
}

function blockXml(node: HtmlNode, context: OdtContext): string {
  if (node.type === 'text') {
    const trimmed = node.value.trim();
    return trimmed ? `<text:p text:style-name="TextBody">${escapeXml(trimmed)}</text:p>` : '';
  }
  switch (node.tag) {
    case 'h1':
      return `<text:h text:style-name="Heading_20_1" text:outline-level="1">${node.children
        .map((child) => inlineXml(child, context))
        .join('')}</text:h>`;
    case 'h2':
      return `<text:h text:style-name="Heading_20_2" text:outline-level="2">${node.children
        .map((child) => inlineXml(child, context))
        .join('')}</text:h>`;
    case 'h3':
      return `<text:h text:style-name="Heading_20_3" text:outline-level="3">${node.children
        .map((child) => inlineXml(child, context))
        .join('')}</text:h>`;
    case 'p':
      return `<text:p text:style-name="TextBody">${node.children.map((child) => inlineXml(child, context)).join('')}</text:p>`;
    case 'ul':
      return listXml(node, false, 0, context);
    case 'ol':
      return listXml(node, true, 0, context);
    case 'blockquote':
      return `<text:p text:style-name="Quotations">${node.children.map((child) => inlineXml(child, context)).join('')}</text:p>`;
    case 'pre':
      return `<text:p text:style-name="Preformatted_20_Text">${node.children
        .map((child) => inlineXml(child, context))
        .join('')}</text:p>`;
    case 'hr':
      return '<text:p text:style-name="Horizontal_20_Line"/>';
    case 'table': {
      const rows = tableRows(node);
      const body = rows
        .map((row) => {
          const cells = row.children.filter(
            (child): child is HtmlElement => child.type === 'element' && (child.tag === 'td' || child.tag === 'th'),
          );
          return `<table:table-row>${cells
            .map(
              (cell) =>
                `<table:table-cell office:value-type="string"><text:p text:style-name="${
                  cell.tag === 'th' ? 'TableHeading' : 'TableContents'
                }">${cell.children.map((child) => inlineXml(child, context)).join('')}</text:p></table:table-cell>`,
            )
            .join('')}</table:table-row>`;
        })
        .join('');
      return `<table:table table:name="Table${Math.random().toString(36).slice(2, 7)}" table:style-name="Table1">${body}</table:table>`;
    }
    case 'figure': {
      const image = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'img',
      );
      const caption = node.children.find(
        (child): child is HtmlElement => child.type === 'element' && child.tag === 'figcaption',
      );
      const svg = node.children.find((child): child is HtmlElement => child.type === 'element' && child.tag === 'svg');
      return [
        image
          ? `<text:p text:style-name="TextBody">${imageXml(image.attrs.src ?? '', image.attrs.alt ?? 'image', context)}</text:p>`
          : '',
        !image && svg ? '<text:p text:style-name="TextBody">[vector chart]</text:p>' : '',
        caption
          ? `<text:p text:style-name="Caption">${caption.children.map((child) => inlineXml(child, context)).join('')}</text:p>`
          : '',
      ].join('');
    }
    case 'img':
      return `<text:p text:style-name="TextBody">${imageXml(node.attrs.src ?? '', node.attrs.alt ?? 'image', context)}</text:p>`;
    default:
      return node.children.map((child) => blockXml(child, context)).join('');
  }
}

function automaticStyles(styles: Set<string>): string {
  const entries = Array.from(styles)
    .map((style) => {
      const props: string[] = [];
      if (style.includes('bold')) props.push('<fo:font-weight fo:font-weight="bold" style:font-weight-complex="bold" style:font-weight-asian="bold"/>');
      if (style.includes('italic')) props.push('<fo:font-style fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"/>');
      if (style.includes('underline')) props.push('<style:text-underline-style fo:text-underline-style="solid"/><style:text-underline-width fo:text-underline-width="auto" style:text-underline-type="single"/>');
      if (style.includes('strike')) props.push('<style:text-line-through-style fo:text-line-through-style="solid"/>');
      if (style.includes('sup')) props.push('<style:text-position style:position="super 58%"/>');
      return `<style:style style:name="T${style}" style:family="text">${props.length ? `<style:text-properties>${props.join('')}</style:text-properties>` : ''}</style:style>`;
    })
    .join('');
  return entries;
}

export interface OdtOptions {
  title?: string;
  author?: string;
}

export async function htmlToOdt(html: string, options: OdtOptions = {}): Promise<Uint8Array> {
  const root = parseHtml(html);
  const context: OdtContext = { images: [], styles: new Set() };
  const body = root.children.map((child) => blockXml(child, context)).join('');
  const title = options.title ?? 'Notely document';

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
  <office:automatic-styles>${automaticStyles(context.styles)}</office:automatic-styles>
  <office:body>
    <office:text>
      ${body || '<text:p text:style-name="TextBody"/>'}
    </office:text>
  </office:body>
</office:document-content>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
  <office:font-face-decls><style:font-face style:name="Notely Sans" svg:font-family="'Notely Sans', sans-serif"/></office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.2cm" fo:line-height="150%"/><style:text-properties style:font-name="Notely Sans" fo:font-size="11pt"/></style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
    <style:style style:name="TextBody" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-bottom="0.22cm"/></style:style>
    <style:style style:name="Heading_20_1" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.2cm"/><style:text-properties fo:font-size="20pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="Heading_20_2" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0.45cm" fo:margin-bottom="0.18cm"/><style:text-properties fo:font-size="16pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="Heading_20_3" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.16cm"/><style:text-properties fo:font-size="13.5pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="0.8cm" fo:border-left="0.08cm solid #7C3AED" fo:padding-left="0.3cm"/></style:style>
    <style:style style:name="Preformatted_20_Text" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties style:font-name="Courier New" fo:font-size="10pt"/></style:style>
    <style:style style:name="Caption" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="9pt" fo:font-style="italic"/></style:style>
    <style:style style:name="TableHeading" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-weight="bold"/></style:style>
    <style:style style:name="TableContents" style:family="paragraph" style:parent-style-name="Standard"/>
    <style:style style:name="P0" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="0.6cm" fo:text-indent="-0.4cm"/></style:style>
    <style:style style:name="P1" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1.2cm" fo:text-indent="-0.4cm"/></style:style>
    <style:style style:name="P2" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="1.8cm" fo:text-indent="-0.4cm"/></style:style>
    <style:style style:name="ListBullet" style:family="paragraph" style:parent-style-name="Standard"/>
    <style:style style:name="ListNumber" style:family="paragraph" style:parent-style-name="Standard"/>
    <style:style style:name="Table1" style:family="table"><style:table-properties table:align="margins" style:width="17cm"/></style:style>
    <style:style style:name="Horizontal_20_Line" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:border-bottom="0.02cm solid #D9D5E8"/></style:style>
  </office:styles>
</office:document-styles>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
  ${context.images
    .map(
      (image) =>
        `<manifest:file-entry manifest:full-path="Pictures/${image.name}" manifest:media-type="image/${image.name.split('.').pop()}"/>`,
    )
    .join('\n  ')}
</manifest:manifest>`;

  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3">
  <office:meta><dc:title>${escapeXml(title)}</dc:title><meta:generator>Notely</meta:generator><dc:creator>${escapeXml(
    options.author ?? 'Notely',
  )}</dc:creator></office:meta>
</office:document-meta>`;

  const zip = new JSZip();
  // `mimetype` must be the first entry and must not be compressed.
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', contentXml);
  zip.file('styles.xml', stylesXml);
  zip.file('meta.xml', meta);
  zip.file('META-INF/manifest.xml', manifest);
  for (const image of context.images) {
    zip.file(`Pictures/${image.name}`, image.base64, { base64: true });
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
