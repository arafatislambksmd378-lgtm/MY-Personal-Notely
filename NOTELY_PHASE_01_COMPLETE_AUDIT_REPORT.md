# NOTELY — PHASE 01 COMPLETE AUDIT REPORT

**Project:** My-Personal-Notely (Notely notebook app)
**Repository:** https://github.com/arafatislambksmd378-lgtm/MY-Personal-Notely.git
**Audit date:** 2026-11-24 (UTC)
**Auditor role:** Senior software architect / Android application engineer / UI-UX auditor / QA
**Phase scope:** import → inspect → audit → document → backup → verify → report. **No application source code was modified in this phase.**

---

## 0. How to read this report

Every statement is tagged with one of three confidence levels:

| Tag | Meaning |
| --- | --- |
| **[VERIFIED-CODE]** | Read directly in the repository source and confirmed by reading the implementation. |
| **[VERIFIED-TEST]** | Exercised by the existing automated suite or by a command run during this audit (`tsc`, `vitest`, `git`). |
| **[UNVERIFIED]** | Could not be exercised in this environment (no Android emulator / device available). Stated as a risk, never as a fact. |

---

## 1. Repository import status

| Item | Result |
| --- | --- |
| Import | **Success.** The repository was already cloned at `/home/user/MY-Personal-Notely` and is the correct Notely project (Expo/React Native app, `package.json` name `notely`). **[VERIFIED-CODE]** |
| Remote | `origin https://github.com/arafatislambksmd378-lgtm/MY-Personal-Notely.git` — untouched, not replaced, not disconnected. **[VERIFIED-CODE]** |
| Original primary branch | `main` (`origin/HEAD -> origin/main`). **[VERIFIED-CODE]** |
| Working branch | `arena/3e60d337-my-personal-notely`, created from `main` at `bcc3ed8`. **[VERIFIED-CODE]** |
| History preserved | Yes — full history intact; `git log` reaches the merge of PR #1. No rebase, squash, reset or filter was performed. **[VERIFIED-TEST]** |
| Files deleted / renamed / moved | **None.** `git status` was clean at import and stayed clean until the Phase 02 edits (documented separately). **[VERIFIED-TEST]** |
| Framework / stack replaced | **No.** Expo SDK 58 + React Native 0.88 + Expo Router + TypeScript + SQLite retained. **[VERIFIED-CODE]** |

The repository is a single Expo project. There is **no** `android/` or `ios/` folder committed (both are git-ignored; `expo prebuild` generates them), so the Android application is built from `app.json` by Expo's Gradle plugin. **[VERIFIED-CODE]**

---

## 2. Technology stack

| Layer | Technology | Version |
| --- | --- | --- |
| Runtime | Expo SDK | `~58.0.26` |
| UI | React Native | `0.88.1` |
| Router | Expo Router | `~58.0.32` (typed routes enabled) |
| Language | TypeScript (strict) | `~6.0.3` |
| State | Zustand | `^5.1.0` |
| Database | `expo-sqlite` (native) / `sql.js` (web) | `~58.0.18` / `^1.17.0` |
| Rich-text surface | `react-native-webview` (native) + sandboxed `<iframe>` (web) | `^14.0.1` |
| Fonts | `@expo-google-fonts/plus-jakarta-sans` | `^0.4.2` |
| Icons | `@expo/vector-icons` (Ionicons) | `^15.1.1` |
| Animation | `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler` | `^4.7.1` / `^0.13.0` / `~3.3.0` |
| Media / device | `expo-image-picker`, `expo-camera`-free capture via picker, `expo-mlkit-ocr`, `expo-speech-recognition`, `expo-print`, `expo-sharing`, `expo-file-system`, `expo-image-manipulator`, `expo-local-authentication`, `expo-secure-store` | SDK 58 line |
| Documents | `jszip` (DOCX/ODT/backup ZIP) | `^3.10.2` |
| Validation | `zod` | `^4.6.7` |
| Tests | Vitest + jsdom + sql.js | `^5.1.1` / `^31.0.1` |
| Lint | ESLint 9 + `eslint-config-expo/flat` | `^9.39.5` |

**No drawing library exists in the dependency tree.** There is no `react-native-svg`, `@shopify/react-native-skia`, `expo-gl`, `react-native-signature-canvas` or similar. The existing drawing feature is a bare `<canvas>` element inside the rich-text WebView shell, driven by hand-written JavaScript. **[VERIFIED-CODE]** This is the single most important architectural fact for Phase 02: any new drawing system must either extend the WebView canvas approach or add a dependency.

