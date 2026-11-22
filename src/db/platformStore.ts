/**
 * Fallback used only by the TypeScript compiler; Metro resolves
 * `platformStore.native.ts` on Android/iOS and `platformStore.web.ts` on web.
 */
import type { SqlDatabase } from './sql';

export async function openPlatformDatabase(): Promise<SqlDatabase> {
  throw new Error('No database driver resolved for this platform.');
}
