# Notely — implementation report

**Branch:** `arena/99d02ee7-my-personal-notely`
**Stack:** Expo SDK 58 · React Native 0.81 · Expo Router 6 · TypeScript 5 (strict) · SQLite (expo-sqlite / sql.js)
**Size:** 128 TypeScript files, ~16,200 lines of app code, ~1,250 lines of tests
**Verification:** `tsc --noEmit` clean · ESLint 0 errors (35 known warnings) · **102 tests passing** · static web build exports successfully and serves over HTTP

---

## 1. What was delivered

A complete, offline-first notebook and document editor that runs on Android, iOS and the web
from one codebase. The work is organised in layers with no upward dependencies:

| Area | Status | Where |
| --- | --- | --- |
| Local database, migrations, seed | done | `src/db/` |
| Repositories (documents, notebooks, tags, versions, comments, bookmarks, media, settings, events, shares) | done | `src/db/repositories/` |
| Design system (tokens, typography, 19 primitives) | done | `src/design/`, `src/components/` |
| Rich-text editor shell + WebView/iframe bridges | done | `src/editor/` |
| Editor screen with 16 sheets/actions (incl. tags, favourites, archive) | done | `app/note/[id].tsx`, `src/features/editor/` |
| Home, notebooks, notebook detail | done | `app/(tabs)`, `app/notebook/[id].tsx` |
| Settings root + 7 sub-screens | done | `app/(tabs)/settings.tsx`, `app/settings/` |
| Search, collections, templates/import | done | `app/search.tsx`, `app/collection/[kind].tsx`, `app/templates.tsx` |
| App lock (PIN + biometrics), secure storage | done | `src/services/security.ts`, `src/features/security/` |
| Export (7 formats) | done | `src/services/export/` |
| Import (5 formats) | done | `src/services/import/` |
| Backup / restore (JSON + ZIP) | done | `src/services/backup.ts` |
| Diagnostics, spellcheck, diff, charts, media | done | `src/services/`, `src/utils/` |
| Tests | 102 passing | `tests/` |
| CI, docs, web preview server | done | `.github/workflows/ci.yml`, `docs/`, `scripts/` |

## 2. Editor

The editor is a real document surface, not a text area. `buildEditorDocument()` assembles:

- a paper-coloured page with A4/A5/Letter/Legal geometry, orientation, margins, header,
  footer and live page number, driven by CSS custom properties;
- the note HTML, sanitised with a tag/attribute allow-list on every load and insert;
- a ~520-line dependency-free runtime handling formatting, tables, images, sketches,
  charts, footnotes, symbols, equations, table of contents, bookmarks, find/replace and
  selection state.

The same markup is rendered by `react-native-webview` on device and an `<iframe srcdoc>` on
web. A JSON message bridge (`src/types/editor.ts`) keeps the editor free of app concerns;
`app/note/[id].tsx` owns autosave, version snapshots, media records and sheet state.

Autosave is debounced (default 1.2 s), flushes on unmount and on background, retries with
the payload intact after a failure, and surfaces a truthful save status. A version snapshot
is stored at most once per minute of editing.

## 3. Export and import

Export produces real files, not placeholders:

- **DOCX** — hand-written OOXML package (JSZip): `[Content_Types].xml`, document, styles,
  numbering, relationships, core/app properties, `word/media/*`. Heading styles, bullet and
  decimal numbering, table borders and embedded images are asserted by tests.
- **ODT** — `mimetype` stored first (uncompressed, as required), manifest, styles, content
  with `text:list`, tables and `Pictures/*`.
- **RTF** — Unicode escapes with proper surrogate handling, emphasis groups.
- **HTML** — standalone file with the editor stylesheet and print CSS.
- **Markdown** — headings, emphasis, strikethrough, nested lists, quotes, tables, links.
- **TXT** — plain text with list bullets.
- **PDF** — the print pipeline (`expo-print` on device, `window.print()` on web).

Import covers DOCX, ODT, Markdown, HTML and TXT, converts to Notely HTML, sanitises it and
creates a note. Markdown → HTML → Markdown and DOCX → HTML round trips are tested.

