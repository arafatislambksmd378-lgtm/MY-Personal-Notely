/**
 * Notebook icon keys are stored as stable strings in the database so the set of
 * icons can grow without migrating rows.
 */
import type { IoniconName } from '@/components/IconTile';

export const NOTEBOOK_ICONS: { key: string; icon: IoniconName; label: string }[] = [
  { key: 'book', icon: 'book', label: 'Book' },
  { key: 'briefcase', icon: 'briefcase', label: 'Work' },
  { key: 'bulb', icon: 'bulb', label: 'Ideas' },
  { key: 'library', icon: 'library', label: 'Study' },
  { key: 'leaf', icon: 'leaf', label: 'Personal' },
  { key: 'flask', icon: 'flask', label: 'Research' },
  { key: 'musical-notes', icon: 'musical-notes', label: 'Music' },
  { key: 'plane', icon: 'airplane', label: 'Travel' },
  { key: 'heart', icon: 'heart', label: 'Favorites' },
  { key: 'folder', icon: 'folder', label: 'Folder' },
];

const ICON_MAP = new Map(NOTEBOOK_ICONS.map((entry) => [entry.key, entry.icon]));

export function notebookIconName(key: string): IoniconName {
  return ICON_MAP.get(key) ?? 'book';
}
