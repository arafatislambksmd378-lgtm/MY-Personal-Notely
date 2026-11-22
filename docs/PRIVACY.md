# Privacy

Notely is designed so that privacy is a property of the architecture, not a promise.

## What is stored, and where

| Data | Location | Leaves the device? |
| --- | --- | --- |
| Notebooks, notes, HTML content | SQLite file in the app's private storage | No |
| Derived text (excerpt, counts) | same database | No |
| Versions, comments, bookmarks, tags | same database | No |
| Images, sketches, charts | inline data URIs + `media_assets` rows | No |
| Settings | same database (key/value) | No |
| PIN hash and salt | Expo SecureStore (Keychain / Keystore) | No |
| Event log (diagnostics) | same database | No — only if you share the report |

## What is never collected

- No analytics, crash reporting or advertising SDKs.
- No device identifiers, contact lists or location.
- No note content in logs: diagnostics store a scope, a short message and a timestamp.
- No PIN in the database, in backups, or in the diagnostics report.

## Network

The app makes **no** network requests in its default configuration. The only network code
path is the optional cloud sync screen, and it runs only after you provide a Supabase URL
and anon key via environment variables. That screen performs a single reachability check
when you press *Test backend connection* — nothing else is sent.

## Backup files

A backup is a JSON (or ZIP) file you create with **Settings → Backup & restore**. It
contains your notes, notebooks, versions, tags, comments and bookmarks, plus settings
except PIN material. Where it goes is up to you: the share sheet is the only exit point.

Treat a backup like the notebook itself — if you put it in a shared cloud folder, anyone
with access to that folder can read it. Notely does not encrypt backups, because a
forgotten password would mean permanent data loss.

## App lock

The PIN is hashed with a per-installation random salt via expo-crypto and stored in the
platform keychain. Unlocking compares hashes; the plain PIN is never persisted. Biometric
unlock delegates to the operating system's authentication API and returns only a yes/no.

The lock engages on cold start and whenever the app goes to the background. Screen
capture protection is left to the OS; Android's `FLAG_SECURE` is not enabled because it
also blocks the user's own screenshots of their notes.

## Deleting data

- Deleting a note moves it to Trash; emptying the trash removes the rows immediately.
- Removing the app deletes the database and the keychain entries.
- Restoring a backup **merges**: existing notes with the same id are kept, new rows added.

## Children

Notely is a general-purpose notes app with no user-generated network content, no accounts
and no advertising, so it does not require age-gating. Parents may use the app lock to
restrict access.
