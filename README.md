# Notely

An offline-first smart notebook and document editor for Android, iOS and the web.
Everything — notes, notebooks, versions, images — lives in a SQLite database on the
device. There is no account, no telemetry and no background upload.

![platforms](https://img.shields.io/badge/platforms-android%20%7C%20ios%20%7C%20web-7C3AED)
![expo](https://img.shields.io/badge/expo-SDK%2058-000020)

## What it does

**Write** — a rich-text editor that keeps real documents, not just plain text:

- headings, bold/italic/underline/strike, highlight, text colours, alignment, lists (nested)
- tables, images (camera + library), freehand sketches, charts, footnotes, equations, symbols
- links, bookmarks, table of contents, find & replace, live word/character counts
- per-note page setup: paper size (A4/A5/Letter/Legal), orientation, margins, page colour,
  header/footer text and page numbers

**Organise** — notebooks with custom icons and colours, tags across notebooks, favourites,
pinning, archive, trash with restore, and instant offline search over title, body and tags.

**Keep safe** — autosave with a visible save state, version history with diffs and restore,
PIN + biometric app lock whose hash never touches the database, and full local backups.

**Share** — export to PDF, DOCX, ODT, RTF, HTML, Markdown and TXT with headings, tables,
lists, links, emphasis and embedded images intact; import DOCX, ODT, Markdown, HTML and TXT.

## Getting started

```bash
npm install          # install dependencies
npm start            # Expo dev server (press a / i / w)
npm run android      # native Android build
npm run web          # web build in the browser
npm test             # 102 tests: schema, repositories, editor, export, import, backup
npm run typecheck    # strict TypeScript, no emit
npm run lint         # ESLint (Expo config)
```

### Web preview (static export)

```bash
npm run build:web    # vendors sql.js + wasm, exports dist/
npm run preview      # serves dist/ on http://localhost:4173
```

The web build runs the *same* SQLite schema through `sql.js` (WebAssembly) and persists
the database to IndexedDB, so a browser session behaves like the app.

## Project layout

```
app/                    Expo Router routes (tabs, editor, search, collections, settings)
src/db/                 SQLite schema, migrations, repositories (the only SQL in the app)
src/editor/             Editor shell: HTML/CSS/JS injected into WebView / iframe
src/features/           Feature UI (editor sheets, home cards, templates, security)
src/services/           Export, import, backup, diagnostics, media, security, spellcheck
src/components/         Design-system primitives (Button, Card, Sheet, SheetRow, …)
src/design/             Tokens: colours, spacing, radii, typography, shadows
tests/                  Vitest suites (node + jsdom)
docs/                   Architecture, user guide, privacy, testing notes
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, editor bridge, export pipeline
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — every screen and tool, in plain language
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — what is stored, where, and what is never collected
- [`docs/TESTING.md`](docs/TESTING.md) — how the suites work and how to add cases
- [`NOTELY_IMPLEMENTATION_REPORT.md`](NOTELY_IMPLEMENTATION_REPORT.md) — build report

## Requirements

Node 20+, npm 10+. Android builds use Expo SDK 58 (min Android 7). The web build needs a
browser with WebAssembly and IndexedDB (any current Chrome, Edge, Firefox or Safari).

## Licence

Application code: MIT. Bundled libraries and fonts keep their own licences — see
Settings → About → Credits.
