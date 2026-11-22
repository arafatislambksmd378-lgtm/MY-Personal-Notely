import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildEditorDocument, paperDimensions } from '@/editor/buildDocument';
import { defaultPageSetup, type PageSetup } from '@/types/models';
import type { EditorMessage } from '@/types/editor';

/**
 * Boots the real editor shell (the exact HTML/JS string shipped to the WebView)
 * inside jsdom and drives it through the React Native message bridge.
 */
function boot(html: string, pageSetup: PageSetup = defaultPageSetup) {
  const messages: EditorMessage[] = [];
  const dom = new JSDOM(buildEditorDocument({ html, pageSetup }), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
        postMessage: (payload: string) => messages.push(JSON.parse(payload) as EditorMessage),
      };
    },
  });
  const receive = (message: Record<string, unknown>) => {
    (dom.window as unknown as { __notelyReceive: (json: string) => void }).__notelyReceive(JSON.stringify(message));
  };
  const editor = dom.window.document.getElementById('editor') as HTMLElement;
  return { dom, messages, receive, editor };
}

describe('editor document', () => {
  it('renders the note inside the page with paper variables', () => {
    const { editor, dom } = boot('<h1>Plan</h1><p>Hello world</p>');
    expect(editor.textContent).toContain('Plan');
    expect(editor.textContent).toContain('Hello world');
    const css = Array.from(dom.window.document.querySelectorAll('style')).map((tag) => tag.textContent).join('\n');
    expect(css).toContain('--paper-width:794px');
    expect(css).toContain('--margin-left:48px');
    expect(dom.window.document.getElementById('page')).not.toBeNull();
    expect(dom.window.document.body.innerHTML).not.toContain('contenteditable="false"');
  });

  it('sanitises hostile markup before it reaches the surface', () => {
    const { editor, dom } = boot(
      '<p onclick="steal()">Safe</p><script>window.stolen = true</script><img src="data:image/png;base64,AAA" onerror="x()" />',
    );
    expect(editor.textContent).toContain('Safe');
    expect(editor.innerHTML).not.toContain('onclick');
    expect(editor.innerHTML).not.toContain('onerror');
    expect(editor.innerHTML).not.toContain('<script');
    expect((dom.window as unknown as { stolen?: boolean }).stolen).toBeUndefined();
    expect(editor.innerHTML).toContain('data:image/png;base64,AAA');
  });

  it('computes landscape and alternate paper sizes', () => {
    expect(paperDimensions({ ...defaultPageSetup, paperSize: 'A5' })).toEqual([559, 794]);
    expect(paperDimensions({ ...defaultPageSetup, paperSize: 'Letter', orientation: 'landscape' })).toEqual([
      1056, 816,
    ]);
  });

  it('reports readiness and a change payload', () => {
    const { messages } = boot('<p>Hello</p>');
    expect(messages.some((message) => message.type === 'ready')).toBe(true);
  });
});

