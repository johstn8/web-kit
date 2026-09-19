/**
 * axe-core gegen eine laufende Website, ueber das DevTools-Protokoll.
 *
 *   node --experimental-strip-types scripts/check-axe.ts \
 *     --base http://localhost:4321 [--pfade /,/kontakt] [--out bericht/axe.json]
 *
 * Bewusst ohne @axe-core/cli: die braucht chromedriver und faellt damit auf
 * jeder Maschine aus, auf der nur ein entpackter Chromium liegt. Hier wird
 * derselbe Browser gesteuert, der auch die Screenshots erzeugt.
 *
 * Geprueft wird gegen WCAG 2.1 AA. Verstoesse fuehren zu Exit-Code 1.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}

const basis = arg('--base', 'http://localhost:4321')!.replace(/\/$/, '');
const pfade = arg('--pfade', '/,/leistungen,/kontakt')!.split(',').map((p) => p.trim()).filter(Boolean);
const ausgabe = resolve(arg('--out', join(here, '../starter/qa-bericht/axe.json'))!);

const axeQuelle = [
  join(here, '../starter/node_modules/axe-core/axe.min.js'),
  join(here, '../node_modules/axe-core/axe.min.js'),
].find((p) => existsSync(p));

if (!axeQuelle) {
  console.error('axe-core nicht gefunden. Im Projekt installieren: npm install --save-dev axe-core');
  process.exit(2);
}
const axeCode = readFileSync(axeQuelle, 'utf8');

function chromiumSuchen(): string | null {
  const kandidaten: string[] = [];
  const cache = join(homedir(), '.cache/ms-playwright');
  if (existsSync(cache)) {
    for (const eintrag of readdirSync(cache)) {
      if (eintrag.startsWith('chromium-')) {
        kandidaten.push(join(cache, eintrag, 'chrome-linux64/chrome'));
        kandidaten.push(join(cache, eintrag, 'chrome-linux/chrome'));
      }
    }
  }
  kandidaten.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return kandidaten.reverse().find((k) => existsSync(k)) ?? null;
}

function bibliothekspfad(): string | null {
  return [
    join(homedir(), '.local/lib/chromium-deps/usr/lib/x86_64-linux-gnu'),
    join(homedir(), '.local/lib/chromium-deps'),
  ].find((k) => existsSync(k)) ?? null;
}

const binary = chromiumSuchen();
if (!binary) {
  console.error('Kein Browser verfuegbar. Ohne Browser ist die Accessibility-Pruefung nicht belegt.');
  process.exit(2);
}

const port = 9800 + Math.floor(Math.random() * 400);
const libs = bibliothekspfad();
const umgebung = { ...process.env };
if (libs) umgebung.LD_LIBRARY_PATH = umgebung.LD_LIBRARY_PATH ? `${libs}:${umgebung.LD_LIBRARY_PATH}` : libs;

const prozess = spawn(binary, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore', detached: true, env: umgebung });

const warten = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ws = '';
for (let versuch = 0; versuch < 60; versuch++) {
  await warten(250);
  try {
    const antwort = await fetch(`http://127.0.0.1:${port}/json/version`);
    ws = ((await antwort.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
    if (ws) break;
  } catch { /* noch nicht bereit */ }
}
if (!ws) { prozess.kill(); console.error('Browser nicht erreichbar.'); process.exit(2); }

const socket = new WebSocket(ws);
await new Promise((r, x) => { socket.onopen = r; socket.onerror = x; });
let id = 0;
const offen = new Map<number, (wert: any) => void>();
socket.onmessage = (e) => {
  const d = JSON.parse(String(e.data));
  if (d.id && offen.has(d.id)) { offen.get(d.id)!(d.result); offen.delete(d.id); }
};
const senden = (methode: string, params: unknown = {}, sessionId?: string) =>
  new Promise<any>((auf) => { const n = ++id; offen.set(n, auf); socket.send(JSON.stringify({ id: n, method: methode, params, sessionId })); });

const { targetId } = await senden('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await senden('Target.attachToTarget', { targetId, flatten: true });
await senden('Page.enable', {}, sessionId);
await senden('Runtime.enable', {}, sessionId);

interface Verstoss { id: string; impact: string; help: string; helpUrl: string; nodes: number; seite: string }
const verstoesse: Verstoss[] = [];
const alles: Record<string, unknown> = {};

try {
  for (const pfad of pfade) {
    await senden('Page.navigate', { url: basis + pfad }, sessionId);
    await warten(900);
    await senden('Runtime.evaluate', { expression: axeCode, returnByValue: false }, sessionId);
    const ergebnis = await senden('Runtime.evaluate', {
      expression: `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => JSON.stringify({ violations: r.violations, passes: r.passes.length }))`,
      awaitPromise: true, returnByValue: true,
    }, sessionId);

    const roh = ergebnis?.result?.value;
    if (!roh) { console.error(`   FEHLER: axe lieferte kein Ergebnis fuer ${pfad}`); process.exitCode = 1; continue; }
    const daten = JSON.parse(roh) as { violations: any[]; passes: number };
    alles[pfad] = daten;
    for (const v of daten.violations) {
      verstoesse.push({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length, seite: pfad });
    }
    console.log(`   ${pfad}: ${daten.passes} Regeln bestanden, ${daten.violations.length} Verstoesse`);
  }
} finally {
  socket.close();
  try { process.kill(-prozess.pid!); } catch { prozess.kill(); }
}

mkdirSync(dirname(ausgabe), { recursive: true });
writeFileSync(ausgabe, JSON.stringify({ basis, geprueft: new Date().toISOString(), ergebnisse: alles }, null, 2) + '\n', 'utf8');

for (const v of verstoesse) {
  console.log(`   FEHLER ${v.seite}  ${v.id} (${v.impact}, ${v.nodes} Stellen): ${v.help}`);
  console.log(`          ${v.helpUrl}`);
}
console.log(`   ${pfade.length} Seiten geprueft, ${verstoesse.length} Verstoesse. Bericht: ${ausgabe}`);
process.exit(verstoesse.length ? 1 : (process.exitCode ?? 0));