## 4. Verification performed

```
npx tsc --noEmit          → 0 errors
npx eslint .              → 0 errors, 35 warnings
npx vitest run            → 8 files, 102 tests passed
npx expo export -p web    → dist/ with 20 route bundles
node scripts/serve-web.mjs → /, /search, /templates, /settings/*, /sql.js, /sql-wasm.wasm all 200
```

Test coverage by area:

| Suite | Tests | What it proves |
| --- | --- | --- |
| `schema.test.ts` | 11 | migrations, constraints, indexes, FTS triggers |
| `repositories.test.ts` | 32 | CRUD, trash/purge, search, versions, comments, stats, events |
| `editor.test.ts` | 16 | the shipped editor shell running in jsdom: sanitisation, tables, TOC, footnotes, bookmarks, find/replace counts, page setup, selection reports |
| `export.test.ts` | 14 | every format, OOXML/ODF package structure, images, file names, unsupported formats |
| `import.test.ts` | 12 | detection, Markdown, sanitisation, DOCX/ODT round trips, corrupt files |
| `backup.test.ts` | 7 | counts, PIN exclusion, merge/replace, malformed payloads, ZIP round trip |
| `store.test.ts` | 4 | library and settings stores hydrate from SQLite |
| `utils.test.ts` | 26 | text metrics, sanitizer, diff, charts, spellcheck, image metadata, parser |

The web bundle was served and every route plus both WebAssembly assets returned 200 with the
correct MIME type. The bundle compiles and boots the SQLite engine from `/sql-wasm.wasm`.

## 5. Honest limitations

These are the gaps between "shipped" and "perfect", stated plainly:

1. **No device run.** The Android/iOS paths (WebView editor, camera, share sheet, print,
   biometrics) typecheck and share their logic with the tested code, but they were not
   exercised on hardware in this environment. The web build was verified over HTTP only —
   no headless browser was available, so visual verification is by the reviewer's eyes.
2. **DOCX import does not embed images yet.** Document text, headings, lists, tables and
   formatting convert correctly; media parts are read but not yet linked to paragraphs.
3. **Cloud sync is intentionally dormant.** The screen reports the real connection state and
   performs a genuine reachability check, but there is no sync engine and the app never
   claims there is.
4. **Lint warnings.** 35 warnings remain, almost all from React's new compiler-oriented
   rules (`react-hooks/refs`, `react-hooks/set-state-in-effect`) firing on React Native's
   `Animated.Value` refs and async bootstrap effects. They are documented in
   `eslint.config.js` rather than silenced file-by-file.
5. **Nextcloud/Google Drive integration** is not implemented; backups go through the OS share
   sheet, which covers the same use case without vendor SDKs.
6. **Spellcheck is a curated word list**, not a full dictionary engine; it is deliberately
   conservative (high-confidence suggestions only) and can be turned off.
7. **Locale.** UI copy is English; dates use the device locale.

## 6. How to run

```bash
npm install
npm run android     # or npm run ios / npm run web
npm test            # 102 tests
npm run verify      # typecheck + lint + tests
npm run build:web && npm run preview
```

## 7. Notable engineering decisions

- **SQLite everywhere, including the browser.** `sql.js` behind the same `SqlDatabase`
  interface means schema, migrations and repositories are identical on every platform, and
  the test suite exercises the production SQL.
- **Dependency-free HTML parsing.** Export needed a DOM but the app should not ship a second
  parser to the native bundle; `src/utils/htmlParser.ts` is ~200 lines and shared by all
  exporters.
- **Platform-split file delivery.** `files.ts` / `files.native.ts` / `files.web.ts` keeps
  Metro bundling correct and lets Node tests import the pure pipeline without native modules.
- **Editor isolation.** The shell knows nothing about notes, ids or saving. That keeps the
  most intricate code testable in jsdom and makes the native/web bridges nearly identical.
- **Truthful UI.** Save status, export results, backup counts and cloud state all report what
  actually happened; there are no optimistic “synced” or “backed up” badges.
