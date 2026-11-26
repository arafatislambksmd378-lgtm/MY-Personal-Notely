/**
 * Document editor screen.
 *
 * Owns the document lifecycle: load → edit (rich text) → autosave → version
 * snapshots, plus every tool exposed by the reference design (insert sheet,
 * note options, page setup, review tools, share & export).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import { RichTextEditor, type RichTextEditorHandle } from '@/editor/RichTextEditor';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { FormatToolbar } from '@/features/editor/FormatToolbar';
import { EditorBottomBar } from '@/features/editor/EditorBottomBar';
import { InsertSheet, type InsertTool } from '@/features/editor/InsertSheet';
import { NoteOptionsSheet, type NoteOption } from '@/features/editor/NoteOptionsSheet';
import { TextStyleSheet } from '@/features/editor/TextStyleSheet';
import { PageSetupSheet } from '@/features/editor/PageSetupSheet';
import { FindReplaceSheet, SpellingSheet, WordCountSheet } from '@/features/editor/ReviewSheets';
import {
  BookmarksSheet,
  CommentsSheet,
  MoveToNotebookSheet,
  VersionHistorySheet,
} from '@/features/editor/DocumentSheets';
import {
  ChartSheet,
  EquationSheet,
  FootnoteSheet,
  LinkSheet,
  SymbolsSheet,
  TableSheet,
  VoiceSheet,
} from '@/features/editor/InsertContentSheets';
import { ShareExportSheet } from '@/features/editor/ShareExportSheet';
import { TagsSheet } from '@/features/editor/TagsSheet';
import { ScanSheet } from '@/features/editor/ScanSheet';
import { TextStyleSelector } from '@/components/TextStyleSelector';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PromptDialog } from '@/components/PromptDialog';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useAutosave } from '@/hooks/useAutosave';
import { toast } from '@/store/useToastStore';
import {
  duplicateDocument,
  getDocument,
  patchDocument,
  saveDocumentContent,
  trashDocument,
  touchOpened,
  toggleFavorite,
  togglePinned,
  toggleArchived,
} from '@/db/repositories/documents';
import { createVersion } from '@/db/repositories/versions';
import { addBookmark } from '@/db/repositories/bookmarks';
import { countComments } from '@/db/repositories/comments';
import { recordMediaAsset } from '@/db/repositories/media';
import { logEvent } from '@/db/repositories/events';
import { pickImage } from '@/services/media';
import { createId } from '@/utils/id';
import { readingMinutes, countOccurrences } from '@/utils/text';
import { APP_CONFIG } from '@/config/app';
import type { BlockStyle, EditorMessage, EditorSelectionInfo } from '@/types/editor';
import type { AccentName } from '@/design/tokens';
import type { DocumentRecord, PageSetup } from '@/types/models';
import { spacing } from '@/design/tokens';

type SheetName =
  | 'insert'
  | 'options'
  | 'style'
  | 'pageSetup'
  | 'find'
  | 'wordCount'
  | 'spelling'
  | 'versions'
  | 'comments'
  | 'bookmarks'
  | 'move'
  | 'share'
  | 'tags'
  | 'favorite'
  | 'archive'
  | 'table'
  | 'link'
  | 'footnote'
  | 'symbols'
  | 'equation'
  | 'chart'
  | 'voice'
  | 'bookmarkLabel'
  | 'scan';

const DEFAULT_SELECTION: EditorSelectionInfo = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  block: 'paragraph',
  align: 'left',
};

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const snapshotRef = useRef<number>(0);

  const settings = useSettingsStore((state) => state.settings);
  const refreshLibrary = useLibraryStore((state) => state.refresh);
  const notebooks = useLibraryStore((state) => state.notebooks);

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState('');
  const [selection, setSelection] = useState<EditorSelectionInfo>(DEFAULT_SELECTION);
  const [editStats, setEditStats] = useState({ words: 0, chars: 0, minutes: 0, plainText: '' });
  const [html, setHtml] = useState('');
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [quote, setQuote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openSheet = useCallback((name: SheetName) => setSheet(name), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  /* ------------------------------- loading ------------------------------- */

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      const found = await getDocument(id);
      if (!active) return;
      if (!found) {
        setNotFound(true);
        return;
      }
      setDoc(found);
      setTitle(found.title);
      setHtml(found.contentHtml);
      setEditStats({
        words: found.wordCount,
        chars: found.charCount,
        minutes: found.readingMinutes,
        plainText: found.plainText,
      });
      setCommentCount(await countComments(id));
      await touchOpened(id);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  /* ------------------------------- autosave ------------------------------ */

  const persist = useCallback(
    async (payload: { html: string; plainText: string; title: string }) => {
      if (!id) return;
      await saveDocumentContent(id, payload);
      const current = useSettingsStore.getState().settings;
      if (current.versionHistoryEnabled) {
        const now = Date.now();
        if (!snapshotRef.current || now - snapshotRef.current > APP_CONFIG.versionSnapshotIntervalMs) {
          snapshotRef.current = now;
          await createVersion(id, { minIntervalMs: APP_CONFIG.versionSnapshotIntervalMs });
        }
      }
      await refreshLibrary();
    },
    [id, refreshLibrary],
  );

  const autosave = useAutosave({
    save: persist,
    delayMs: settings.autosaveIntervalMs,
    enabled: settings.autosaveEnabled,
    onError: (error) => {
      void logEvent('error', 'autosave', 'Autosave failed', { message: error.message });
      toast.error('Autosave failed — your edits stay in the editor. Check storage space.');
    },
  });

  const scheduleSave = useCallback(
    (next: { html: string; plainText: string; title: string }) => {
      autosave.schedule(next);
    },
    [autosave],
  );

  /* ----------------------------- editor events --------------------------- */

  const handleMessage = useCallback(
    (message: EditorMessage) => {
      switch (message.type) {
        case 'change': {
          setHtml(message.html);
          setEditStats({
            words: message.wordCount,
            chars: message.charCount,
            minutes: readingMinutes(message.wordCount),
            plainText: message.plainText,
          });
          scheduleSave({ html: message.html, plainText: message.plainText, title });
          break;
        }
        case 'selection':
          setSelection(message.info);
          break;
        case 'save-shortcut':
          void autosave.flush();
          break;
        case 'media':
          if (id) {
            void recordMediaAsset({
              documentId: id,
              kind: message.kind === 'drawing' ? 'drawing' : 'image',
              uri: message.dataUri,
              byteSize: message.bytes,
            });
          }
          break;
        case 'selection-text':
          setQuote(message.text || null);
          break;
        case 'toc-empty':
          toast.show('Add a heading first — Contents is built from headings.');
          break;
        case 'link-click':
          void Linking.openURL(message.href).catch(() => toast.error('That link could not be opened.'));
          break;
        case 'error':
          void logEvent('warn', 'editor', message.message);
          break;
        default:
          break;
      }
    },
    [autosave, id, scheduleSave, title],
  );

  /* -------------------------------- actions ------------------------------ */

  const send = useCallback((message: Parameters<RichTextEditorHandle['send']>[0]) => {
    editorRef.current?.send(message);
  }, []);

  const onTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      scheduleSave({ html, plainText: editStats.plainText, title: value });
    },
    [editStats.plainText, html, scheduleSave],
  );

  const onTogglePin = useCallback(async () => {
    if (!id || !doc) return;
    const next = await togglePinned(id);
    setDoc({ ...doc, isPinned: next });
    await refreshLibrary();
    toast.success(next ? 'Pinned to top' : 'Unpinned');
  }, [doc, id, refreshLibrary]);

  const changeCardColor = useCallback(
    async (color: AccentName) => {
      if (!id) return;
      await patchDocument(id, { cardColor: color });
      setDoc((current) => (current ? { ...current, cardColor: color } : current));
      await refreshLibrary();
    },
    [id, refreshLibrary],
  );

  const applyPageSetup = useCallback(
    async (pageSetup: PageSetup) => {
      if (!id || !doc) return;
      setDoc({ ...doc, pageSetup });
      send({ type: 'set-page-setup', pageSetup: JSON.stringify(pageSetup) });
      await patchDocument(id, { pageSetup });
    },
    [doc, id, send],
  );

  const insertImage = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        const image = await pickImage(source);
        if (!image) return;
        send({ type: 'insertImage', src: image.dataUri, alt: source === 'camera' ? 'Photo' : 'Image' });
        if (id) {
          await recordMediaAsset({ documentId: id, kind: source === 'camera' ? 'scan' : 'image', uri: image.dataUri, byteSize: image.byteSize });
        }
        toast.success('Image inserted');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not insert the image');
      }
    },
    [id, send],
  );

  const handleInsertTool = useCallback(
    (tool: InsertTool) => {
      closeSheet();
      switch (tool) {
        case 'table':
          openSheet('table');
          break;
        case 'drawing':
          if (id) {
            router.push({ pathname: '/drawing/[noteId]', params: { noteId: id } });
          }
          break;
        case 'chart':
          openSheet('chart');
          break;
        case 'link':
          openSheet('link');
          break;
        case 'comment':
          send({ type: 'request-selection' });
          setTimeout(() => openSheet('comments'), 120);
          break;
        case 'divider':
          send({ type: 'insertHTML', html: '<hr /><p><br /></p>' });
          break;
        case 'footnote':
          openSheet('footnote');
          break;
        case 'symbols':
          openSheet('symbols');
          break;
        case 'equation':
          openSheet('equation');
          break;
        case 'contents':
          send({ type: 'insertToc' });
          break;
        case 'bookmark':
          openSheet('bookmarkLabel');
          break;
        case 'scan':
          openSheet('scan');
          break;
        default:
          break;
      }
    },
    [closeSheet, openSheet, send],
  );

  const handleNoteOption = useCallback(
    (option: NoteOption) => {
      closeSheet();
      switch (option) {
        case 'page-setup':
          openSheet('pageSetup');
          break;
        case 'find-replace':
          openSheet('find');
          break;
        case 'word-count':
          openSheet('wordCount');
          break;
        case 'spelling':
          openSheet('spelling');
          break;
        case 'versions':
          openSheet('versions');
          break;
        case 'comments':
          send({ type: 'request-selection' });
          setTimeout(() => openSheet('comments'), 120);
          break;
        case 'bookmarks':
          openSheet('bookmarks');
          break;
        case 'move':
          openSheet('move');
          break;
        case 'share':
          openSheet('share');
          break;
        case 'duplicate':
          void (async () => {
            if (!id) return;
            const copy = await duplicateDocument(id);
            await refreshLibrary();
            toast.success('Copy created');
            router.push({ pathname: '/note/[id]', params: { id: copy.id } });
          })();
          break;
        case 'pin':
          void onTogglePin();
          break;
        case 'tags':
          openSheet('tags');
          break;
        case 'favorite':
          void (async () => {
            if (!id) return;
            const next = await toggleFavorite(id);
            setDoc((current) => (current ? { ...current, isFavorite: next } : current));
            await refreshLibrary();
            toast.success(next ? 'Added to favourites' : 'Removed from favourites');
          })();
          break;
        case 'archive':
          void (async () => {
            if (!id) return;
            const next = await toggleArchived(id);
            setDoc((current) => (current ? { ...current, isArchived: next } : current));
            await refreshLibrary();
            toast.success(next ? 'Note archived' : 'Note moved back to your library');
            if (next) router.back();
          })();
          break;
        case 'delete':
          setConfirmDelete(true);
          break;
        default:
          break;
      }
    },
    [closeSheet, id, onTogglePin, openSheet, refreshLibrary, router, send],
  );

  const reloadContentFromDatabase = useCallback(async () => {
    if (!id) return;
    const fresh = await getDocument(id);
    if (!fresh) return;
    setDoc(fresh);
    setTitle(fresh.title);
    setHtml(fresh.contentHtml);
    setEditStats({
      words: fresh.wordCount,
      chars: fresh.charCount,
      minutes: fresh.readingMinutes,
      plainText: fresh.plainText,
    });
    send({ type: 'set-content', html: fresh.contentHtml });
  }, [id, send]);

  const footnoteMarker = useMemo(() => {
    const matches = html.match(/data-footnote="/g);
    return (matches?.length ?? 0) + 1;
  }, [html]);

  if (notFound) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas, paddingTop: insets.top }]}>
        <AppText variant="title3">This note no longer exists</AppText>
        <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
          It may have been deleted from the trash.
        </AppText>
        <Button label="Back to notes" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (!doc) {
    return <View style={[styles.centered, { backgroundColor: colors.canvas }]} />;
  }

  const isDark = settings.themeMode === 'dark' || (settings.themeMode === 'system' && colors.scheme === 'dark');

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.canvas, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <EditorHeader
        title={title}
        onTitleChange={onTitleChange}
        onBack={() => {
          void autosave.flush().then(() => router.back());
        }}
        saveStatus={autosave.status}
        lastSavedAt={autosave.lastSavedAt}
        onOpenComments={() => {
          send({ type: 'request-selection' });
          openSheet('comments');
        }}
        onTogglePin={() => void onTogglePin()}
        isPinned={doc.isPinned}
        onOpenOptions={() => openSheet('options')}
        commentCount={commentCount}
      />

      {!collapsed ? (
        <>
          <FormatToolbar
            selection={selection}
            onCommand={(command) => send({ type: 'exec', command })}
            onAlign={(align) => send({ type: 'align', value: align })}
            onOpenStyleSheet={() => openSheet('style')}
            onOpenColorSheet={() => openSheet('style')}
            onOpenLinkSheet={() => openSheet('link')}
            onSmallText={() => openSheet('style')}
          />
          <TextStyleSelector
            currentBlock={selection.block}
            onBlock={(block) => send({ type: 'block', value: block })}
          />
        </>
      ) : null}

      <RichTextEditor
        ref={editorRef}
        initialHtml={doc.contentHtml}
        pageSetup={doc.pageSetup}
        dark={isDark}
        spellcheck={settings.spellcheckEnabled}
        fontScale={settings.editorFontScale}
        onMessage={handleMessage}
      />

      <EditorBottomBar
        onOpenInsert={() => openSheet('insert')}
        onOpenTextStyle={() => openSheet('style')}
        onInsertImage={() => void insertImage('library')}
        onDictate={() => openSheet('voice')}
        onFind={() => openSheet('find')}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        collapsed={collapsed}
        bottomInset={insets.bottom}
      />

      {/* ------------------------------- sheets ------------------------------ */}
      <InsertSheet
        visible={sheet === 'insert'}
        onClose={closeSheet}
        onSelect={handleInsertTool}
        onInsertImage={(source) => {
          closeSheet();
          void insertImage(source);
        }}
      />

      <NoteOptionsSheet
        visible={sheet === 'options'}
        onClose={closeSheet}
        cardColor={doc.cardColor}
        onCardColorChange={(color) => void changeCardColor(color)}
        onSelect={handleNoteOption}
        isPinned={doc.isPinned}
        isFavorite={doc.isFavorite}
      />

      <TagsSheet visible={sheet === 'tags'} onClose={closeSheet} documentId={doc.id} />

      <ScanSheet
        visible={sheet === 'scan'}
        onClose={closeSheet}
        onInsert={(scannedHtml) => send({ type: 'insertHTML', html: scannedHtml })}
      />

      <TextStyleSheet
        visible={sheet === 'style'}
        onClose={closeSheet}
        currentBlock={selection.block}
        onBlock={(block: BlockStyle) => {
          send({ type: 'block', value: block });
          closeSheet();
        }}
        onFontSize={(value) => send({ type: 'fontSize', value })}
        onTextColor={(hex) => send({ type: 'foreColor', value: hex })}
        onHighlight={(hex) => send({ type: 'hiliteColor', value: hex })}
      />

      <PageSetupSheet
        visible={sheet === 'pageSetup'}
        onClose={closeSheet}
        pageSetup={doc.pageSetup}
        onChange={(setup) => void applyPageSetup(setup)}
      />

      <FindReplaceSheet
        visible={sheet === 'find'}
        onClose={closeSheet}
        plainText={editStats.plainText}
        onHighlight={(search, matchCase, index) => send({ type: 'highlightFind', search, matchCase, index })}
        onClear={() => send({ type: 'clearFind' })}
        onReplace={async (search, replacement, matchCase, limit) => {
          const total = countOccurrences(editStats.plainText, search, matchCase);
          send({ type: 'replaceAll', search, replacement, matchCase, limit: limit || undefined });
          return limit > 0 ? Math.min(limit, total) : total;
        }}
      />

      <WordCountSheet
        visible={sheet === 'wordCount'}
        onClose={closeSheet}
        plainText={editStats.plainText}
        wordCount={editStats.words}
        charCount={editStats.chars}
        readingMinutes={editStats.minutes}
      />

      <SpellingSheet
        visible={sheet === 'spelling'}
        onClose={closeSheet}
        plainText={editStats.plainText}
        enabled={settings.spellcheckEnabled}
        onReplace={async (issue, replacement) => {
          const total = countOccurrences(editStats.plainText, issue.text.trim(), false);
          send({ type: 'replaceAll', search: issue.text.trim(), replacement, matchCase: false });
          return total;
        }}
      />

      <VersionHistorySheet
        visible={sheet === 'versions'}
        onClose={closeSheet}
        documentId={doc.id}
        currentHtml={html || doc.contentHtml}
        onRestored={() => void reloadContentFromDatabase()}
      />

      <CommentsSheet
        visible={sheet === 'comments'}
        onClose={closeSheet}
        documentId={doc.id}
        quote={quote}
        onChanged={() => void countComments(doc.id).then(setCommentCount)}
      />

      <BookmarksSheet
        visible={sheet === 'bookmarks'}
        onClose={closeSheet}
        documentId={doc.id}
        onAdd={async (label) => {
          const anchor = createId('bmk');
          send({ type: 'insertBookmark', id: anchor, label });
          await addBookmark({ documentId: doc.id, label, anchor });
          toast.success('Bookmark added');
        }}
        onJump={(anchor) => {
          send({ type: 'scroll-to-anchor', anchor });
        }}
      />

      <MoveToNotebookSheet
        visible={sheet === 'move'}
        onClose={closeSheet}
        notebooks={notebooks}
        currentNotebookId={doc.notebookId}
        onSelect={async (notebookId) => {
          await patchDocument(doc.id, { notebookId });
          setDoc({ ...doc, notebookId });
          await refreshLibrary();
          toast.success('Note moved');
        }}
      />

      <ShareExportSheet visible={sheet === 'share'} onClose={closeSheet} document={{ ...doc, title, contentHtml: html || doc.contentHtml }} />

      <TableSheet
        visible={sheet === 'table'}
        onClose={closeSheet}
        onInsert={(rows, columns, withHeader) => send({ type: 'insertTable', rows, columns, withHeader })}
      />

      <LinkSheet
        visible={sheet === 'link'}
        onClose={closeSheet}
        onInsert={(href, label) => send({ type: 'insertLink', href, label })}
      />

      <FootnoteSheet
        visible={sheet === 'footnote'}
        onClose={closeSheet}
        nextMarker={footnoteMarker}
        onInsert={(marker, text) => send({ type: 'insertFootnote', marker, text })}
      />

      <SymbolsSheet
        visible={sheet === 'symbols'}
        onClose={closeSheet}
        onInsert={(symbol) => send({ type: 'insertText', text: symbol })}
      />

      <EquationSheet
        visible={sheet === 'equation'}
        onClose={closeSheet}
        onInsert={(equationHtml) => send({ type: 'insertHTML', html: equationHtml })}
      />

      <ChartSheet
        visible={sheet === 'chart'}
        onClose={closeSheet}
        onInsert={(svg, caption) => send({ type: 'insertChart', svg, caption })}
      />

      <VoiceSheet
        visible={sheet === 'voice'}
        onClose={closeSheet}
        onInsert={(text) => send({ type: 'insertText', text })}
      />

      <PromptDialog
        visible={sheet === 'bookmarkLabel'}
        title="Bookmark this spot"
        message="Bookmarks are stored with the note and appear in Note options → Bookmarks."
        placeholder="e.g. Budget table"
        submitLabel="Add bookmark"
        onSubmit={async (label) => {
          const anchor = createId('bmk');
          send({ type: 'insertBookmark', id: anchor, label });
          await addBookmark({ documentId: doc.id, label, anchor });
          toast.success('Bookmark added');
        }}
        onClose={closeSheet}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Move note to trash?"
        message="The note moves to Trash and can be restored later. You can empty the trash from the library screen."
        confirmLabel="Move to trash"
        onConfirm={async () => {
          await trashDocument(doc.id);
          await refreshLibrary();
          toast.success('Note moved to trash');
          router.back();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
