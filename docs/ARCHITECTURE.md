# Architecture

Notely is a local-first Expo app. React Native renders the UI, SQLite stores
everything, and a small self-contained HTML surface renders each document. There is no
server in the critical path: the app boots, reads and writes without a network.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes | `app/` | Expo Router screens; no SQL, no formatting logic |
| Features | `src/features/` | Composed UI: editor sheets, note cards, templates |
| Services | `src/services/` | Export, import, backup, diagnostics, media, security, spellcheck |
| Repositories | `src/db/repositories/` | The only place SQL is written; rows ⇄ domain models |
| Storage | `src/db/` | Schema, migrations, cross-platform SQLite driver, seed data |
| Design | `src/design/` | Tokens and typography shared by every component |

Dependencies point downwards only. Screens never import `sql.ts`, and repositories never
import React.

## Data model

```
notebooks ──< documents ──< document_versions
                  │  └────< comments
                  │  └────< bookmarks
                  │  └────< media_assets
                  └──< document_tags >── tags
settings (key/value)          events (diagnostics)
```

- `documents` stores the canonical `content_html` plus derived `plain_text`, `excerpt`,
  `word_count`, `char_count` and `reading_minutes`. Derived columns are recomputed in
  `saveDocumentContent`, so search and lists never parse HTML at read time.
- Soft deletes: `deleted_at` marks trash, `is_archived` hides notes without deleting them.
- `page_setup_json` holds per-note paper settings, validated on read so a corrupt value
  degrades to the default page instead of throwing.
- Full-text search uses an FTS5 table maintained by triggers (`0001_init.sql`) with a
  `LIKE` fallback for engines built without FTS5.
- Settings live in SQLite, *not* in AsyncStorage, so a backup carries them. PIN material
  is the exception: it lives in Expo SecureStore.

## Editor

`src/editor/buildEditorDocument` produces a complete HTML document:

1. `EDITOR_CSS` (paper geometry, typography, tables, figures, footnotes, dark theme)
2. validated page-setup CSS variables (`--paper-width`, `--margin-*`, `--page`, …)
3. the sanitised note HTML inside `<div id="page"><div id="editor" contenteditable>`
4. `EDITOR_SCRIPT`, the runtime that handles commands and reports state

The same document is rendered by a WebView on Android/iOS (`RichTextEditor.native.tsx`)
and an iframe on web (`RichTextEditor.tsx`). Communication is a JSON protocol
(`src/types/editor.ts`):

```
host → editor   exec, block, align, foreColor, hiliteColor, fontSize, insertHTML,
                insertTable, insertImage, insertLink, insertFootnote, insertToc,
                insertBookmark, insertChart, insertText, replaceAll, highlightFind,
                clearFind, set-page-setup, set-theme, request-selection, scroll-to-anchor
editor → host   ready, change {html, plainText, wordCount, charCount}, selection,
                save-shortcut, selection-text, find-result, replace-result, toc-empty,
                link-click, media, error
```

The editor never touches the database. `app/note/[id].tsx` translates messages into
autosave payloads, media records and UI state; `useAutosave` debounces writes, flushes on
unmount/background, and retries with the payload intact on failure.

## Export & import

Export is a pure pipeline: `buildExport(document, format)` → `{fileName, mimeType, data}`.
HTML is parsed by a dependency-free parser (`src/utils/htmlParser.ts`) into a small node
tree, which feeds each writer:

| Format | Writer | Notes |
| --- | --- | --- |
| PDF | `htmlDocument.ts` + `services/files` | print job (`expo-print` / `window.print`) |
| DOCX | `docx.ts` (JSZip) | OOXML parts, heading styles, numbering, table grid, media |
| ODT | `odt.ts` (JSZip) | stored `mimetype` first, manifest, styles, pictures |
| RTF | `rtf.ts` | Unicode `\uN?` escapes, emphasis groups |
| HTML | `htmlDocument.ts` | standalone file with the editor CSS |
| Markdown | `markdown.ts` | headings, emphasis, lists, quotes, tables, links |
| TXT | `index.ts` | plain text with list bullets |

