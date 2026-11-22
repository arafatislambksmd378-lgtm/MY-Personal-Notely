/** Row shapes and mappers between SQLite rows and domain models. */
import type {
  Bookmark,
  DocComment,
  DocumentRecord,
  DocumentVersion,
  MediaAsset,
  Notebook,
  NotebookWithCount,
  Tag,
  UserSettings,
} from '@/types/models';
import type { AccentName } from '@/design/tokens';
import { parsePageSetup, safeJsonParse } from '@/utils/validation';

export interface NotebookRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_default: number;
  is_archived?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  note_count?: number;
}

export interface DocumentRow {
  id: string;
  notebook_id: string;
  title: string;
  content_html: string;
  plain_text: string;
  excerpt: string;
  card_color: string;
  is_favorite: number;
  is_pinned: number;
  is_archived: number;
  deleted_at: string | null;
  page_setup_json: string;
  word_count: number;
  char_count: number;
  reading_minutes: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  notebook_name?: string;
}

export interface VersionRow {
  id: string;
  document_id: string;
  title: string;
  content_html: string;
  word_count: number;
  label: string | null;
  created_at: string;
}

export interface CommentRow {
  id: string;
  document_id: string;
  author: string;
  body: string;
  quote: string | null;
  is_resolved: number;
  created_at: string;
}

export interface BookmarkRow {
  id: string;
  document_id: string;
  label: string;
  anchor: string;
  created_at: string;
}

export interface MediaRow {
  id: string;
  document_id: string;
  kind: string;
  uri: string;
  byte_size: number;
  created_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export function asAccent(value: string | null | undefined): AccentName {
  const allowed: AccentName[] = ['purple', 'blue', 'green', 'amber', 'pink', 'teal', 'orange', 'red'];
  return allowed.includes((value ?? '') as AccentName) ? (value as AccentName) : 'purple';
}

export function mapNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    name: row.name,
    color: asAccent(row.color),
    icon: row.icon,
    sortOrder: Number(row.sort_order ?? 0),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapNotebookWithCount(row: NotebookRow): NotebookWithCount {
  return { ...mapNotebook(row), noteCount: Number(row.note_count ?? 0) };
}

export function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    title: row.title ?? '',
    contentHtml: row.content_html ?? '',
    plainText: row.plain_text ?? '',
    excerpt: row.excerpt ?? '',
    cardColor: asAccent(row.card_color),
    isFavorite: Boolean(row.is_favorite),
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    deletedAt: row.deleted_at,
    pageSetup: parsePageSetup(row.page_setup_json),
    wordCount: Number(row.word_count ?? 0),
    charCount: Number(row.char_count ?? 0),
    readingMinutes: Number(row.reading_minutes ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  };
}

export function mapVersion(row: VersionRow): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    contentHtml: row.content_html,
    wordCount: Number(row.word_count ?? 0),
    label: row.label,
    createdAt: row.created_at,
  };
}

export function mapComment(row: CommentRow): DocComment {
  return {
    id: row.id,
    documentId: row.document_id,
    author: row.author,
    body: row.body,
    quote: row.quote,
    isResolved: Boolean(row.is_resolved),
    createdAt: row.created_at,
  };
}

export function mapBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    documentId: row.document_id,
    label: row.label,
    anchor: row.anchor,
    createdAt: row.created_at,
  };
}

export function mapMedia(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    documentId: row.document_id,
    kind: row.kind as MediaAsset['kind'],
    uri: row.uri,
    byteSize: Number(row.byte_size ?? 0),
    createdAt: row.created_at,
  };
}

export function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: asAccent(row.color),
    createdAt: row.created_at,
  };
}

/** Settings are stored as one JSON document under the `app` key plus scalars. */
export function readSettingsRows(rows: Array<{ key: string; value: string }>): Partial<UserSettings> {
  const merged: Record<string, unknown> = {};
  for (const row of rows) {
    merged[row.key] = safeJsonParse<unknown>(row.value, null);
  }
  return merged as Partial<UserSettings>;
}
