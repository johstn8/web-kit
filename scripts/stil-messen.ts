/**
 * Misst die Stilgrammatik einer Live-Website: Schriften, Type Ramp,
 * Aktionsform, Kachel- und Bildradien, Grund und Akzent. Dazu Aufnahmen bei
 * 1440 und 390 Pixel.
 *
 *   node --experimental-strip-types scripts/stil-messen.ts \
 *     --url https://www.rico-gmbh.de --out ../projekte/<kunde>/research/stil/rico
 *
 * Wofuer: Stilrecherche je Auftrag und Inspirationseingang des Nutzers,
 * siehe web-brain 90-references/reference-research-workflow.md#Stilrecherche
 * und 90-references/inspiration-eingang.md. Ein Screenshot zeigt, wie eine
 * Seite wirkt; die Messung sagt, mit welchen Werten. Erst beides zusammen
 * laesst sich in ein Preset uebersetzen, ohne zu raten.
 *
 * Gemessen wird nach dem Laden und einem Scroll ueber die Seite, damit
 * nachgeladene Abschnitte mitzaehlen. Einwilligungsbanner werden nicht
 * weggeklickt; sie koennen die Aufnahmen verdecken, nicht die Messung.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}

const url = arg('--url');
if (!url) { console.error('--url fehlt'); process.exit(2); }
const ziel = resolve(arg('--out', 'stil-messung')!);
mkdirSync(ziel, { recursive: true });

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

/** Laeuft im Dokument. Liefert die Messung als JSON. */
const MESSUNG = String.raw`(() => {
  const sicht = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const stufe = (sel) => {
    const el = [...document.querySelectorAll(sel)].find(sicht);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { familie: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(), groesse: s.fontSize, gewicht: s.fontWeight, zeilenhoehe: s.lineHeight, laufweite: s.letterSpacing, versal: s.textTransform, farbe: s.color, text: el.textContent.trim().slice(0, 60) };
  };
  const leer = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const haeufig = (liste) => { const z = new Map(); for (const x of liste) z.set(x, (z.get(x) || 0) + 1); return [...z.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); };

  // Aktionen: kurze Links und Buttons mit eigener Flaeche oder eigenem Rahmen.
  const aktionen = [...document.querySelectorAll('a, button')].filter(sicht).filter((el) => {
    const s = getComputedStyle(el); const t = el.textContent.trim();
    return t.length > 1 && t.length < 40 && (!leer(s.backgroundColor) || parseFloat(s.borderTopWidth) > 0) && el.getBoundingClientRect().height >= 28;
  }).slice(0, 30).map((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { text: el.textContent.trim().slice(0, 30), radius: s.borderTopLeftRadius, hoehe: Math.round(r.height), polster: s.padding, grund: s.backgroundColor, schrift: s.fontWeight + ' ' + s.fontSize, rahmen: s.borderTopWidth + ' ' + s.borderTopColor }; });

  // Flaechen: Bloecke mit eigenem Grund und spuerbarer Groesse, etwa Kacheln.
  const koerper = getComputedStyle(document.body).backgroundColor;
  const flaechen = [...document.querySelectorAll('div, section, article, li, figure')].filter(sicht).filter((el) => {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return !leer(s.backgroundColor) && s.backgroundColor !== koerper && r.width > 160 && r.height > 120 && r.width < innerWidth * 0.95;
  });
  const bilder = [...document.querySelectorAll('img, video, picture')].filter(sicht).filter((el) => el.getBoundingClientRect().width > 160);

  return JSON.stringify({
    titel: document.title,
    schriften: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '') + ' ' + f.weight))],
    stufen: { h1: stufe('h1'), h2: stufe('h2'), h3: stufe('h3'), absatz: stufe('main p, p') },
    grund: { html: getComputedStyle(document.documentElement).backgroundColor, body: koerper },
    aktionen,
    aktionsRadien: haeufig(aktionen.map((a) => a.radius)),
    aktionsFarben: haeufig(aktionen.map((a) => a.grund).filter((c) => !leer(c))),
    flaechenRadien: haeufig(flaechen.map((el) => getComputedStyle(el).borderTopLeftRadius)),
    flaechenFarben: haeufig(flaechen.map((el) => getComputedStyle(el).backgroundColor)),
    schatten: haeufig(flaechen.map((el) => getComputedStyle(el).boxShadow).filter((x) => x !== 'none')),
    bildRadien: haeufig(bilder.map((el) => getComputedStyle(el).borderTopLeftRadius)),
    hoehe: document.documentElement.scrollHeight,
  });
})()`;

