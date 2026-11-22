/**
 * Ordered, forward-only migrations.
 *
 * Rules:
 *  - never edit a migration that has shipped; add a new one instead;
 *  - every migration must be idempotent-safe inside a transaction;
 *  - `up` SQL is executed with the shared `exec` on both native and web.
 */
export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS notebooks (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'purple',
        icon TEXT NOT NULL DEFAULT 'book',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        content_html TEXT NOT NULL DEFAULT '',
        plain_text TEXT NOT NULL DEFAULT '',
        excerpt TEXT NOT NULL DEFAULT '',
        card_color TEXT NOT NULL DEFAULT 'purple',
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        page_setup_json TEXT NOT NULL DEFAULT '{}',
        word_count INTEGER NOT NULL DEFAULT 0,
        char_count INTEGER NOT NULL DEFAULT 0,
        reading_minutes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_documents_notebook ON documents(notebook_id);
      CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(deleted_at);

      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        content_html TEXT NOT NULL DEFAULT '',
        word_count INTEGER NOT NULL DEFAULT 0,
        label TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'purple',
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS document_tags (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        author TEXT NOT NULL DEFAULT 'You',
        body TEXT NOT NULL,
        quote TEXT,
        is_resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_document ON comments(document_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        anchor TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bookmarks_document ON bookmarks(document_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        uri TEXT NOT NULL,
        byte_size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_media_document ON media_assets(document_id);

      CREATE TABLE IF NOT EXISTS document_shares (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        format TEXT NOT NULL,
        target TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        op TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);

      CREATE TABLE IF NOT EXISTS app_events (
        id TEXT PRIMARY KEY NOT NULL,
        level TEXT NOT NULL,
        scope TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'search_indexes',
    up: `
      CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_documents_pinned ON documents(is_pinned, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_favorite ON documents(is_favorite, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_archived ON documents(is_archived, deleted_at);
    `,
  },
  {
    version: 3,
    name: 'sync_state',
    up: `
      ALTER TABLE documents ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local';
      ALTER TABLE documents ADD COLUMN remote_updated_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_documents_sync_state ON documents(sync_state);
    `,
  },
  {
    version: 4,
    name: 'notebook_archive_flag',
    up: `
      ALTER TABLE notebooks ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_notebooks_sort ON notebooks(is_archived, sort_order);
    `,
  },
];
