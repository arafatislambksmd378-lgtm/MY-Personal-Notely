# User guide

Notely keeps everything on the device. There is no sign-in screen because there is no
account, and nothing you write leaves the phone unless you export it.

## Home

The home screen shows your name and a date line, a search field, your notebooks as
coloured tiles, and recent notes as cards.

- **Tap the pencil** to start a note in the default notebook.
- **Tap a notebook** to open it; long-press actions live in the notebook screen.
- **Tap search** to jump to the full search screen.
- **"See all"** beside Recent notes opens the *All notes* collection.
- Pinned notes appear in their own section above the recent list.

## Notebooks

Each notebook has a colour and an icon. From the notebook screen you can rename it, change
its colour or icon, and move or delete notes inside it. Deleting a notebook asks what to do
with its notes — they can move to another notebook instead of the trash.

## Writing a note

The editor is a real page, not a plain text box:

| Tool | Where | What it does |
| --- | --- | --- |
| Bold / italic / underline / strike | toolbar | applies to the selection |
| Highlight, text colour, size | `Style` / `Aa` sheet | saved with the note |
| Alignment, lists | toolbar | left/centre/right/justify, bullets or numbers |
| Insert | `+` bar | table, image, sketch, chart, link, comment, divider, footnote, symbol, equation, contents, bookmark |
| Page setup | Note options | paper size, orientation, margins, page colour, header/footer, page numbers |
| Find & replace | Note options | highlights matches, replaces one or all |
| Word count | Note options | words, characters, reading time |
| Spelling & grammar | Note options | offline checks with one-tap fixes |
| Version history | Note options | snapshots with diffs; restore any of them |
| Comments | header bubble | threads anchored to the selected text |
| Bookmarks | Note options | named anchors you can jump back to |

Saving is automatic. The header shows *Saving…*, *Unsaved changes*, *Saved · 14:02* or a
failure state. Press **Ctrl/⌘ + S** to force a save. If a save fails, the edits stay in the
editor and retry on the next change.

Every ~60 seconds of edits a version snapshot is stored (Settings → Editor → version
history can turn this off). Versions are kept per note, capped so storage cannot grow
without bound.

## Organising

- **Tags** — add them in Note options; they cut across notebooks and appear in search.
- **Favourite** — the star on a card adds the note to Favourites.
- **Pin** — keeps a note at the top of Home.
- **Archive** — hides a note from the main list while keeping it searchable.
- **Trash** — deleted notes wait here until you restore them or empty the trash.

## Templates & import

Settings → Templates offers starter documents (meeting notes, journal, to-do, lecture
notes, project plan, recipe, reading notes). The same screen imports DOCX, ODT, Markdown,
HTML and TXT into new notes. Conversions happen on-device; the original file is untouched.

## Search

Search matches titles, body text and tags as you type. Filter further by tapping a tag chip
under the search field. Results show a highlighted snippet.

## Share & export

Note options → **Share & export**:

| Format | Best for |
| --- | --- |
| PDF | printing, sending to someone who just needs to read it |
| DOCX | Word, Google Docs, WPS Office |
| ODT | LibreOffice / OpenOffice |
| RTF | older word processors, maximum compatibility |
| HTML | publishing or emailing a styled page |
| Markdown | developers, static-site generators, plain-text archives |
| TXT | quick copy, minimal storage |

PDF uses the system print service — choose “Save as PDF” when prompted. Every other format
creates a real file and opens the share sheet.

## Settings

- **Appearance** — theme (light/dark/system), accent colour, editor text size, reset.
- **Security** — app lock with a PIN (4–8 digits), biometric unlock, lock-now, remove PIN.
  The app re-locks whenever it leaves the foreground.
- **Editor** — autosave interval, version history, spelling, default notebook, name.
- **Tags** — create, colour and delete tags.
- **Backup & restore** — save a JSON backup or a `.zip` archive, restore from either, or
  import a document.
- **Cloud sync** — optional Supabase mirroring; shows the real connection state, never a
  fake “synced” badge.
- **Diagnostics** — database integrity, size, counts, event log, maintenance actions and a
  shareable report.
- **About** — version, principles, feature list, credits.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/⌘ + S | save now |
| Ctrl/⌘ + B / I / U | bold / italic / underline |
| Enter in the search field | run search immediately |

## Troubleshooting

- **A note will not save** — check free storage; the header shows the error and retries.
  Nothing is discarded while the editor is open.
- **Exports fail** — PDF needs a print service (on web, allow the pop-up). Other formats
  need the share sheet; on web the file downloads instead.
- **I forgot my PIN** — the notes are still on disk; reinstalling the app removes the lock
  but also the database, so restore your latest backup.
- **Web build says the SQLite engine is missing** — run `npm run build:web` (it vendors
  `sql.js` and `sql-wasm.wasm` into `public/`).
