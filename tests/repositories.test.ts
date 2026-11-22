import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { createTestDatabase, type TestDatabase } from './helpers/testDb';
import { openSqlJsDatabase } from '@/db/drivers/sqljsCore';
import { runMigrations } from '@/db/migrate';
import { __setDatabaseForTests, type SqlDatabase } from '@/db';
import * as notebooks from '@/db/repositories/notebooks';
import * as documents from '@/db/repositories/documents';
import * as versions from '@/db/repositories/versions';
import * as tagsRepo from '@/db/repositories/tags';
import * as commentsRepo from '@/db/repositories/comments';
import * as bookmarksRepo from '@/db/repositories/bookmarks';
import * as settingsRepo from '@/db/repositories/settings';

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
});

afterEach(async () => {
  await ctx.close();
});

describe('notebooks', () => {
  it('creates, validates and lists notebooks with note counts', async () => {
    const work = await notebooks.createNotebook({ name: 'Work', color: 'blue', icon: 'briefcase' });
    expect(work.isDefault).toBe(true);

    const personal = await notebooks.createNotebook({ name: 'Personal', color: 'purple' });
    expect(personal.isDefault).toBe(false);

    await documents.createDocument({ notebookId: work.id, title: 'A' });
    await documents.createDocument({ notebookId: work.id, title: 'B' });

    const list = await notebooks.listNotebooks();
    const workListing = list.find((n) => n.id === work.id);
    expect(workListing?.noteCount).toBe(2);
    expect(list.find((n) => n.id === personal.id)?.noteCount).toBe(0);
  });

  it('rejects empty notebook names', async () => {
    await expect(notebooks.createNotebook({ name: '   ' })).rejects.toThrow(/required/i);
  });

  it('renames and recolors a notebook', async () => {
    const nb = await notebooks.createNotebook({ name: 'Old' });
    await notebooks.updateNotebook(nb.id, { name: 'New', color: 'green' });
    const updated = await notebooks.getNotebook(nb.id);
    expect(updated?.name).toBe('New');
    expect(updated?.color).toBe('green');
  });

  it('moves notes to a fallback notebook before soft-deleting', async () => {
    const target = await notebooks.createNotebook({ name: 'Target' });
    const doomed = await notebooks.createNotebook({ name: 'Doomed' });
    const doc = await documents.createDocument({ notebookId: doomed.id, title: 'Kept safe' });

    await notebooks.deleteNotebook(doomed.id, target.id);

    expect(await notebooks.getNotebook(doomed.id)).toBeNull();
    const moved = await documents.getDocument(doc.id);
    expect(moved?.notebookId).toBe(target.id);
  });

  it('refuses to delete a notebook into itself', async () => {
    const nb = await notebooks.createNotebook({ name: 'Self' });
    await expect(notebooks.deleteNotebook(nb.id, nb.id)).rejects.toThrow(/different notebook/i);
  });
});

