# Cloud sync — evidence from a live Supabase project

This page records what was actually executed against a real Supabase project for
the cloud-sync feature, so the claim does not rest on unit tests alone.

| Item | Value |
| --- | --- |
| Project name | `notely-sync` |
| Project ref | `tdbdranlguvrykgrllfv` |
| Project URL | `https://tdbdranlguvrykgrllfv.supabase.co` |
| Region | `ap-southeast-1` (Singapore) |
| Plan | free |
| Schema applied | `supabase/schema.sql` (token literal replaced with a 52-character random token) |
| Date of run | 2026-11-22 (UTC) |
| Anon key | project's `anon` JWT (never committed) |
| Sync token | stored only in the Supabase project and in the maintainer's password manager |

The table, index, RLS policy and `notely_authorized()` function were created by
running the repository's own `supabase/schema.sql` unchanged, with the
placeholder token substituted.

## What was verified, and how

All checks below were run as SQL against the live project. The RLS checks set
`request.headers` exactly the way PostgREST does, and impersonate the `anon`
role (`set local role anon`) so the policy is evaluated for the role the app
actually uses.

| # | Check | How | Result |
| --- | --- | --- | --- |
| 1 | Schema exists and is reachable | `notely_documents` created from `schema.sql` | pass |
| 2 | Correct token authorises | `set_config('request.headers', '{"x-sync-token":"<token>"}')` → `notely_authorized()` | `true` |
| 3 | Wrong token does not authorise | same with `wrong-token` | `false` |
| 4 | Missing header does not authorise | fresh session, header GUC absent → `notely_authorized()` | `false` |
| 5 | Push stores documents | `insert … on conflict (space_id, doc_id) do update` (the statement PostgREST issues for `Prefer: resolution=merge-duplicates`) | 2 rows, timestamps `10:00` / `10:05` preserved |
| 6 | Re-push updates in place | second upsert of `doc-a` with a new title | 1 row for `doc-a`, title `Edited on device two`, no duplicate |
| 7 | Incremental pull by watermark | `where updated_at > '2026-11-01T10:02:00Z' order by updated_at asc` | `doc-a,doc-b` only |
| 8 | Pull order is monotonic | `lag()` window check over `order by updated_at asc` | `pull_is_monotonic = true` |
| 9 | Tombstones travel | `deleted_at` set on `doc-b`, pulled after watermark | `deleted_at` present for `doc-b` |
| 10 | Workspaces are isolated | second `space_id` with the same token | not returned for the first space |
| 11 | Anon + correct token can write | `set local role anon` + insert | accepted; 3 rows visible to anon |
| 12 | Anon + wrong token cannot write | `set local role anon` + insert | rejected: `42501 new row violates row-level security policy` |
| 13 | Anon + wrong token cannot read | `set local role anon`, `select count(*)` | `0` rows |
| 14 | RLS is enabled, one policy, index present | `pg_class.relrowsecurity`, `pg_policies`, `pg_indexes` | `true`, `1` policy, `2` indexes (PK + `space_id, updated_at`) |
| 15 | Anon has the grants the client needs | `has_table_privilege('anon', …)` for select/insert/delete | `true` / `true` / `true` |
| 16 | Workspace cleaned up | delete of all `live-verify-2026%` rows | 0 rows left in the table |

## What was *not* verified from this environment

The sandbox that produced this audit has no outbound HTTPS access to
`*.supabase.co`, so the browser/device HTTP path could not be exercised from
here. Two artefacts exist to close that gap without any code change:

* `tests/live-sync.test.ts` (11 tests) drives the **production** client
  (`createSyncClient` from `src/services/supabase.ts`) against a real project.
  It is skipped unless `NOTELY_LIVE_SYNC=1` is set, so the normal suite stays
  offline and hermetic.
* `.github/workflows/verify-sync.yml` runs exactly that test on a GitHub-hosted
  runner (which does have internet). It skips — green, with a notice — until
  three repository secrets exist:

  ```bash
  gh secret set NOTELY_SUPABASE_URL      -b "https://<ref>.supabase.co"
  gh secret set NOTELY_SUPABASE_ANON_KEY -b "<anon key>"
  gh secret set NOTELY_SYNC_TOKEN        -b "<token from notely_authorized()>"
  ```

  The automation token used for this audit could not create secrets
  (`403 Resource not accessible by integration`), so those three commands still
  have to be run once by a repository admin. Until then, cloud sync is
  **verified at the schema/RLS/payload level against a live project** but the
  device→internet→PostgREST hop has only been covered by unit tests with an
  in-memory PostgREST stand-in.

## Reproducing

```bash
# 1. Apply the schema (SQL editor or psql), replacing the placeholder token.
psql "$DATABASE_URL" -f supabase/schema.sql

# 2. Point the app at the project
#    Notely → Settings → Cloud sync → Connect project
#    URL, anon key, workspace id, and the same sync token.

# 3. Or run the integration suite against it
NOTELY_LIVE_SYNC=1 \
NOTELY_SUPABASE_URL=https://<ref>.supabase.co \
NOTELY_SUPABASE_ANON_KEY=<anon key> \
NOTELY_SYNC_TOKEN=<token> \
npx vitest run tests/live-sync.test.ts
```