const binary = chromiumSuchen();
if (!binary) { console.error('Kein Browser verfuegbar.'); process.exit(2); }
const port = 9700 + Math.floor(Math.random() * 200);
const libs = bibliothekspfad();
const umgebung = { ...process.env };
if (libs) umgebung.LD_LIBRARY_PATH = umgebung.LD_LIBRARY_PATH ? `${libs}:${umgebung.LD_LIBRARY_PATH}` : libs;
const prozess = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, 'about:blank'],
  { stdio: 'ignore', detached: true, env: umgebung });

const warten = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ws = '';
for (let v = 0; v < 60 && !ws; v++) {
  await warten(250);
  try { ws = ((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl; } catch { /* noch nicht bereit */ }
}
if (!ws) { prozess.kill(); console.error('Browser nicht erreichbar.'); process.exit(2); }

const socket = new WebSocket(ws);
await new Promise((r, x) => { socket.onopen = r; socket.onerror = x; });
let id = 0;
const offen = new Map<number, (wert: any) => void>();
socket.onmessage = (e) => { const d = JSON.parse(String(e.data)); if (d.id && offen.has(d.id)) { offen.get(d.id)!(d.result); offen.delete(d.id); } };
const senden = (methode: string, params: unknown = {}, sessionId?: string) =>
  new Promise<any>((auf) => { const n = ++id; offen.set(n, auf); socket.send(JSON.stringify({ id: n, method: methode, params, sessionId })); });

const { targetId } = await senden('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await senden('Target.attachToTarget', { targetId, flatten: true });
await senden('Page.enable', {}, sessionId);
await senden('Runtime.enable', {}, sessionId);

const auswerten = async (ausdruck: string) =>
  (await senden('Runtime.evaluate', { expression: ausdruck, returnByValue: true, awaitPromise: true }, sessionId))?.result?.value;

try {
  let messung: any = null;
  for (const [breite, hoehe, mobil] of [[1440, 900, false], [390, 844, true]] as const) {
    await senden('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: mobil }, sessionId);
    await senden('Page.navigate', { url }, sessionId);
    await warten(2500);
    await auswerten('document.fonts.ready.then(() => 1)');
    // Einmal durchscrollen, damit nachgeladene Abschnitte und Bilder erscheinen.
    await auswerten('(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } scrollTo(0, 0); })()');
    await warten(800);
    if (!mobil) messung = JSON.parse(await auswerten(MESSUNG));
    const { data } = await senden('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(ziel, `auftakt-${breite}.png`), Buffer.from(data, 'base64'));
  }

  messung.url = url;
  messung.gemessen = new Date().toISOString();
  writeFileSync(join(ziel, 'messung.json'), JSON.stringify(messung, null, 2));

  const s = messung.stufen;
  const zeile = (n: string, x: any) => x ? `   ${n.padEnd(7)} ${x.familie} ${x.gewicht}, ${x.groesse}, Laufweite ${x.laufweite}${x.versal !== 'none' ? `, ${x.versal}` : ''}` : `   ${n.padEnd(7)} nicht gefunden`;
  console.log(`${messung.titel}\n${url}\n`);
  console.log(`   Schriften  ${messung.schriften.join(', ') || 'keine eigenen'}`);
  for (const k of ['h1', 'h2', 'h3', 'absatz']) console.log(zeile(k, s[k]));
  console.log(`   Grund      ${messung.grund.body}`);
  console.log(`   Aktionen   Radius ${messung.aktionsRadien.map(([r, n]: [string, number]) => `${r} (${n}x)`).join(', ') || '-'}`);
  console.log(`              Farben ${messung.aktionsFarben.map(([c]: [string]) => c).join(', ') || '-'}`);
  console.log(`   Flaechen   Radius ${messung.flaechenRadien.map(([r, n]: [string, number]) => `${r} (${n}x)`).join(', ') || '-'}`);
  console.log(`              Farben ${messung.flaechenFarben.map(([c]: [string]) => c).join(', ') || '-'}`);
  console.log(`   Bilder     Radius ${messung.bildRadien.map(([r, n]: [string, number]) => `${r} (${n}x)`).join(', ') || '-'}`);
  console.log(`   Schatten   ${messung.schatten.length ? messung.schatten.map(([x]: [string]) => x).join(' | ') : 'keine'}`);
  console.log(`\n   Messung und Aufnahmen in ${ziel}`);
} finally {
  socket.close();
  try { process.kill(-prozess.pid!); } catch { prozess.kill(); }
}
