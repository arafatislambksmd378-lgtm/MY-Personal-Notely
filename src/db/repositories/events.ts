/**
 * Lightweight diagnostics log used by the Settings → Diagnostics screen.
 * Only the last 200 events are kept; nothing leaves the device.
 */
import { getDatabase } from '../index';
import { createId } from '@/utils/id';

export type EventLevel = 'info' | 'warn' | 'error';

export interface AppEvent {
  id: string;
  level: EventLevel;
  scope: string;
  message: string;
  context: string | null;
  createdAt: string;
}

const MAX_EVENTS = 200;

export async function logEvent(
  level: EventLevel,
  scope: string,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getDatabase();
    await db.run('INSERT INTO app_events (id, level, scope, message, context, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      createId('evt'),
      level,
      scope,
      message.slice(0, 500),
      context ? JSON.stringify(context).slice(0, 2000) : null,
      new Date().toISOString(),
    ]);
    await db.run(
      'DELETE FROM app_events WHERE id NOT IN (SELECT id FROM app_events ORDER BY created_at DESC LIMIT ?)',
      [MAX_EVENTS],
    );
  } catch {
    // Diagnostics must never break a user flow.
  }
}

export async function listEvents(limit = 50): Promise<AppEvent[]> {
  const db = await getDatabase();
  const rows = await db.all<{
    id: string;
    level: string;
    scope: string;
    message: string;
    context: string | null;
    created_at: string;
  }>('SELECT * FROM app_events ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map((row) => ({
    id: row.id,
    level: row.level as EventLevel,
    scope: row.scope,
    message: row.message,
    context: row.context,
    createdAt: row.created_at,
  }));
}

export async function clearEvents(): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM app_events');
}