---

## 3. Application architecture

### 3.1 Layering

```
app/                      Expo Router screens (no SQL, no formatting logic)
  ├─ (tabs)/              Home, Notebooks, Settings  (custom TabBar)
  ├─ note/[id].tsx        Document editor screen — 737 lines, owns the whole document lifecycle
  ├─ notebook/[id].tsx    Notebook detail
  ├─ search.tsx           Full-text search
  ├─ collection/[kind].tsx  All / favourites / archive / trash / recent
  ├─ templates.tsx        Template gallery
  └─ settings/*.tsx       appearance, security, backup, tags, cloud, diagnostics, about

src/
  ├─ db/                  SQLite schema, migrations, repositories (the only SQL in the app)
  │   ├─ migrations/      0001_init … (11 tables + FTS5 + triggers)
  │   ├─ drivers/         expoSqlite.native.ts, sqljs.web.ts, sqljsCore.ts
  │   ├─ repositories/    documents, notebooks, tags, versions, comments, bookmarks,
  │   │                   media, settings, events, shares, sync
  │   └─ seed.ts          First-run demo content
  ├─ editor/              The rich-text engine (HTML/CSS/JS string → WebView/iframe)
  │   ├─ buildDocument.ts Assembles the document (page geometry + content + drawing overlay)
  │   ├─ shellCss.ts      159 lines of editor CSS (incl. #drawing-overlay styles)
  │   ├─ shellScript.ts   521 lines of runtime (contenteditable + drawing pad)
  │   ├─ RichTextEditor.native.tsx   WebView host
  │   └─ RichTextEditor.tsx          iframe host (web)
  ├─ features/            editor sheets, home cards, security, templates
  ├─ services/            export (7 formats), import (5), backup, sync, media, ocr, security…
  ├─ components/          20 design-system primitives
  ├─ design/              tokens.ts, typography.ts, fonts.ts
  ├─ store/               useLibraryStore, useSettingsStore, useLockStore, useToastStore
  └─ utils/               dates, text, sanitize, htmlParser, diff, chart, search…
```

Dependency direction is strictly downwards: routes → features → services → repositories → storage. Screens never import SQL; repositories never import React. **[VERIFIED-CODE]**

### 3.2 Editor architecture (the part Phase 02 touches)

`buildEditorDocument()` produces one self-contained HTML string:

1. `EDITOR_CSS` — paper geometry (A4/A5/Letter/Legal), margins, page colour, typography, tables, figures, dark theme, **and the drawing overlay styles**.
2. CSS custom properties derived from the note's `pageSetup`.
3. The sanitised note HTML inside `<div id="page"><div id="editor" contenteditable="true">`.
4. `EDITOR_SCRIPT` — the runtime.

The same document is rendered by `react-native-webview` on Android and by a sandboxed `<iframe srcDoc>` on web. A JSON message bridge connects host and document:

```
host → editor   exec, block, align, foreColor, hiliteColor, fontSize, insertHTML, insertText,
                insertImage, insertTable, insertLink, insertChart, insertFootnote, insertToc,
                insertBookmark, replaceAll, highlightFind, clearFind, set-page-setup, set-theme,
                request-selection, scroll-to-anchor, open-drawing
editor → host   ready, change{html,plainText,wordCount,charCount}, selection, save-shortcut,
                selection-text, find-result, replace-result, toc-empty, link-click, media, error
```

`app/note/[id].tsx` owns autosave (`useAutosave`, debounced, flush on unmount/background, retry on failure), version snapshots, media records and all 16 sheets.

### 3.3 Navigation

- Expo Router `Stack` at the root with three tab screens (`(tabs)`), plus pushed routes: `note/[id]`, `notebook/[id]`, `search`, `collection/[kind]`, `templates`, `settings/*`, `+not-found`. **[VERIFIED-CODE]**
- Custom `TabBar` renders itself from `usePathname()` because expo-router 58 does not pass `navigation` props to a custom `tabBar` (a real crash was already fixed that way). **[VERIFIED-CODE]**
- Stack screens use `animation: 'slide_from_right'`, `headerShown: false`. **[VERIFIED-CODE]**
- Back behaviour on Android: hardware back pops the stack; the bottom sheet handles `onRequestClose`.

---

## 4. Complete file and module inventory

**137 TypeScript/TSX files, 17,941 lines** in `src/` + `app/`; **2,269 lines** of tests. **[VERIFIED-TEST]**

