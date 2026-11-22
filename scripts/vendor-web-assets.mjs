#!/usr/bin/env node
/**
 * Copies the SQLite WebAssembly engine into /public so the static web build can
 * boot the same database as the native app. Runs automatically before
 * `npm run build:web` (and is safe to re-run).
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = [
  ['node_modules/sql.js/dist/sql-wasm.js', 'public/sql.js'],
  ['node_modules/sql.js/dist/sql-wasm.wasm', 'public/sql-wasm.wasm'],
];

await mkdir(resolve(root, 'public'), { recursive: true });

for (const [from, to] of assets) {
  const source = resolve(root, from);
  const target = resolve(root, to);
  const info = await stat(source).catch(() => null);
  if (!info) {
    console.error(`✖ Missing ${from}. Run npm install first.`);
    process.exit(1);
  }
  await copyFile(source, target);
  console.log(`✓ ${to} (${Math.round(info.size / 1024)} KB)`);
}
