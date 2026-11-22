/** Commands the formatting toolbar can send to the rich-text editor engine. */
export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'indent'
  | 'outdent'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull'
  | 'undo'
  | 'redo'
  | 'insertHorizontalRule'
  | 'removeFormat';

export type BlockStyle =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'code';

export interface EditorSnapshot {
  html: string;
  plainText: string;
  wordCount: number;
  charCount: number;
  savedAt: string | null;
}

export interface EditorSelectionInfo {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  block: BlockStyle;
  align: 'left' | 'center' | 'right' | 'justify';
}

/** Messages exchanged between the RN host and the embedded editing surface. */
export type EditorMessage =
  | { type: 'ready' }
  | { type: 'change'; html: string; plainText: string; wordCount: number; charCount: number }
  | { type: 'selection'; info: EditorSelectionInfo }
  | { type: 'save-shortcut' }
  | { type: 'height'; height: number }
  | { type: 'error'; message: string };

export type HostMessage =
  | { type: 'set-content'; html: string; pageSetup?: string; dark?: boolean }
  | { type: 'exec'; command: EditorCommand }
  | { type: 'block'; value: BlockStyle }
  | { type: 'align'; value: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'foreColor'; value: string }
  | { type: 'hiliteColor'; value: string }
  | { type: 'fontSize'; value: string }
  | { type: 'insertHTML'; html: string }
  | { type: 'insertText'; text: string }
  | { type: 'insertImage'; src: string; alt?: string }
  | { type: 'insertTable'; rows: number; columns: number; withHeader: boolean }
  | { type: 'insertLink'; href: string; label: string }
  | { type: 'insertChart'; svg: string; caption: string }
  | { type: 'insertFootnote'; marker: string; text: string }
  | { type: 'insertToc' }
  | { type: 'insertBookmark'; id: string; label: string }
  | { type: 'replaceAll'; search: string; replacement: string; matchCase: boolean }
  | { type: 'highlightFind'; search: string; matchCase: boolean; index: number }
  | { type: 'clearFind' }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'set-page-setup'; pageSetup: string }
  | { type: 'set-theme'; dark: boolean };