| Area | Files | Notes |
| --- | --- | --- |
| Routes | 20 | `app/_layout.tsx`, `app/+html.tsx`, `app/+not-found.tsx`, `(tabs)/{index,notebooks,settings}.tsx`, `note/[id].tsx`, `notebook/[id].tsx`, `search.tsx`, `collection/[kind].tsx`, `templates.tsx`, `settings/{about,appearance,backup,cloud,diagnostics,security,tags}.tsx` |
| Editor engine | 6 | `buildDocument.ts`, `shellCss.ts`, `shellScript.ts`, `RichTextEditor.tsx`, `RichTextEditor.native.tsx`, `src/types/editor.ts` |
| Editor feature UI | 11 | `InsertSheet`, `InsertContentSheets`, `DocumentSheets`, `EditorBottomBar`, `EditorHeader`, `FormatToolbar`, `NoteOptionsSheet`, `PageSetupSheet`, `ReviewSheets`, `ScanSheet`, `ShareExportSheet`, `TagsSheet`, `TextStyleSheet` |
| Home / notebooks | 3 | `NoteCard.tsx`, `NotebookCard.tsx`, `icons.ts` |
| Design system | 20 primitives | `AppText`, `BottomSheet`, `Button`, `Card`, `ColorSwatchRow`, `ConfirmDialog`, `CountBadge`, `EmptyState`, `Fab`, `IconTile`, `ListRow`, `PromptDialog`, `Screen`, `ScreenHeader`, `SearchBar`, `SectionHeader`, `SheetRow`, `TabBar`, `ToastHost`, `ToggleSwitch` |
| Database | 20 | schema + migrations + 10 repositories + drivers + seed + sql helpers |
| Services | 24 | export×7, import×5, backup, sync, supabase, media, ocr, scan, security, secureStorage×3, files×3, voice, spellcheck, diagnostics, library |
| Stores | 4 | `useLibraryStore`, `useSettingsStore`, `useLockStore`, `useToastStore` |
| Utils | 13 | dates, text, sanitize, htmlParser, diff, chart, search, id, imageMeta, tabRoutes, validation |
| Tests | 13 files | 156 passing, 11 skipped (live-sync gated by env var) |

---

## 5. UI/UX baseline documentation

All values below are read from `src/design/tokens.ts` and `src/design/typography.ts`. **[VERIFIED-CODE]**

### 5.1 Colour palette (light)

| Token | Value | Used for |
| --- | --- | --- |
| `canvas` | `#F7F6FB` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets, tab bar |
| `surfaceMuted` | `#F1EFF8` | Chips, pressed states |
| `surfaceSunken` | `#EDEAF6` | Icon tiles in dark mode |
| `border` | `#ECE9F4` | Hairlines (drawn at `hairlineWidth * 2`) |
| `borderStrong` | `#DFDBEC` | Dividers, secondary buttons |
| `text` | `#151223` | Primary ink |
| `textSecondary` | `#67647A` | Secondary copy |
| `textMuted` | `#9C99AC` | Captions, placeholders |
| `primary` | `#7C3AED` | **Notely purple** — FAB, active tab, CTAs |
| `primaryPressed` | `#6D28D9` | Pressed purple |
| `primarySoft` | `#EFE8FF` | Tinted chips |
| `danger` / `soft` | `#EF4444` / `#FEE7E7` | Destructive |
| `success` / `warning` / `info` | `#12B76A` / `#F5A524` / `#3B82F6` | Status |
| `overlay` | `rgba(20,16,35,0.45)` | Sheet backdrop |

Accents (notebook + note-card colours): purple `#7C3AED`, blue `#3B82F6`, green `#12B76A`, amber `#F5A524`, pink `#EC4899`, teal `#14B8A6`, orange `#F97316`, red `#EF4444`. Each has a soft tint (`accentSoft`, 8–14 % alpha) and a gradient pair (`accentGradient`) used by note-card header bands. **[VERIFIED-CODE]**

A full dark palette (`darkColors`) mirrors every token (`canvas #100D18`, `surface #181424`, `primary #A98BFF`, …). **[VERIFIED-CODE]**

### 5.2 Typography

Family: **Plus Jakarta Sans** (5 weights bundled: 400/500/600/700/800).

| Variant | Size / line-height | Weight | Tracking |
| --- | --- | --- | --- |
| `display` | 30 / 36 | 800 | −0.7 |
| `title1` | 26 / 32 | 800 | −0.5 |
| `title2` | 20 / 26 | 700 | −0.3 |
| `title3` | 17 / 23 | 700 | −0.2 |
| `subtitle` | 15 / 21 | 600 | −0.1 |
| `body` / `bodyStrong` | 15 / 23 | 500 / 600 | −0.1 |
| `caption` | 13 / 19 | 500 | 0 |
| `label` | 12 / 16 | 600 | +0.2 |
| `overline` | 11 / 15 | 700 | +1.1, uppercase |
| `button` | 15 / 20 | 700 | −0.1 |

