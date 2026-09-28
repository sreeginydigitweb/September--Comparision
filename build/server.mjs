// server.mjs — minimal zero-dependency static server for the dashboard.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html; charset=utf-8', '.json':'application/json; charset=utf-8',
                '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
const START = Number(process.env.PORT) || 3000;

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let rel = normalize(url === '/' ? '/index.html' : url).split(sep).filter(Boolean).join(sep);
    const file = resolve(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
                         'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type':'text/plain' }).end('Not found'); }
});

function listen(port, tries = 12) {
  server.once('error', e => {
    if (e.code === 'EADDRINUSE' && tries > 0) { console.log(`port ${port} busy, trying ${port+1}…`); listen(port+1, tries-1); }
    else { console.error(e.message); process.exit(1); }
  });
  server.listen(port, () => console.log(`September Comparison dashboard: http://localhost:${port}`));
}
listen(START);
