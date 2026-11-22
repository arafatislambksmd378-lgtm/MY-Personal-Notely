/**
 * Domain models. These mirror the SQLite schema in `src/db/migrations`; the
 * repositories are the only place that translate between rows and these types.
 */
import type { AccentName } from '@/design/tokens';

export type Orientation = 'portrait' | 'landscape';
export type PaperSize = 'A4' | 'A5' | 'Letter' | 'Legal';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSetup {
  orientation: Orientation;
  paperSize: PaperSize;
  margins: PageMargins;
  pageColor: string;
  headerText: string;
  footerText: string;
  pageNumbers: boolean;
  lineHeight: number;
}

export const defaultPageSetup: PageSetup = {
  orientation: 'portrait',
  paperSize: 'A4',
  margins: { top: 56, right: 48, bottom: 56, left: 48 },
  pageColor: '#FFFFFF',
  headerText: '',
  footerText: '',
  pageNumbers: true,
  lineHeight: 1.55,
};

export interface Notebook {
  id: string;
  name: string;
  color: AccentName;
  icon: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NotebookWithCount extends Notebook {
  noteCount: number;
}

export interface DocumentRecord {
  id: string;
  notebookId: string;
  title: string;
  contentHtml: string;
  plainText: string;
  excerpt: string;
  cardColor: AccentName;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  deletedAt: string | null;
  pageSetup: PageSetup;
  wordCount: number;
  charCount: number;
  readingMinutes: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface DocumentSummary {
  id: string;
  notebookId: string;
  title: string;
  excerpt: string;
  cardColor: AccentName;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  deletedAt: string | null;
  wordCount: number;
  readingMinutes: number;
  updatedAt: string;
  createdAt: string;
  notebookName?: string;
  tags?: string[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  contentHtml: string;
  wordCount: number;
  label: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: AccentName;
  createdAt: string;
}

export interface DocComment {
  id: string;
  documentId: string;
  author: string;
  body: string;
  quote: string | null;
  isResolved: boolean;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  documentId: string;
  label: string;
  anchor: string;
  createdAt: string;
}

export type MediaKind = 'image' | 'drawing' | 'chart' | 'scan' | 'audio';

export interface MediaAsset {
  id: string;
  documentId: string;
  kind: MediaKind;
  uri: string;
  byteSize: number;
  createdAt: string;
}

export interface DocumentShare {
  id: string;
  documentId: string;
  format: string;
  target: string;
  createdAt: string;
}

export interface UserSettings {
  themeMode: 'light' | 'dark' | 'system';
  accent: AccentName;
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  pinSalt: string | null;
  pinHash: string | null;
  spellcheckEnabled: boolean;
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  versionHistoryEnabled: boolean;
  cloudSyncEnabled: boolean;
  userName: string;
  workspaceName: string;
  lastBackupAt: string | null;
  defaultNotebookId: string | null;
  editorFontScale: number;
}

export const defaultSettings: UserSettings = {
  themeMode: 'light',
  accent: 'purple',
  appLockEnabled: false,
  biometricEnabled: false,
  pinSalt: null,
  pinHash: null,
  spellcheckEnabled: true,
  autosaveEnabled: true,
  autosaveIntervalMs: 1200,
  versionHistoryEnabled: true,
  cloudSyncEnabled: false,
  userName: 'Writer',
  workspaceName: 'Personal workspace',
  lastBackupAt: null,
  defaultNotebookId: null,
  editorFontScale: 1,
};

export type SyncOp = 'upsert' | 'delete';
export type SyncEntity = 'notebook' | 'document' | 'version' | 'comment' | 'bookmark' | 'tag';

export interface SyncQueueItem {
  id: string;
  entity: SyncEntity;
  entityId: string;
  op: SyncOp;
  payload: string;
  attempts: number;
  createdAt: string;
}
