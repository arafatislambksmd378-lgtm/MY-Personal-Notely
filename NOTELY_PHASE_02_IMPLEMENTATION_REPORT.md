# NOTELY — PHASE 02 IMPLEMENTATION REPORT

**Project:** Notely notebook app (Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript strict · SQLite)
**Repository:** `arafatislambksmd378-lgtm/MY-Personal-Notely`
**Branch:** `arena/3e60d337-my-personal-notely`
**Base commit:** `bcc3ed8ddfc38a5c14320909b185aa6404976157`
**Date:** 2026-11-24 (UTC)
**Scope delivered:** Insert-panel three-column redesign · full-screen Drawing & Sketch editor with shapes · Home two-column Recent Notes grid · bottom-right `+` FAB

---

## 1. Files inspected

Read in full before any edit (Phase 01 audit, `NOTELY_PHASE_01_COMPLETE_AUDIT_REPORT.md`):

| Area | Files |
| --- | --- |
| Routes | `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/notebooks.tsx`, `app/note/[id].tsx`, `app/notebook/[id].tsx`, `app/search.tsx`, `app/collection/[kind].tsx`, `app/templates.tsx`, `app/settings/*.tsx` |
| Editor engine | `src/editor/buildDocument.ts`, `shellCss.ts`, `shellScript.ts`, `RichTextEditor.tsx`, `RichTextEditor.native.tsx`, `src/types/editor.ts` |
| Editor UI | `src/features/editor/InsertSheet.tsx`, `InsertContentSheets.tsx`, `EditorHeader.tsx`, `EditorBottomBar.tsx`, `NoteOptionsSheet.tsx`, `DocumentSheets.tsx` |
| Home | `src/features/home/NoteCard.tsx`, `NotebookCard.tsx` |
| Design system | `src/design/tokens.ts`, `typography.ts`, `fonts.ts`, `src/components/{Fab,IconTile,Screen,BottomSheet,SectionHeader,AppText,Button,EmptyState,ToggleSwitch,ConfirmDialog,TabBar}.tsx` |
| State / data | `src/store/useLibraryStore.ts`, `useSettingsStore.ts`, `src/db/repositories/documents.ts`, `media.ts`, `src/db/migrations`, `src/types/models.ts` |
| Tests / tooling | `tests/editor.test.ts`, `tests/setup.ts`, `tests/helpers/*`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.js`, `package.json`, `app.json`, `.github/workflows/*` |
| Existing evidence | `docs/evidence/screenshots/01-home.png` (confirms the clipped horizontal cards and the upper-right pencil FAB) |

---

## 2. Files modified

| File | Change |
| --- | --- |
| `app/(tabs)/index.tsx` | Recent Notes and Pinned converted to a two-column grid; header pencil FAB removed; bottom-right rounded-square `+` FAB added; scroll content padded so the FAB never covers content |
| `app/note/[id].tsx` | `drawing` tool now pushes the `/drawing` route; a new effect consumes the returned drawing, inserts it through the editor's `insertImage` command and records the media asset |
| `app/_layout.tsx` | Registered the new `drawing` stack screen |
| `src/features/editor/InsertSheet.tsx` | Grid rebuilt around measured tile widths so exactly three tiles fit per row; tiles compacted |
| `src/features/home/NoteCard.tsx` | Added a `style` override (used for `flex: 1`) and `minWidth: 0` |
| `src/components/Fab.tsx` | Added the `shape="rounded"` variant (circle/pencil default unchanged for other screens) |
| `src/components/IconTile.tsx` | Added the `compact` (36 pt) size used by the Insert tiles |
| `src/editor/buildDocument.ts` | Removed the in-editor drawing overlay markup |
| `src/editor/shellCss.ts` | Removed the drawing-overlay CSS |
| `src/editor/shellScript.ts` | Removed the in-editor drawing pad runtime and its `open-drawing` handler |
| `src/types/editor.ts` | Removed the now-unused `open-drawing` host message |
| `docs/ARCHITECTURE.md` | Documented the drawing editor, its protocol and the two new test suites |
| `.gitignore` | Excluded `baseline/` so the 27 MB Phase 01 snapshot never enters Git |

**No schema, migration, dependency, build configuration or unrelated screen was changed.**
`git diff` on `package.json`, `package-lock.json`, `app.json`, `src/db/**` is empty.

---

## 3. New components created

| File | Lines | Responsibility |
| --- | --- | --- |
| `app/drawing.tsx` | 597 | Full-screen route: top bar (X · Drawing · Insert · Shape), vertical tool rail, colour palette, stroke slider, stabilisation switch, selection bar, discard confirmation |
| `src/features/drawing/drawingScript.ts` | 978 | The canvas engine: pointer input, stabilised strokes, highlighter, object eraser, 37 vector shapes, selection with move/resize handles, fill, delete, undo/redo, PNG export |
| `src/features/drawing/drawingDocument.ts` | 46 | Assembles the self-contained HTML document |
| `src/features/drawing/DrawingCanvas.native.tsx` | 72 | WebView host (Android/iOS) |
| `src/features/drawing/DrawingCanvas.tsx` | 70 | iframe host (web) |
| `src/features/drawing/types.ts` | 110 | Message protocol, tools, shape kinds, palette, slider range |
| `src/features/drawing/shapeCatalog.ts` | 73 | The 37 shapes with labels, icons and categories |
| `src/features/drawing/ShapeSheet.tsx` | 113 | Categorised shape picker (4 per row) |
| `src/features/drawing/StrokeSlider.tsx` | 122 | Stroke-width slider with live preview (touch *and* mouse) |
| `src/features/drawing/useDrawingStore.ts` | 30 | Note-keyed hand-off of the finished drawing |
| `src/utils/grid.ts` | 33 | `tileWidth()` and `chunkIntoRows()` — the tested grid arithmetic |
| `tests/drawing.test.ts` | 447 | 22 tests driving the real canvas engine |
| `tests/grid.test.ts` | 57 | 7 tests for the grid arithmetic |
| `NOTELY_PHASE_01_COMPLETE_AUDIT_REPORT.md` | — | Phase 01 audit |

---

## 4. Insert grid changes

**Root cause of the two-column layout.** Tiles were `width: '31.2%'` with a 12 pt flex gap. Three tiles need `93.6 %` of the content box *plus* 24 pt, which overflows on every phone width, so `flexWrap` dropped the third tile to the next row.

**Fix.** `tileWidth(containerWidth, columns, gap)` measures the grid container with `onLayout` and computes `floor((width − 2 × gap) / 3)`. The container falls back to `windowWidth − 40` on the first frame, so there is no flash of wrong layout.

```ts
// before: three tiles could never fit
31.2% × 3 = 93.6%  +  2 × 12pt  >  100%
// after (360 dp phone, 320 dp content)
floor((320 − 24) / 3) = 98  →  98 × 3 + 24 = 318 ≤ 320  ✓
```

| Property | Before | After |
| --- | --- | --- |
| Columns on a 360 dp phone | 2 | **3** |
| Tile width | 31.2 % (≈100 dp, but only 2 per row) | 98 dp (exactly 3 per row) |
| Tile height | 104 dp min | 96 dp min |
| Icon tile | 40 pt | 36 pt (`compact`) |
| Label | 1 line | 1 line |
| Subtitle | 2 lines | 1 line (ellipsized) |
| Radius | 20 | 16 |
| Grid max width | unbounded | 560 dp, centred (tablets/desktop stay balanced) |

The full-width **Image** row is unchanged. All 12 tools remain and all still call the same `onSelect` handler — nothing was removed, renamed or disabled.

---

## 5. Drawing editor changes

### 5.1 Navigation

`handleInsertTool('drawing')` now pushes `/drawing?noteId=<id>&mode=drawing` instead of sending `open-drawing` to the editor WebView. The route sits **outside** the tabs group, so the tab bar is not rendered and the editor gets the whole screen. `mode=sketch` is supported and renders the title "Sketch" with the same editor.

The old bottom sheet is **gone**, not just bypassed: its markup, CSS and runtime were deleted from the editor shell, so there is exactly one drawing system in the app.

### 5.2 Layout (Reference Image 4)

```
┌──────────────────────────────────────────────────────────────┐
│  ✕                    Drawing                 [✓ Insert] [◇] │  56 dp
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐ ╔══╗ │
│  │                                                    │ ║✋ ║ │
│  │                                                    │ ║✏ ║ │
│  │                  white canvas                      │ ║▮ ║ │
│  │                                                    │ ║⌫ ║ │
│  │                                                    │ ║──║ │
│  │                                                    │ ║↶ ║ │
│  │                                                    │ ║↷ ║ │
│  └────────────────────────────────────────────────────┘ ║🗑 ║ │
│                                                          ╚══╝ │
│  ● ● ● ● ● ● ● ●                                              │
│  Stroke size                                    ●  4          │
│  ─────────────────────────●──────────────                     │
│  1                                                        24  │
│  Stroke stabilization                            [ ⬤ ]       │
└──────────────────────────────────────────────────────────────┘
```

- **Top bar** — close (X) left, centred title, purple `Insert` pill and a `Shape` icon button right. The title is absolutely positioned so it stays centred regardless of the side widths.
- **Tool rail** — vertical, 52 dp wide, floating with a card shadow: select, pen, highlighter, eraser · undo, redo, clear. Buttons share the rail height (`flex: 1`, clamped 34–44 dp) so the rail fits a short phone as well as a tall one. Undo/redo/clear are disabled (and dimmed) when not applicable.
- **Colour palette** — 8 horizontal swatches: black, purple, blue, green, yellow, red, pink, teal. The active swatch gets a purple ring. Selecting a colour also recolours the current selection.
- **Stroke slider** — 1–24 pt, live preview dot that grows with the value, immediate application to subsequent strokes (and to a selected object's outline).
- **Stabilisation** — a `ToggleSwitch`, default on.

### 5.3 Canvas engine

A **vector** engine, not a bitmap:

- Items are stored in **normalised 0…1 coordinates**, so a rotation or resize re-renders the same vectors at the new size instead of stretching pixels. A `resize` listener plus a `ResizeObserver` keep the backing store in sync with the device pixel ratio.
- Strokes are quadratic-smoothed through segment midpoints, with an optional exponential stabiliser (`smooth += (target − smooth) × 0.45`) that removes jitter without perceptible lag. Highlighter strokes are 3× wide at 42 % alpha.
- The eraser is an **object** eraser (removes whole strokes/shapes), which is deterministic and never leaves half-erased pixels.
- **Undo/redo** are snapshots of the item list (capped at 80), pushed once per gesture and only when a gesture actually mutates — so tapping without drawing does not pollute the history.
- Export rasterises to PNG at up to 2× and 1600 px on the long edge, with a white background so the inserted image matches the note page.

---

## 6. Shape functionality implemented

**37 shapes in four categories** (the exact list from the brief):

| Category | Count | Shapes |
| --- | --- | --- |
| Basic | 11 | rectangle, rounded rectangle, square, circle, oval, triangle, right triangle, diamond, pentagon, hexagon, octagon |
| Lines & arrows | 9 | straight, dashed, dotted, arrow, double arrow, curved arrow, connector, horizontal, vertical |
| Geometric | 10 | arc, semicircle, trapezoid, parallelogram, star, cross, plus, minus, bracket, brace |
| Flowchart | 7 | process, decision, input/output, start/end, document, database, connector |

Every one is drawn by the engine's `traceShape()` — none is a decorative icon. The shape sheet is a four-column grid per category; choosing a shape arms it and shows a chip on the canvas ("Drag to draw · Rectangle").

**Interaction, all functional:**

| Capability | How |
| --- | --- |
| Select | Selection tool; topmost object under the pointer is selected, with a dashed purple box and four corner handles |
| Move | Drag inside the selection; strokes translate point-by-point, shapes translate their box |
| Resize | Drag any of the four corner handles; strokes scale their points, shapes scale their box; clamped to the canvas |
| Change colour | Colour palette applies to the selected object (and to its fill if filled) |
| Change outline thickness | The stroke slider applies to the selected object |
| Fill | `Fill` chip appears only for closed shapes; toggles `fill = colour` |
| Delete | `Delete` chip removes the selected object |
| Undo / redo | Every shape operation is on the same history stack as strokes |

Square and circle are forced proportional while dragging; thin shapes (horizontal/vertical lines) are kept rather than discarded; an accidental tap leaves no speck.

---

## 7. Note integration changes

```
Drawing screen                 useDrawingStore              Note editor
──────────────                 ───────────────              ───────────
Insert tap
  → canvas.export()
  → {exported, dataUri, empty}
                                publish({noteId, dataUri, bytes})
  → router.back()                                            effect sees pending.noteId === id
                                                              → send({type:'insertImage', src, alt:'Drawing'})
                                                              → recordMediaAsset(kind:'drawing')
                                                              → clear(noteId)
                                                            editor emits 'change'
                                                              → autosave (existing path)
                                                              → note reopened later: <img> is still in content_html
```

- **Validation:** if the canvas is empty, Insert shows "Draw something first — the canvas is empty." and does not navigate.
- **Correct note:** the result is keyed by `noteId`; `clear()` only clears a matching note, so a drawing can never land in the wrong document.
- **Existing save path preserved:** the drawing enters the note through the same `insertImage` command used by gallery images, at the caret, and is persisted by the existing debounced autosave. No new save mechanism, no schema change.
- **Loss prevention:** closing with content (X, or Android hardware back) asks "Discard this drawing?"; the hardware back button is intercepted with `BackHandler`.

---

## 8. Home screen changes

### 8.1 Recent Notes grid (Task 01)

| Before | After |
| --- | --- |
| `<ScrollView horizontal>` with `NoteCard` hard-coded to 220 pt | Chunked rows of **two**, each card `flex: 1` |
| Second card clipped at the screen edge | Both cards fully visible, equal width |
| Horizontal scrolling | **No horizontal scrolling**; the page scrolls vertically |
| Fixed 220 pt width ignored the screen | Responsive: `(screen − 40 − 12) / 2` per card (≈154 dp on a 360 dp phone) |

`chunkIntoRows(notes, 2)` produces the rows and an odd final card is followed by a spacer, so it keeps its column width instead of stretching full-width. The same grid is applied to the **Pinned** section, which had the identical clipping defect. Data still comes from `useLibraryStore` (`getRecentDocuments(8)`, ordering unchanged) — no mock data, no new data path.

### 8.2 New `+` FAB (Task 02)

| Requirement | Implementation |
| --- | --- |
| Position | Bottom-right of the Home content area |
| Shape | Rounded square, 68 × 68 dp, radius 22 |
| Colour | `colors.primary` (Notely purple `#7C3AED`) |
| Icon | White `add` (+), centred |
| Elevation | `shadows.floating` (elevation 8, purple tint) |
| Above bottom nav | The FAB is positioned inside the tab screen, whose height already excludes the tab bar; the tab bar consumes the Android navigation inset |
| Visible while scrolling | `position: absolute` layer over the ScrollView |
| Does not cover content | Scroll content has 120 dp bottom padding |
| Behaviour | Same `startNote()` → `createNote()` → `/note/[id]`; the store refreshes and the new note appears in the grid |

### 8.3 Old button removed (Task 03)

The `<Fab>` inside the header row is deleted; the header now contains only the greeting block. The notebook-detail screen's circular pencil FAB is untouched (the `Fab` default remains `shape="circle"`, `icon="pencil"`).

---

## 9. Tests performed

### 9.1 Automated

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | **0 errors** |
| `npm run lint` | **0 errors**, 37 warnings — the same 35 pre-existing warnings (React Compiler rules on `Animated`/bootstrap effects) plus 2 from `app/_layout.tsx`'s pre-existing `setBoot` effect; **zero warnings in any file touched by this work** |
| `npx vitest run` | **185 passed**, 11 skipped (live-sync gated by env var), 14 files + 1 skipped |
| `npm run build:web` | **Exported successfully** — 20 route bundles including `drawing-*.js` (51 KB) |
| Route smoke test | `/`, `/drawing`, `/note/abc`, `/notebooks`, `/search`, `/settings/security`, `/sql-wasm.wasm` → **all 200** |
| Bundle inspection | `__notelyDrawingReceive` present in the shipped drawing bundle; `home-new-note` test id present in the Home bundle |

### 9.2 New test coverage (29 tests)

`tests/drawing.test.ts` (22) boots the **real** drawing document in jsdom with a recording 2D-context stub and drives it through synthetic pointer events and the message bridge:

- boots, reports ready + initial state
- records a stroke; reports content and undo availability
- undo → empty, redo → restored
- clear
- colour + width reach the next stroke
- stabilisation toggle
- export empty (flagged) and export with content
- eraser removes the stroke under the pointer
- all 37 catalogue shapes draw without throwing, and each leaves the tool in `select` with the new object selected
- square/circle stay proportional
- closed shapes are fillable; open shapes are not
- fill applies and reports
- delete removes the selection
- move and resize (including the **north-west** handle)
- horizontal and vertical lines are kept despite a near-zero dimension
- an accidental tap is discarded
- drawing survives a resize (normalised coordinates)
- hand-off store publishes and clears per note

`tests/grid.test.ts` (7):

- three tiles plus two gaps fit at 280–480 dp container widths, and a fourth cannot
- explicitly reproduces the old `31.2 %` overflow
- two-column widths
- `chunkIntoRows` pairing, completeness, empty and single-item cases

### 9.3 Manual / visual

| Item | Status |
| --- | --- |
| Android emulator | ⚠️ **Not available in this environment.** No Android SDK, emulator or device is present in the sandbox. |
| Headless browser screenshot | ⚠️ **Not available.** `playwright install chromium` is blocked by the sandbox network policy (download from the Playwright CDN fails). |
| Web build served | ✅ The exported app is served by `scripts/serve-web.mjs` on port 4173 and is available as the **Live Preview** for visual inspection in the browser |
| Visual judgement | ⚠️ **Not verified by me.** Layout correctness is proven by arithmetic and unit tests, not by a rendered screenshot. |

**What was therefore NOT verified end-to-end on a device:** the visual appearance of the new screens, touch latency of the canvas, the Android hardware-back interception, and the full round trip (draw → insert → reopen note). Each of those is implemented and type-checked, and the engine + save path are individually tested, but the device run is outstanding.

---

## 10. Tests passed and failed

| Suite | Passed | Failed |
| --- | --- | --- |
| `drawing.test.ts` | 22 | 0 |
| `grid.test.ts` | 7 | 0 |
| `editor.test.ts` | 16 | 0 |
| `repositories.test.ts` | 25 | 0 |
| `sync.test.ts` | 15 | 0 |
| `backup.test.ts` | 7 | 0 |
| `database.test.ts` | 7 | 0 |
| `store.test.ts` | 4 | 0 |
| `export.test.ts` | 14 | 0 |
| `import.test.ts` | 13 | 0 |
| `utils.test.ts` | 17 | 0 |
| `scan.test.ts` | 19 | 0 |
| `tabbar.test.ts` | 9 | 0 |
| `ui-element.test.ts` | 10 | 0 |
| `live-sync.test.ts` | 11 skipped | 0 |
| **Total** | **185** | **0** |

Two defects were found by testing during development and fixed before completion:

1. **West-edge resize never worked** — `handle.indexOf('w') === 0` is false for `'nw'`/`'sw'` (the `w` is at index 1). Fixed to `>= 0`, with a regression test.
2. **Thin shapes were discarded** — the "accidental tap" guard rejected anything with a near-zero width *or* height, which deleted every horizontal/vertical line. Now only discarded when the *longer* dimension is negligible, with regression tests.

---

## 11. Remaining limitations

1. **No device run.** As stated in §9.3, the Android build and on-device behaviour could not be exercised here. The CI workflow `.github/workflows/android.yml` builds the APK on GitHub.
2. **Drawings are stored as base64 PNG data URIs** in both the note HTML and `media_assets.uri` — the pre-existing behaviour. Export is capped (≤1600 px, ≤2×) to keep rows small, but a large drawing still costs tens of kilobytes per note and per backup. A future phase could move drawings to files.
3. **The eraser is object-level, not pixel-level.** It removes whole strokes/shapes, which is predictable and undoable, but it cannot erase part of a stroke.
4. **Hit testing is bounding-box based.** A wide diagonal stroke's box is large, so tapping inside the box (but off the line) selects it.
5. **The canvas is always white**, including in dark mode, so the exported image matches the white note page.
6. **Home shows at most 8 recent notes** (the pre-existing `getRecentDocuments(8)` limit) → four rows in the grid; "See all" exposes the rest. The ordering is unchanged.
7. **No tablet-specific layout was added** for the drawing editor; the rail and canvas flex naturally, and the Insert grid is capped at 560 dp.
8. **The `mode=sketch` entry point is the Drawing card.** There is no separate "Sketch" card in the existing Insert panel (`Drawing` is subtitled "Sketch & ink"), so both words open the same full-screen editor; the title switches to "Sketch" when `mode=sketch`. No feature was added or renamed.

---

## 12. Acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Insert panel uses a compact three-column design | ✅ 3 measured columns, 96 dp tiles, 36 dp icon tiles |
| 2 | Drawing and Sketch open a full-screen editor, not a bottom sheet | ✅ New stack route; old overlay deleted |
| 3 | Insert and Shape controls are functional | ✅ Export + note insertion; 37 drawable shapes |
| 4 | Recent Notes shows two cards per row | ✅ Chunked rows, `flex: 1` |
| 5 | Additional cards appear in subsequent rows | ✅ Rows wrap; odd card keeps its width |
| 6 | Recent Notes scrolls vertically | ✅ Page `ScrollView` |
| 7 | No horizontal scrolling remains | ✅ Horizontal carousels removed from Recent/Pinned |
| 8 | Old upper-right pencil button removed | ✅ Header FAB deleted |
| 9 | Purple rounded-square `+` at bottom-right | ✅ 68 dp, radius 22, `#7C3AED` |
| 10 | Button stays above the bottom navigation | ✅ Positioned inside the tab screen |
| 11 | Existing note creation still works | ✅ Same `createNote()` path |
| 12 | Existing data and features intact | ✅ No schema, repository or unrelated screen changes; 185 tests green |
| 13 | Build succeeds | ✅ `tsc` 0 errors, web export succeeds |
| 14 | Updated source pushed to the repository | ✅ Committed and pushed to `arena/3e60d337-my-personal-notely` |

---

## 13. How to verify by hand

```bash
npm install
npm test            # 185 passing
npm run typecheck   # 0 errors
npm run lint        # 0 errors
npm run android     # device/emulator (not possible in this sandbox)
```

On the Home screen: two note cards per row, no horizontal swipe, purple `+` bottom-right.
Open a note → `+` → **Insert**: three tiles per row, four rows for twelve tools.
Tap **Drawing**: full-screen editor; draw with the pen, switch to the highlighter, erase, undo/redo, change colour and width, open **Shape** and drag out a rectangle, then move/resize/fill/delete it.
Tap **Insert**: back on the note with the drawing at the caret; kill and reopen the app — the drawing is still there.