describe('documents', () => {
  it('creates a document with derived statistics', async () => {
    const nb = await notebooks.createNotebook({ name: 'Personal' });
    const doc = await documents.createDocument({
      notebookId: nb.id,
      title: 'Hello',
      contentHtml: '<h1>Hello</h1><p>World of notes and ideas.</p>',
    });
    expect(doc.wordCount).toBe(6);
    expect(doc.plainText).toContain('World of notes');
    expect(doc.excerpt.length).toBeGreaterThan(0);
    expect(doc.readingMinutes).toBe(1);
  });

  it('refuses to create a document in a notebook that does not exist', async () => {
    await expect(documents.createDocument({ notebookId: 'nope', title: 'x' })).rejects.toThrow(
      /no longer exists/i,
    );
  });

  it('autosaves content and recomputes word counts', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id });
    const result = await documents.saveDocumentContent(doc.id, {
      html: '<p>One two three four five six.</p>',
    });
    expect(result.wordCount).toBe(6);
    const reloaded = await documents.getDocument(doc.id);
    expect(reloaded?.contentHtml).toContain('six');
    expect(reloaded?.charCount).toBe(result.charCount);
    const listed = await documents.listDocumentSummaries();
    expect(listed[0].excerpt).toContain('One two three');
  });

  it('persists across a full database restart (byte export + reload)', async () => {
    const nb = await notebooks.createNotebook({ name: 'Durable' });
    const doc = await documents.createDocument({ notebookId: nb.id, title: 'Survives restart' });
    await documents.saveDocumentContent(doc.id, { html: '<p>Still here after restart.</p>' });
    await ctx.db.flush?.();

    // Simulate process death: export bytes exactly like the browser driver does.
    const bytes = await exportBytes(ctx.db);
    const SQL = await initSqlJs();
    const reopened = await openSqlJsDatabase(SQL, {
      persistence: { load: async () => bytes, save: async () => undefined },
    });
    await runMigrations(reopened);
    __setDatabaseForTests(reopened);

    const restored = await documents.getDocument(doc.id);
    expect(restored?.title).toBe('Survives restart');
    expect(restored?.contentHtml).toContain('Still here');
    const restoredNotebook = await notebooks.getNotebook(nb.id);
    expect(restoredNotebook?.name).toBe('Durable');
    await reopened.close();
  });

  it('trash, restore and permanent delete keep relationships consistent', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id, title: 'Trash me' });
    await commentsRepo.addComment({ documentId: doc.id, body: 'note' });

    await documents.trashDocument(doc.id);
    expect(await documents.listDocumentSummaries()).toHaveLength(0);
    expect(await documents.listDocumentSummaries({ trashed: true })).toHaveLength(1);

    await documents.restoreDocument(doc.id);
    expect(await documents.listDocumentSummaries()).toHaveLength(1);

    await documents.purgeDocument(doc.id);
    expect(await documents.getDocument(doc.id)).toBeNull();
    const orphans = await ctx.db.all('SELECT * FROM comments WHERE document_id = ?', [doc.id]);
    expect(orphans).toHaveLength(0);
  });

  it('empties the trash in one go', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const a = await documents.createDocument({ notebookId: nb.id });
    const b = await documents.createDocument({ notebookId: nb.id });
    await documents.trashDocument(a.id);
    await documents.trashDocument(b.id);
    const removed = await documents.emptyTrash();
    expect(removed).toBe(2);
    expect(await documents.listDocumentSummaries({ trashed: true })).toHaveLength(0);
  });

  it('duplicates, pins, favorites, archives and moves documents', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const other = await notebooks.createNotebook({ name: 'Other' });
    const doc = await documents.createDocument({ notebookId: nb.id, title: 'Original' });

    const copy = await documents.duplicateDocument(doc.id);
    expect(copy.title).toBe('Original (copy)');
    expect(copy.id).not.toBe(doc.id);

    expect(await documents.togglePinned(doc.id)).toBe(true);
    expect(await documents.toggleFavorite(doc.id)).toBe(true);
    expect(await documents.listDocumentSummaries({ favorite: true })).toHaveLength(1);

    expect(await documents.toggleArchived(doc.id)).toBe(true);
    expect(await documents.listDocumentSummaries()).toHaveLength(1); // archived hidden (copy only)
    expect(await documents.listDocumentSummaries({ archived: true })).toHaveLength(1);

    await documents.moveToNotebook(doc.id, other.id);
    expect((await documents.getDocument(doc.id))?.notebookId).toBe(other.id);
  });

  it('sorts pinned notes first and filters by notebook and tag', async () => {
    const nb = await notebooks.createNotebook({ name: 'A' });
    const nb2 = await notebooks.createNotebook({ name: 'B' });
    const first = await documents.createDocument({ notebookId: nb.id, title: 'Zeta' });
    const second = await documents.createDocument({ notebookId: nb.id, title: 'Alpha' });
    await documents.createDocument({ notebookId: nb2.id, title: 'Other book' });

    await documents.togglePinned(first.id);
    const ordered = await documents.listDocumentSummaries({ notebookId: nb.id });
    expect(ordered[0].id).toBe(first.id);
    expect(ordered[1].id).toBe(second.id);

    await tagsRepo.addTagToDocument(second.id, 'research');
    const tagged = await documents.listDocumentSummaries({ tag: 'RESEARCH' });
    expect(tagged).toHaveLength(1);
    expect(tagged[0].tags).toContain('research');
  });

  it('searches title and body case-insensitively', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({
      notebookId: nb.id,
      title: 'Quarterly plan',
      contentHtml: '<p>Budget for the design system</p>',
    });
    expect(await documents.searchDocuments('quarterly')).toHaveLength(1);
    expect(await documents.searchDocuments('BUDGET')).toHaveLength(1);
    expect(await documents.searchDocuments('nonexistent')).toHaveLength(0);
    await documents.saveDocumentContent(doc.id, { html: '<p>changed</p>' });
    expect(await documents.searchDocuments('budget')).toHaveLength(0);
  });

  it('reports stats used by the settings and home screens', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id, contentHtml: '<p>one two</p>' });
    await documents.createDocument({ notebookId: nb.id, contentHtml: '<p>three</p>' });
    await documents.trashDocument(doc.id);
    const stats = await documents.getDocumentStats();
    expect(stats.notebooks).toBe(1);
    expect(stats.notes).toBe(1);
    expect(stats.trashed).toBe(1);
    expect(stats.words).toBe(3);
  });

  it('rejects saving content for a missing document', async () => {
    await expect(documents.saveDocumentContent('missing', { html: '<p>x</p>' })).rejects.toThrow(
      /not found/i,
    );
  });
});