Import mirrors it: `services/import/convert.ts` dispatches on extension, converts to
Notely HTML, sanitises, and the UI creates a note from the result. `index.ts` adds the
Expo document picker; `convert.ts` stays platform-free so it is unit-tested in Node.

File delivery is split by platform (`files.ts` / `files.native.ts` / `files.web.ts`) so
Metro picks the right implementation and Node tests never import native modules.

## Cloud sync (optional)

`src/services/supabase.ts` is a deliberately small PostgREST client (ping, upsert, pull,
delete) and `src/services/sync.ts` is the engine:

1. **Pull** rows with `updated_at > last_pull_at`, apply last-write-wins per document.
   When a remote row is newer *and* the local copy had unsynced edits, the local copy is
   snapshotted into version history before being replaced — a conflict never loses text.
2. **Push** documents whose `sync_state` is `local`/`pending` in batches of 50, then mark
   them `synced` and advance the watermark past the timestamps we just uploaded.
3. **Tombstones**: deletions travel as `deleted_at`, so an offline device trashes the note
   instead of resurrecting it.

Watermarks, the device id and the last result live in `sync_meta` (migration 5). The
project URL and workspace id are stored there too; the anon key and sync token live in the
platform keychain. `supabase/schema.sql` creates the table and an RLS policy that only
accepts requests carrying the token — the anon key is public by design, the token is the
workspace password.

Conflicts, failures and counts are surfaced verbatim in Settings → Cloud sync; background
sync (opt-in) runs after the first paint and never blocks it.

## Scanning, OCR and speech

- `src/services/scan.ts` — capture N pages (camera via expo-image-picker), optionally run
  OCR per page, then emit note HTML (`<h3>Page n</h3><img …>` plus recognised paragraphs).
  The capture function is injected, so the pipeline is unit-tested without a camera.
- `src/services/ocr.ts` — ML Kit text recognition through `expo-mlkit-ocr`, all on-device.
  Availability is reported per platform; failures keep the image and surface the message.
- `src/services/voice.ts` — `expo-speech-recognition` on Android/iOS (permission request,
  interim + final results, human-readable errors) and the browser SpeechRecognition API on
  web. Both share one session interface.

## Security

- PIN: 4–8 digits, salted and hashed (expo-crypto) into SecureStore. Never in SQLite,
  never in backups. `verifyPin` and biometrics gate the app on cold start and on resume.
- Lock state is a Zustand store (`useLockStore`); `_layout.tsx` renders `LockScreen`
  instead of the app while locked.
- Imported and pasted HTML is sanitised with an explicit allow-list of tags/attributes
  and URL schemes, both on import and inside the editor shell.
- Diagnostics record scopes, messages and counts — never note content.

## Web build

`sql.js` (SQLite compiled to WebAssembly) implements the same `SqlDatabase` interface as
`expo-sqlite`. `scripts/vendor-web-assets.mjs` copies `sql-wasm.js`/`sql-wasm.wasm` into
`public/`, `app/+html.tsx` loads the engine, and `sqljs.web.ts` persists the database bytes
to IndexedDB (localStorage fallback) with debounced writes. Migrations, repositories and
tests are byte-for-byte the same code as native.

## Testing strategy

| Suite | Environment | Covers |
| --- | --- | --- |
| `schema.test.ts` | node + sql.js | migrations, constraints, indexes, FTS triggers |
| `repositories.test.ts` | node + sql.js | CRUD, trash/purge, search, versions, stats, events |
| `editor.test.ts` | jsdom | the shipped editor shell: sanitisation, tables, TOC, footnotes, find/replace, page setup |
| `export.test.ts` | node | every format, ZIP structure (OOXML/ODF), images, file names |
| `import.test.ts` | node | Markdown/DOCX/ODT round trips, sanitisation, error messages |
| `backup.test.ts` | node + sql.js | counts, merge/replace, malformed input, archive round trip |
| `utils.test.ts` | node | text metrics, sanitizer, diff, charts, spellcheck, image metadata |
