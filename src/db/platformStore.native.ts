import type { SqlDatabase } from './sql';
import { openNativeDatabase } from './drivers/expoSqlite.native';

export async function openPlatformDatabase(): Promise<SqlDatabase> {
  return openNativeDatabase();
}
