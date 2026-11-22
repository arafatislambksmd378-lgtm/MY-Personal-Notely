import type { SqlDatabase } from './sql';
import { openWebDatabase } from './drivers/sqljs.web';

export async function openPlatformDatabase(): Promise<SqlDatabase> {
  return openWebDatabase();
}