describe('version_history', () => {
  it('throttles snapshots and keeps content intact', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id, title: 'V', contentHtml: '<p>v1</p>' });

    const first = await versions.createVersion(doc.id, { force: true });
    expect(first).not.toBeNull();
    const duplicate = await versions.createVersion(doc.id, { force: true });
    expect(duplicate).toBeNull(); // unchanged content

    await documents.saveDocumentContent(doc.id, { html: '<p>v2</p>' });
    const blocked = await versions.createVersion(doc.id, { minIntervalMs: 60_000 });
    expect(blocked).toBeNull(); // too soon
    const forced = await versions.createVersion(doc.id, { force: true });
    expect(forced).not.toBeNull();

    const list = await versions.listVersions(doc.id);
    expect(list).toHaveLength(2);
    expect(list[0].contentHtml).toContain('v2');
  });

  it('prunes to the retention limit', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id, contentHtml: '<p>0</p>' });
    for (let i = 1; i <= 6; i += 1) {
      await documents.saveDocumentContent(doc.id, { html: `<p>${i}</p>` });
      await versions.createVersion(doc.id, { force: true, maxVersions: 3 });
    }
    const list = await versions.listVersions(doc.id);
    expect(list).toHaveLength(3);
  });

  it('restores a previous version and backs up current content first', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id, contentHtml: '<p>original</p>' });
    const snapshot = await versions.createVersion(doc.id, { force: true });

    await documents.saveDocumentContent(doc.id, { html: '<p>changed</p>' });
    await versions.restoreVersion(snapshot!.id);

    const restored = await documents.getDocument(doc.id);
    expect(restored?.contentHtml).toContain('original');
    const list = await versions.listVersions(doc.id);
    expect(list.some((v) => v.label === 'Before restore' && v.contentHtml.includes('changed'))).toBe(true);
  });
});

describe('tags_comments_bookmarks', () => {
  it('deduplicates tags case-insensitively', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id });
    await tagsRepo.addTagToDocument(doc.id, 'Ideas');
    await tagsRepo.addTagToDocument(doc.id, 'ideas');
    const list = await tagsRepo.listDocumentTags(doc.id);
    expect(list).toHaveLength(1);
  });

  it('adds, resolves and deletes comments', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id });
    const comment = await commentsRepo.addComment({ documentId: doc.id, body: 'Review this' });
    expect(await commentsRepo.countComments(doc.id)).toBe(1);
    await commentsRepo.toggleCommentResolved(comment.id);
    expect(await commentsRepo.countComments(doc.id)).toBe(0);
    await commentsRepo.deleteComment(comment.id);
    expect(await commentsRepo.listComments(doc.id)).toHaveLength(0);
  });

  it('rejects empty comments', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id });
    await expect(commentsRepo.addComment({ documentId: doc.id, body: '   ' })).rejects.toThrow(
      /empty/i,
    );
  });

  it('stores bookmarks with anchors', async () => {
    const nb = await notebooks.createNotebook({ name: 'N' });
    const doc = await documents.createDocument({ notebookId: nb.id });
    const bookmark = await bookmarksRepo.addBookmark({
      documentId: doc.id,
      label: 'Key section',
      anchor: 'bm-1',
    });
    expect(await bookmarksRepo.listBookmarks(doc.id)).toHaveLength(1);
    await bookmarksRepo.deleteBookmark(bookmark.id);
    expect(await bookmarksRepo.listBookmarks(doc.id)).toHaveLength(0);
  });
});

describe('settings', () => {
  it('returns defaults and merges partial updates', async () => {
    const initial = await settingsRepo.getSettings();
    expect(initial.themeMode).toBe('light');
    const updated = await settingsRepo.updateSettings({ themeMode: 'dark', userName: 'Ada' });
    expect(updated.themeMode).toBe('dark');
    const reloaded = await settingsRepo.getSettings();
    expect(reloaded.userName).toBe('Ada');
    expect(reloaded.autosaveEnabled).toBe(true);
  });

  it('never persists PIN material in the settings blob', async () => {
    await settingsRepo.updateSettings({ pinHash: 'secret-hash', pinSalt: 'salt' });
    const row = await ctx.db.get<{ value: string }>('SELECT value FROM user_settings WHERE key = ?', ['app']);
    expect(row?.value ?? '').not.toContain('secret-hash');
  });
});

async function exportBytes(db: SqlDatabase): Promise<Uint8Array> {
  await db.flush?.();
  if (!db.exportBytes) throw new Error('export helper unavailable');
  return db.exportBytes();
}
