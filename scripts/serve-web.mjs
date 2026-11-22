#!/usr/bin/env node
/**
 * Static preview server for the exported web build.
 *
 * Serves `dist/` (or `--dir`), falls back to index.html for client-side routes,
 * and sends the right MIME types for the SQLite wasm engine.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const root = resolve(flag('dir', 'dist'));
const port = Number(process.env.PORT ?? flag('port', 4173));
const host = flag('host', '0.0.0.0');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const decoded = decodeURIComponent(url.pathname);
    const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(root, relative);

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      const dirIndex = join(filePath, 'index.html');
      const dirIndexInfo = await stat(dirIndex).catch(() => null);
      if (dirIndexInfo) {
        filePath = dirIndex;
        info = dirIndexInfo;
      }
    }
    if (!info && !extname(relative)) {
      // Try the route as a directory with an index, then the SPA shell.
      const withIndex = join(filePath, 'index.html');
      const indexInfo = await stat(withIndex).catch(() => null);
      if (indexInfo) {
        filePath = withIndex;
        info = indexInfo;
      } else {
        const htmlRoute = `${filePath}.html`;
        const htmlInfo = await stat(htmlRoute).catch(() => null);
        if (htmlInfo) {
          filePath = htmlRoute;
          info = htmlInfo;
        }
      }
    }
    if (!info) {
      filePath = join(root, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info || !info.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Not found: ${decoded}\nBuild the web app first with: npm run build:web`);
      return;
    }

    const extension = extname(filePath).toLowerCase();
    const type = MIME[extension] ?? 'application/octet-stream';
    const immutable = /\.[0-9a-f]{8,}\./.test(filePath) || extension === '.woff2';
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      // Keep the SQLite wasm engine and shared buffers working in any embedding.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
});

server.listen(port, host, () => {
  console.log(`Notely web preview → http://localhost:${port} (serving ${root}, bound to ${host})`);
});