describe('editor commands', () => {
  it('inserts a table with headers', () => {
    const { receive, editor, messages } = boot('<p>Body</p>');
    receive({ type: 'insertTable', rows: 3, columns: 2, withHeader: true });
    const table = editor.querySelector('table');
    expect(table).not.toBeNull();
    expect(editor.querySelectorAll('tr')).toHaveLength(3);
    expect(editor.querySelectorAll('th')).toHaveLength(2);
    expect(messages.some((message) => message.type === 'change')).toBe(true);
  });

  it('clamps absurd table dimensions', () => {
    const { receive, editor } = boot('<p>Body</p>');
    receive({ type: 'insertTable', rows: 500, columns: 99, withHeader: false });
    const rows = editor.querySelectorAll('tr').length;
    const cells = editor.querySelectorAll('td').length;
    expect(rows).toBeLessThanOrEqual(30);
    expect(cells / rows).toBeLessThanOrEqual(10);
    expect(cells).toBeGreaterThan(0);
  });

  it('builds a table of contents from headings', () => {
    const { receive, editor, messages } = boot('<h1>Intro</h1><h2>Details</h2><p>Text</p>');
    receive({ type: 'insertToc' });
    const toc = editor.querySelector('.notely-toc');
    expect(toc).not.toBeNull();
    expect(toc?.textContent).toContain('Contents');
    expect(toc?.querySelectorAll('li')).toHaveLength(2);
    expect(editor.querySelector('h1')?.id).toBeTruthy();
    expect(messages.some((message) => message.type === 'toc-empty')).toBe(false);
  });

  it('warns instead of inserting an empty table of contents', () => {
    const { receive, messages } = boot('<p>Just text</p>');
    receive({ type: 'insertToc' });
    expect(messages.some((message) => message.type === 'toc-empty')).toBe(true);
  });

  it('adds a footnote marker and the footnote text', () => {
    const { receive, editor } = boot('<p>Claim</p>');
    receive({ type: 'insertFootnote', marker: 1, text: 'Source: annual report' });
    expect(editor.querySelector('sup[data-footnote]')?.textContent).toBe('1');
    expect(editor.querySelector('.notely-footnotes')?.textContent).toContain('Source: annual report');
  });

  it('inserts a bookmark anchor that can be scrolled to', () => {
    const { receive, editor } = boot('<p>Body</p>');
    receive({ type: 'insertBookmark', id: 'bmk_1', label: 'Budget table' });
    const anchor = editor.querySelector('#bmk_1');
    expect(anchor?.textContent).toBe('Budget table');
    expect(() => receive({ type: 'scroll-to-anchor', anchor: 'bmk_1' })).not.toThrow();
  });

  it('replaces text and reports the count', () => {
    const { receive, editor, messages } = boot('<p>alpha ALPHA beta</p>');
    receive({ type: 'replaceAll', search: 'alpha', replacement: 'one' });
    expect(editor.textContent).toBe('one one beta');
    const result = messages.filter((message) => message.type === 'replace-result').pop();
    expect(result && 'count' in result ? result.count : 0).toBe(2);
  });

  it('honours a replacement limit', () => {
    const { receive, editor } = boot('<p>alpha alpha alpha</p>');
    receive({ type: 'replaceAll', search: 'alpha', replacement: 'x', limit: 2 });
    expect(editor.textContent).toBe('x x alpha');
  });

  it('finds matches without changing the text', () => {
    const { receive, editor, messages } = boot('<p>note note note</p>');
    receive({ type: 'highlightFind', search: 'note', matchCase: false, index: 1 });
    const result = messages.filter((message) => message.type === 'find-result').pop();
    expect(result && 'count' in result ? result.count : 0).toBe(3);
    expect(editor.textContent).toBe('note note note');
  });

  it('applies page setup live', () => {
    const { receive, dom } = boot('<p>Body</p>');
    receive({
      type: 'set-page-setup',
      pageSetup: JSON.stringify({
        ...defaultPageSetup,
        paperSize: 'Legal',
        orientation: 'landscape',
        headerText: 'Confidential',
        footerText: 'Notely',
        pageNumbers: true,
        pageColor: '#FFFBEB',
      }),
    });
    const root = dom.window.document.documentElement;
    expect(root.style.getPropertyValue('--paper-width')).toBe('1344px');
    expect(root.style.getPropertyValue('--page')).toBe('#FFFBEB');
    expect(dom.window.document.getElementById('page-header')?.textContent).toBe('Confidential');
    expect(dom.window.document.getElementById('page-footer-text')?.textContent).toBe('Notely');
    expect(dom.window.document.getElementById('page-number')?.textContent).toBe('Page 1');
  });

  it('reports the current selection text', () => {
    const { receive, editor, messages } = boot('<p>Selectable words</p>');
    const range = editor.ownerDocument.createRange();
    range.selectNodeContents(editor.querySelector('p') as HTMLElement);
    const selection = editor.ownerDocument.defaultView?.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    receive({ type: 'request-selection' });
    const message = messages.filter((entry) => entry.type === 'selection-text').pop();
    expect(message && 'text' in message ? message.text : '').toContain('Selectable words');
  });

  it('survives an unknown command', () => {
    const { receive } = boot('<p>Body</p>');
    expect(() => receive({ type: 'no-such-command' })).not.toThrow();
  });
});
