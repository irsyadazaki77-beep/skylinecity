import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const portArgumentIndex = process.argv.indexOf('--port');
const port = Number(portArgumentIndex >= 0 ? process.argv[portArgumentIndex + 1] : 3002);
const hostArgumentIndex = process.argv.indexOf('--host');
const host = hostArgumentIndex >= 0 ? process.argv[hostArgumentIndex + 1] : '127.0.0.1';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function safePath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const candidate = normalize(join(distRoot, decoded === '/' ? 'index.html' : decoded));
  return candidate.startsWith(distRoot) ? candidate : null;
}

const server = createServer(async (request, response) => {
  try {
    const requestedPath = safePath(request.url ?? '/');
    if (!requestedPath) {
      response.writeHead(400).end('Bad request');
      return;
    }
    let filePath = requestedPath;
    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // Vite's SPA fallback is required for client-side routes.
      filePath = join(distRoot, 'index.html');
      body = await readFile(filePath);
    }
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(500).end('Internal server error');
  }
});

server.listen(port, host, () => {
  console.log(`Serving dist on http://${host}:${port}`);
});