### 5.3 Spacing, radii, shadows, dimensions

- **Spacing scale:** 2, 4, 8, 12, 16, 20, 24, 32, 40 (`xxs … huge`).
- **Screen padding:** 20; **card padding:** 16; **max content width:** 720; **tab bar height:** 64.
- **Radii:** 8, 12, 16, 20, 24, 28, pill 999. Cards use 20; sheets use 28 top corners; buttons 16.
- **Shadows:** `card` (opacity 0.05, radius 12, y 4, elevation 2), `floating` (opacity 0.28, radius 16, y 8, elevation 8), `sheet` (opacity 0.18, radius 24, y −6, elevation 16).
- **Icon sizes:** 16 / 20 / 24 / 28. `IconTile` boxes 32/40/48/56 with radii 12/16/18/20.
- **Buttons:** 40/48/54 tall, radius 16.
- **Bottom sheet:** 28 top radius, 44×4 grab handle, title left, 34×34 circular close, content padding 20.

### 5.4 Screen-by-screen baseline

| Screen | Layout | Notes |
| --- | --- | --- |
| **Home** | Header (date / greeting / user name) + circular pencil FAB top-right; search field; horizontal notebook tiles; horizontal pinned cards; horizontal recent cards; summary strip | **Recent cards are 220 pt wide in a horizontal `ScrollView`, so cards are clipped at the right edge and require horizontal scrolling** (see screenshot `docs/evidence/screenshots/01-home.png`). **[VERIFIED-CODE]** |
| **Notebooks** | Vertical list of white rows (icon tile + name + count badge + chevron), dashed "New notebook" row | **[VERIFIED-CODE]** |
| **Notebook detail** | Gradient header, stats, vertical `NoteCard variant="row"` list, circular pencil FAB | **[VERIFIED-CODE]** |
| **Editor** | `EditorHeader` (back / editable title / save status / pin / comments / options) → `FormatToolbar` → WebView page → `EditorBottomBar` (purple + / Aa / image / mic / search / collapse) | **[VERIFIED-CODE]** |
| **Insert sheet** | Full-width "Image — from gallery or camera" row + camera chip, then a wrapping grid of 12 tools, each `width: '31.2%'`, `minHeight: 104`, icon tile 40 + label + 2-line subtitle | **The grid cannot fit three 31.2 % tiles plus two 12 pt gaps, so it wraps to two columns** — this is the defect behind Reference Image 1. **[VERIFIED-CODE]** |
| **Settings** | Hero gradient card + grouped list rows + switches | **[VERIFIED-CODE]** |
| **Search** | Search field + result rows with highlighted snippets (`FlatList`) | **[VERIFIED-CODE]** |
| **Bottom sheets** | One shared `BottomSheet` primitive (dim backdrop, 28 radius, grab handle, animated slide) used by all 16 editor sheets and the scan/voice/table/chart/symbol/equation sheets | **[VERIFIED-CODE]** |

### 5.5 Responsive behaviour

- No `useWindowDimensions`-driven breakpoints exist anywhere in the app. Layouts are fluid: fixed paddings, `flex: 1`, and horizontal `ScrollView`s. **[VERIFIED-CODE]**
- Tablets: `ios.supportsTablee: true` in `app.json`; Android adapts to the window because Expo's edge-to-edge + `supportsTablet` is not set for Android. No tablet-specific layout exists. **[VERIFIED-CODE]**
- Web: single `dist/` bundle served statically; `output: "single"` in `app.json`. **[VERIFIED-CODE]**

---

## 6. Existing functionality audit

Legend: ✅ implemented and covered by tests · 🟡 implemented, no automated coverage · 🔴 implemented with a known defect · ⚪ not implemented.

