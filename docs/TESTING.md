# Testing

```bash
npm test             # all suites
npm run test:watch   # watch mode
npx vitest run tests/editor.test.ts
```

146 tests run offline in three environments, plus 11 opt-in tests that talk to a live
Supabase project (157 in total):

| Environment | Setup | Used for |
| --- | --- | --- |
| node | default | pure functions, exporters, importers |
| node + sql.js | `tests/helpers/testDb.ts` | database, repositories, backup |
| jsdom | per-test `new JSDOM(..., { runScripts: 'dangerously' })` | the editor shell |
| node + network | `NOTELY_LIVE_SYNC=1` + credentials | live Supabase sync (skipped by default) |

## Database tests

`createTestDatabase()` builds a throwaway SQLite database with the real migrations and
seeds it, then installs it as the app singleton so production repositories run unchanged.
`close()` tears it down. No test touches the device database.

```ts
const ctx = await createTestDatabase();
await seedIfEmpty(ctx.db);
// … use the repositories exactly as the app does …
await ctx.close();
```

## Editor tests

`tests/editor.test.ts` boots the exact HTML string that ships to the WebView, stubs
`window.ReactNativeWebView`, and drives commands through `window.__notelyReceive`. This
covers sanitisation, table insertion and clamping, table of contents, footnotes, bookmark
anchors, find/replace counts, and live page setup — without a browser or a device. jsdom
does not implement `document.execCommand`, so formatting commands that depend on it
(bold/italic/alignment) are exercised on device instead.

## Navigation tests

`tests/tabbar.test.ts` (9 tests) covers the tab route table and the focus mapping used by
the bottom bar, and asserts at source level that `TabBar` no longer calls
`navigation.emit(...)` on injected props. That call crashed the app on device — see
`docs/evidence/android-device-run.md`.

## Live sync tests

`tests/live-sync.test.ts` (11 tests) runs the **production** PostgREST client against a
real project instead of the in-memory stand-in. It is skipped unless four environment
variables are present, so `npm test` and CI stay hermetic:

```bash
npm run test:live      # NOTELY_LIVE_SYNC=1 plus the three NOTELY_* variables
```

It covers: ping against the deployed table, RLS refusing reads and writes without the sync
token, push/pull fidelity for every column, incremental pulls, in-place upsert (no
duplicates), tombstones, and per-workspace isolation. Each run uses a throw-away
`space_id` and deletes its rows afterwards.

`.github/workflows/verify-sync.yml` runs the same file on a GitHub runner when the
repository secrets `NOTELY_SUPABASE_URL`, `NOTELY_SUPABASE_ANON_KEY` and
`NOTELY_SYNC_TOKEN` exist; without them it reports a notice and skips (it does not fake a
pass). What has already been executed against a live project, with outputs, is recorded in
`docs/evidence/cloud-sync-live.md`.

## Sync tests

`tests/sync.test.ts` runs the real engine against an in-memory PostgREST stand-in: it
asserts request URLs and headers, watermark pull behaviour, batch pushes, last-write-wins
conflicts (including the version snapshot), tombstone handling, repo-created notebooks and
failure reporting. `createSyncClient` is additionally tested against a mocked `fetch` for
HTTP 404/401 and network errors.

## Scan and voice tests

`tests/scan.test.ts` mocks `expo-mlkit-ocr` and `expo-speech-recognition` to exercise the
capture loop, page limits, OCR success/unsupported/crash paths, HTML generation (including
escaping) and both dictation implementations, including denied permissions and error codes.

## Export tests

Exporters are checked structurally: DOCX and ODT are unzipped with JSZip and their XML
parts asserted, which is the same thing Word/LibreOffice validate. Round-trip tests push a
document through the exporter and back through the importer and compare text.

## Conventions

- Prefer behaviour over snapshots: assert what a user would see.
- Every failure message should be actionable (`expect(result).toContain('…')`).
- Keep tests deterministic: fixed dates, no network, no sleeps beyond debounce windows.
- A new exporter must add a row to `EXPORT_FORMATS` and a case in `tests/export.test.ts`.

## What is not covered automatically

Camera capture, biometric prompts, the native share sheet, print dialogs and OS file
pickers require a device or simulator. `services/files.native.ts`, `services/media.ts` and
`services/security.ts` are written so those paths are thin and reviewable.
