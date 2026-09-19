/**
 * Interner Link-Check ueber ein gebautes Verzeichnis.
 *
 *   node --experimental-strip-types scripts/link-check.ts starter/dist
 *
 * Prueft href und src jeder HTML-Datei auf ein vorhandenes Ziel und meldet
 * Anker, die auf keine id im Zieldokument zeigen. Externe Adressen werden
 * gezaehlt, aber nicht abgerufen; ein QA-Lauf soll offline funktionieren.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';

const wurzel = resolve(process.argv[2] ?? 'dist');

function htmlDateien(verzeichnis: string): string[] {
  const treffer: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) treffer.push(...htmlDateien(pfad));
    else if (extname(eintrag.name) === '.html') treffer.push(pfad);
  }
  return treffer;
}

function existiert(zielPfad: string): boolean {
  for (const kandidat of [zielPfad, join(zielPfad, 'index.html'), `${zielPfad}.html`]) {
    if (existsSync(kandidat) && statSync(kandidat).isFile()) return true;
  }
  return false;
}

function idsVon(zielPfad: string): Set<string> {
  for (const kandidat of [zielPfad, join(zielPfad, 'index.html'), `${zielPfad}.html`]) {
    if (existsSync(kandidat) && statSync(kandidat).isFile()) {
      const html = readFileSync(kandidat, 'utf8');
      return new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]));
    }
  }
  return new Set();
}

const dateien = htmlDateien(wurzel);
const tot: string[] = [];
let intern = 0;
let extern = 0;

for (const datei of dateien) {
  const html = readFileSync(datei, 'utf8');
  const relativ = datei.slice(wurzel.length) || '/';
  for (const treffer of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
    const roh = treffer[1].trim();
    if (!roh || roh.startsWith('#') || roh.startsWith('data:')) continue;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(roh)) { extern++; continue; }
    intern++;
    const [pfadTeil, anker] = roh.split('#');
    const zielPfad = pfadTeil.startsWith('/')
      ? join(wurzel, pfadTeil)
      : resolve(dirname(datei), pfadTeil);
    if (!existiert(zielPfad)) { tot.push(`${relativ}  ->  ${roh}  (Ziel fehlt)`); continue; }
    if (anker && !idsVon(zielPfad).has(anker)) tot.push(`${relativ}  ->  ${roh}  (Anker fehlt)`);
  }
}

for (const zeile of tot) console.log(`   TOT  ${zeile}`);
console.log(`   ${dateien.length} Seiten, ${intern} interne und ${extern} externe Verweise, ${tot.length} tote Links`);
process.exit(tot.length ? 1 : 0);