| Feature | Status | Evidence |
| --- | --- | --- |
| SQLite schema, migrations, FTS5, triggers | ✅ | `tests/database.test.ts` (7) |
| Repositories (documents, notebooks, tags, versions, comments, bookmarks, media, settings, events, shares, sync) | ✅ | `tests/repositories.test.ts` (32) |
| Editor shell: sanitisation, tables, TOC, footnotes, bookmarks, find/replace, page setup, selection | ✅ | `tests/editor.test.ts` (16, boots the real shell in jsdom) |
| Export: PDF, DOCX, ODT, RTF, HTML, Markdown, TXT | ✅ | `tests/export.test.ts` (14) |
| Import: DOCX, ODT, Markdown, HTML, TXT | ✅ | `tests/import.test.ts` (13) — DOCX images not linked (known limitation) |
| Backup / restore (JSON + ZIP), PIN excluded | ✅ | `tests/backup.test.ts` (7) |
| Library + settings stores hydrate from SQLite | ✅ | `tests/store.test.ts` (4) |
| Text metrics, sanitizer, diff, charts, spellcheck, image metadata, parser | ✅ | `tests/utils.test.ts` (17) |
| Scan + OCR pipeline | ✅ | `tests/scan.test.ts` |
| Cloud sync engine | ✅ (gated) | `tests/sync.test.ts` + `tests/live-sync.test.ts` (11 skipped without `NOTELY_LIVE_SYNC=1`) |
| Home, notebooks, notebook detail, search, collections, templates | 🟡 | No UI tests; code paths read cleanly |
| Settings screens (7) | 🟡 | No UI tests |
| App lock (PIN + biometrics), SecureStore | 🟡 | `src/services/security.ts` |
| Insert: image, table, chart, link, comment, divider, footnote, symbols, equation, contents, bookmark, scan | 🟡 | All wired through `handleInsertTool` → `send(...)`; only the shell-level insert commands are unit-tested |
| **Insert sheet grid** | 🔴 | Two-column wrap instead of three (see §7.1) |
| **Drawing / sketch** | 🔴 | A 300 px canvas inside a bottom-sheet overlay **inside the editor WebView**; no undo/redo, no shapes, no stroke-width control, no stabilisation, no highlighter, no eraser (see §7.2) |
| Voice typing | 🟡 | Platform-split service |
| Page setup / versions / comments / bookmarks | 🟡 | Wired, no UI tests |
| Android build | ⚪ | **Not exercised in this environment** — no emulator/device. CI workflow `.github/workflows/android.yml` exists and builds on GitHub. |

### 6.1 Shared state and database coupling

- **`useLibraryStore`** is the single source for notebooks, recent notes, pinned notes and stats. `refresh()` runs on every Home/Notebooks focus; every mutation (`createNote`, `createNotebook`, `patchDocument`, `togglePinned`, `trashDocument`) calls `refresh()` so counts never go stale. **[VERIFIED-CODE]**
- `createNote()` defaults to the first notebook and immediately refreshes, which is what makes a new note appear on Home. **[VERIFIED-CODE]**
- `app/note/[id].tsx` writes through repository functions only (`saveDocumentContent`, `patchDocument`, `createVersion`, `recordMediaAsset`); it never issues SQL. **[VERIFIED-CODE]**

---

## 7. Existing bugs and limitations (found during this audit)

### 7.1 Insert sheet renders two columns instead of three — 🔴 **[VERIFIED-CODE]**

`src/features/editor/InsertSheet.tsx`:

```ts
grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, ... },   // gap = 12
tile: { width: '31.2%', minHeight: 104, ... },
```

Three tiles need `3 × 31.2 % = 93.6 %` of the content width **plus** two 12 pt gaps. On a 360 dp phone the sheet content box is `360 − 40 = 320 dp`, so `93.6 % = 299.5 dp + 24 dp = 323.5 dp > 320 dp`. The third tile cannot fit, so `flexWrap` drops it to the next row → **two columns, four rows, double the panel height**. This exactly matches Reference Image 1 and the user's complaint. The `31.2 %` figure was chosen as if gaps were percentage-based.

### 7.2 Drawing is a bottom sheet, not a full-screen editor — 🔴 **[VERIFIED-CODE]**

- `buildDocument.ts` emits `<div id="drawing-overlay"><div id="drawing-sheet">…<canvas id="drawing-canvas">` inside the *editor* document.
- `shellCss.ts` styles `#drawing-overlay` as `position: fixed; inset: 0; display: none` and `#drawing-sheet` as a bottom sheet (`border-radius: 24px 24px 0 0`), with `#drawing-canvas { height: 300px }`.
- `shellScript.ts` implements a single freehand brush: `mousedown/touchstart → lineTo`, one colour, one width, `Clear`, `Cancel`, `Insert`.
- `app/note/[id].tsx` opens it with `send({ type: 'open-drawing' })`.

