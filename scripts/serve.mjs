/** Minimaler statischer Server fuer den QA-Lauf. Keine Abhaengigkeit, kein Build. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const wurzel = process.argv[2] ?? 'dist';
const port = Number(process.argv[3] ?? 4321);

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

async function aufloesen(pfad) {
  const kandidaten = [pfad, join(pfad, 'index.html'), `${pfad}.html`];
  for (const k of kandidaten) {
    try {
      const s = await stat(k);
      if (s.isFile()) return k;
    } catch { /* naechster Kandidat */ }
  }
  return null;
}

createServer(async (anfrage, antwort) => {
  const url = new URL(anfrage.url ?? '/', `http://localhost:${port}`);
  // normalize + Praefixpruefung verhindert Ausbruch aus dem Build-Verzeichnis
  const ziel = normalize(join(wurzel, decodeURIComponent(url.pathname)));
  if (!ziel.startsWith(normalize(wurzel))) {
    antwort.writeHead(403).end('Forbidden');
    return;
  }
  const datei = await aufloesen(ziel);
  if (!datei) {
    const vierNullVier = await aufloesen(join(wurzel, '404.html'));
    if (vierNullVier) {
      antwort.writeHead(404, { 'Content-Type': TYPEN['.html'] }).end(await readFile(vierNullVier));
    } else {
      antwort.writeHead(404).end('Not found');
    }
    return;
  }
  antwort.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream' });
  antwort.end(await readFile(datei));
}).listen(port, () => console.error(`serve: ${wurzel} auf http://localhost:${port}`));