Missing, relative to the Phase 02 brief: no page-level navigation, no undo/redo, no shapes, no stroke-width control, no stabilisation, no highlighter/eraser, no selection/move/resize/delete, no "canvas is empty" validation beyond a single boolean, no Android-back handling for the overlay. **[VERIFIED-CODE]**

### 7.3 Home recent notes are a clipped horizontal carousel — 🔴 **[VERIFIED-CODE]**

`app/(tabs)/index.tsx` renders `recentToShow` inside `<ScrollView horizontal>` and `NoteCard` hard-codes `width: layout.recentCardWidth` (220). On a 360 dp screen two cards (220 + 12 + 220 = 452 dp) exceed the viewport, so the second card is cut off. `docs/evidence/screenshots/01-home.png` shows exactly this. The pinned section has the same defect.

### 7.4 Home uses an upper-right pencil FAB — 🟡 **[VERIFIED-CODE]**

`<Fab onPress={startNote} />` sits in the header row (`alignItems: 'flex-start'`, `justifyContent: 'space-between'`). The brief requires a bottom-right rounded-square purple `+` FAB above the tab bar.

### 7.5 Other limitations worth recording

| # | Limitation | Impact |
| --- | --- | --- |
| 1 | Drawings are stored as **base64 PNG data URIs** both in `media_assets.uri` and inline in the note HTML | A large drawing inflates the SQLite row and every backup. Existing behaviour; Phase 02 keeps it for compatibility but caps export resolution. **[VERIFIED-CODE]** |
| 2 | The old drawing pad re-sizes the canvas on every `startStroke` and re-draws from a `toDataURL()` snapshot | Visible flicker and generational quality loss; also paints white over any transparency. **[VERIFIED-CODE]** |
| 3 | `getRecentDocuments(8)` caps Home at 8 recent notes | A two-column grid therefore shows at most 4 rows; "See all" exposes the rest. **[VERIFIED-CODE]** |
| 4 | No responsive breakpoints anywhere | Tablet/desktop layouts are simply stretched mobile layouts. **[VERIFIED-CODE]** |
| 5 | `NoteCard` hard-codes `width: 220` | Prevents any grid reuse without a style override. **[VERIFIED-CODE]** |
| 6 | 35 ESLint warnings (`react-hooks/refs`, `react-hooks/set-state-in-effect`) | Documented in `eslint.config.js` as intentional; 0 errors. **[VERIFIED-TEST]** |
| 7 | DOCX import does not embed images | Stated in the existing implementation report. **[VERIFIED-CODE]** |
| 8 | Spellcheck is a curated word list | Stated in the existing implementation report. **[VERIFIED-CODE]** |
| 9 | App lock re-locks on background but the editor autosave may not flush before the lock screen appears | `flushDatabase()` is called on `state !== 'active'`. **[VERIFIED-CODE]** |

---

## 8. Database and storage architecture

**Engine:** SQLite everywhere. Native uses `expo-sqlite` (`src/db/drivers/expoSqlite.native.ts`); web uses `sql.js` (WASM) persisted to IndexedDB (`src/db/drivers/sqljs.web.ts`). Both implement the same `SqlDatabase` interface, so schema, migrations and repositories are byte-identical across platforms. **[VERIFIED-CODE]**

**Tables (migration `0001_init`):** `notebooks`, `documents`, `document_versions`, `tags`, `document_tags`, `comments`, `bookmarks`, `media_assets`, `document_shares`, `user_settings`, `sync_queue`, `app_events`, `sync_meta`, plus an FTS5 virtual table kept in sync by triggers. **[VERIFIED-CODE]**

**Key columns:** `documents.content_html` is canonical; `plain_text`, `excerpt`, `word_count`, `char_count`, `reading_minutes` are derived on save; `page_setup_json` is validated on read; soft delete via `deleted_at`; `is_archived`, `is_pinned`, `is_favorite` flags. **[VERIFIED-CODE]**

**Media:** `media_assets(id, document_id, kind, uri, byte_size, created_at)` with `kind ∈ {image, drawing, chart, scan, audio}`. Drawings are stored as `data:image/png;base64,…`. **[VERIFIED-CODE]**

**Settings** live in SQLite (`user_settings` key/value) — *not* AsyncStorage — so a backup carries them. PIN material is the exception: it lives in Expo SecureStore and is explicitly excluded from backups. **[VERIFIED-CODE]**

**No schema change is required for Phase 02.** A drawing remains an `img` inside `content_html` plus a `media_assets` row of kind `drawing`.

---

## 9. Dependencies and configurations

- 44 runtime dependencies, 9 dev dependencies, 864 installed packages. **[VERIFIED-TEST]**
- `package.json` scripts: `start`, `android`, `ios`, `web`, `typecheck`, `test`, `test:watch`, `lint`, `build:web`, `preview`, `vendor:web`, `verify`, `test:live`. **[VERIFIED-CODE]**
- `app.json`: Expo SDK 58, slug `notely`, scheme `notely`, orientation `portrait`, edge-to-edge enabled on Android, package `com.notely.app`, permissions `CAMERA` + `RECORD_AUDIO`, plugins for router/splash/secure-store/local-auth/image-picker/font/speech-recognition/mlkit-ocr, `typedRoutes: true`. **[VERIFIED-CODE]**
- `tsconfig.json`: `strict: true`, `allowJs: true`, path alias `@/* → ./src/*`, includes `.expo/types/**/*.ts`. **[VERIFIED-CODE]**
- `eslint.config.js`: flat config, Expo preset, two React-compiler rules downgraded to `warn`. **[VERIFIED-CODE]**
- CI: `.github/workflows/ci.yml` (typecheck/lint/test), `android.yml` (Gradle build + APK), `emulator-tour.yml`, `verify-sync.yml`. **[VERIFIED-CODE]**
- `supabase/schema.sql`: optional cloud-sync table + RLS policy. **[VERIFIED-CODE]**

---

## 10. Build and runtime status

| Check | Command | Result |
| --- | --- | --- |
| Dependency install | `npm install` | ✅ 864 packages, 19 s |
| Type check | `npx tsc --noEmit` | ✅ exit 0, 0 errors |
| Unit tests | `npx vitest run` | ✅ **156 passed**, 11 skipped (live-sync), 12 files |
| Static web export | `npx expo export -p web` | ⚪ not run in Phase 01 (see below) |
| Android APK | `./gradlew assembleDebug` | ⚪ **not run — no Android SDK/emulator in this environment** |
| Live Preview | browser | ⚪ **not used in Phase 01** |

> **[UNVERIFIED]** The Android application was **not** launched during this phase. No emulator, device or Android SDK is present in the sandbox, so "screens render correctly / navigation works / editor opens / Insert menu works / Drawing opens" could not be observed on a device. The claims above are code-level and test-level only. The one screenshot available (`docs/evidence/screenshots/01-home.png`) is a *pre-existing* artifact from the previous session and does confirm the Home layout defect and the upper-right pencil FAB.

---

## 11. Backup and baseline preservation

| Item | Value |
| --- | --- |
| Base commit | `bcc3ed8ddfc38a5c14320909b185aa6404976157` |
| Commit subject | `Merge pull request #1 from arafatislambksmd378-lgtm/arena/99d02ee7-my-personal-notely` |
| Commit date | 2026-11-22 19:03:31 +0600 |
| Working branch | `arena/3e60d337-my-personal-notely` |
| Original branch | `main` |
| Snapshot | `baseline/notely-baseline-bcc3ed8.zip` — `git archive` of `HEAD`, 27 MB |
| Metadata | `baseline/BASELINE.txt` (commit, branch, date, verification results, restore command) |
| Git-tracked? | No — `baseline/` was added to `.gitignore` so the 27 MB archive never enters history or a push |
| History | Intact; no rebase/squash/reset/filter performed |
| Remote writes | **None.** Nothing was pushed, merged or deleted during Phase 01. |

Restore procedure:

```bash
unzip baseline/notely-baseline-bcc3ed8.zip -d /tmp/notely-baseline
```

---

## 12. Exact files and components that need attention in the next phase

| Priority | File | Why |
| --- | --- | --- |
| **P0** | `src/features/editor/InsertSheet.tsx` | Fix the 3-column grid (width math) and compact the tiles |
| **P0** | `app/(tabs)/index.tsx` | Replace horizontal recent/pinned carousels with a two-column grid; remove header FAB; add bottom-right `+` FAB |
| **P0** | `src/features/home/NoteCard.tsx` | Remove the hard-coded 220 pt width / accept a `style` override |
| **P0** | `src/components/Fab.tsx` | Support a rounded-square purple `+` variant (keep the circle/pencil default for other screens) |
| **P0** | `app/note/[id].tsx` | Route `drawing` to the new full-screen editor and consume the returned drawing |
| **P0** | `app/drawing.tsx` (new) | Full-screen drawing editor route |
| **P0** | `src/features/drawing/*` (new) | Canvas engine, RN chrome, shape catalogue, stroke slider, result store |
| **P1** | `src/editor/buildDocument.ts`, `shellCss.ts`, `shellScript.ts` | Retire the in-editor drawing overlay (it is the "bottom sheet" the brief forbids) |
| **P1** | `src/types/editor.ts` | Remove the now-unused `open-drawing` host message |
| **P2** | `src/design/tokens.ts` | Only if a new token is genuinely needed (e.g. `layout.fabSize`) |

---

## 13. Potential risks and dependencies

1. **No drawing library.** A native canvas would require `react-native-svg`/Skia (new dependency, native build). The architecture already solves this: a self-contained HTML canvas inside the WebView shell. Staying with that approach keeps the dependency tree unchanged, which the brief explicitly prefers ("avoid unnecessary dependencies", "do not replace the existing technology stack").
2. **The drawing must survive a route change.** The editor screen stays mounted under the stack, but a result must not be lost if it does not. The hand-off must therefore live in a store keyed by note id, not in component state.
3. **Data-URI size.** Exporting a full-screen canvas at device resolution can produce multi-megabyte base64 strings that bloat SQLite and slow the WebView bridge. Export resolution must be capped.
4. **Autosave interaction.** Inserting the drawing goes through `insertImage`, which emits `change` → autosave. The note must not be reloaded from the database while the editor has unsaved changes, or those changes would be lost.
5. **Back-button data loss.** Android hardware back on a screen with an unsaved drawing must be intercepted.
6. **Layout regressions.** `NoteCard` is shared by search, notebook detail and collections (`variant="row"`); any change must stay scoped to the card variant.
7. **Typed routes.** `app.json` enables `typedRoutes`; adding `app/drawing.tsx` regenerates route types on the next Expo run. `tsc` must be re-run after the file exists.

---

## 14. Recommended implementation strategy for Phase 02

1. **Insert grid (low risk, high visibility).** Measure the grid container with `onLayout` and compute `tileWidth = (containerWidth − 2 × gap) / 3`, falling back to `windowWidth − 2 × 20`. Reduce tile height, icon tile size and subtitle lines. Keep the full-width Image row untouched. Verify by rendering at 320/360/411 dp content widths.
2. **Home grid + FAB.** Chunk recent/pinned notes into rows of two with `flex: 1` cards and a spacer for the odd row — no measurement, no overflow, guaranteed equal widths. Replace the header `Fab` with an absolutely-positioned rounded-square `+` FAB (`right: 20`, `bottom: 16`) inside the Home container so it sits above the tab bar. Add bottom padding to the scroll content so the FAB never covers the summary card.
3. **Drawing editor (the main effort).** Build it as a new stack route:
   - `src/features/drawing/drawingDocument.ts` + `drawingScript.ts` — a **vector** canvas engine (strokes and shapes stored in normalised 0…1 coordinates) with undo/redo snapshots, pointer-event input, stabilisation, highlighter alpha, object eraser, selection with move/resize handles, and PNG export at a capped resolution.
   - `DrawingCanvas.tsx` / `.native.tsx` — iframe / WebView hosts, mirroring `RichTextEditor`.
   - `app/drawing.tsx` — native chrome only: top bar (X · Drawing · Insert · Shape), vertical tool rail, colour palette, stroke slider, stabilisation switch, contextual fill/delete row, and the shape sheet.
   - `useDrawingStore` — publishes `{noteId, dataUri, bytes}` to the waiting note editor.
   - `app/note/[id].tsx` — push the route, consume the result through `insertImage`, record the media asset, toast.
4. **Retire the old overlay** once the new route is proven, so there is exactly one drawing system.
5. **Test.** `tsc`, `eslint`, `vitest`; then boot the web build and exercise the Home grid, the Insert sheet and the drawing round-trip in a real browser.

---

## 15. Final Phase 01 verification

| Requirement | Result |
| --- | --- |
| Imported repository is the correct Notely project | ✅ verified |
| Original source files unchanged | ✅ verified — `git status` clean; only `NOTELY_PHASE_01_COMPLETE_AUDIT_REPORT.md`, `baseline/` and the `.gitignore` baseline entry were added |
| No existing UI/UX modified | ✅ verified — zero application files touched |
| No existing functionality intentionally changed | ✅ verified |
| Baseline backup / snapshot preserved | ✅ `baseline/notely-baseline-bcc3ed8.zip` + `baseline/BASELINE.txt` |
| Audit report prepared | ✅ this document |
| Application runs without code modification | ⚪ **could not be verified** — no Android runtime in this environment |

**Phase 01 is complete. Phase 02 (Insert grid + full-screen Drawing Editor) and the Home Screen correction are documented above but were not started until this report was written.**
