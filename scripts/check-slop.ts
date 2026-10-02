/**
 * Harte Sperren gegen KI-Anmutung, am gerenderten Dokument gemessen.
 *
 *   node --experimental-strip-types scripts/check-slop.ts \
 *     --base http://localhost:4321 [--pfade /,/kontakt] [--out bericht/slop.json]
 *
 * Ohne --pfade werden die Routen aus /sitemap.xml gelesen.
 *
 * Geprueft wird, was web-brain 20-design/anti-ai-slop.md#Harte Sperren
 * ausdruecklich sperrt und was sich am Render feststellen laesst:
 *
 *   dachzeile          kurze Zeile direkt UEBER einer Ueberschrift, in Versalien,
 *                      gesperrt oder deutlich kleiner als die Ueberschrift
 *   nummernmarke       Sektionsziffer wie "01" oder "02 ·" ueber oder vor einer
 *                      Ueberschrift
 *   teilauszeichnung   ein Teil einer Ueberschrift in anderer Farbe, Kursive,
 *                      Familie, mit Flaeche oder Verlauf
 *   verlaufsschleier   ein Verlauf ueber oder als Maske auf einem grossen Foto
 *
 * Dazu ein Befund ohne Abbruch:
 *
 *   gleichfoermigkeit  aufeinanderfolgende Sektionen mit derselben Anordnung
 *                      (ab drei in Folge ein Abbruch)
 *
 * Warum am Render und nicht im Quelltext: Eine Dachzeile kann ein <p>, ein
 * <span>, ein ::before oder ein Teil der Bildunterschrift sein. Entscheidend
 * ist, was der Besucher sieht. Warum ueberhaupt maschinell: Diese Muster
 * wurden in drei Projekten trotz kanonischer Regel gebaut, weil jede Regel
 * einen Begruendungsweg hatte und sich immer eine Begruendung fand.
 *
 * Exit-Code 1 bei mindestens einer harten Sperre.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
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
const ausgabe = resolve(arg('--out', join(here, '../starter/qa-bericht/slop.json'))!);

async function routen(): Promise<string[]> {
  const gegeben = arg('--pfade');
  if (gegeben) return gegeben.split(',').map((p) => p.trim()).filter(Boolean);
  try {
    const xml = await (await fetch(`${basis}/sitemap.xml`)).text();
    const pfade = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
      try { return new URL(m[1]).pathname; } catch { return m[1]; }
    });
    if (pfade.length) return [...new Set(pfade)];
  } catch { /* keine Sitemap */ }
  return ['/'];
}

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

/** Laeuft im Dokument. Liefert Befunde als JSON. */
const MESSUNG = String.raw`(() => {
  const befunde = [];
  const sicht = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity) > 0.05;
  };
  const text = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
  const pfad = (el) => {
    const teile = [];
    for (let e = el; e && e.nodeType === 1 && teile.length < 4; e = e.parentElement) {
      teile.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''));
    }
    return teile.join(' > ');
  };
  /* Stil der sichtbaren Schrift: das tiefste Element mit eigenem Text. */
  const schriftstile = (el) => {
    const stile = [getComputedStyle(el)];
    for (const k of el.querySelectorAll('*')) {
      if ([...k.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) stile.push(getComputedStyle(k));
    }
    return stile;
  };
  const ueberschriften = [...document.querySelectorAll('h1, h2, h3')].filter(sicht);
  const NUMMER = /^\s*(0\d|\d{1,2}[.·/:–—-]|[IVX]{1,4}[.·])/;

  /* --- dachzeile und nummernmarke ------------------------------------- */
  for (const h of ueberschriften) {
    let kandidat = h.previousElementSibling, knoten = h, ebene = 0;
    while (!kandidat && ebene < 2 && knoten.parentElement) { knoten = knoten.parentElement; kandidat = knoten.previousElementSibling; ebene++; }
    if (!kandidat || !sicht(kandidat)) continue;
    if (/^(H[1-6]|NAV|HEADER|IMG|PICTURE|FIGURE|SVG|BUTTON|FORM|TABLE|VIDEO|IFRAME|SELECT|INPUT)$/.test(kandidat.tagName)) continue;
    if (kandidat.querySelector('img, picture, video, svg, h1, h2, h3, button, input')) continue;
    const t = text(kandidat);
    if (!t || t.length > 90) continue;
    const rk = kandidat.getBoundingClientRect(), rh = h.getBoundingClientRect();
    const hs = getComputedStyle(h);
    const hgr = parseFloat(hs.fontSize);
    if (rk.bottom > rh.top + 4) continue;                         /* nicht darueber */
    if (rh.top - rk.bottom > Math.max(56, hgr * 1.6)) continue;   /* zu weit weg */
    if (rk.right < rh.left || rk.left > rh.right) continue;       /* nicht in derselben Spalte */
    const stile = schriftstile(kandidat);
    const versal = stile.some((s) => s.textTransform === 'uppercase') || (/[A-ZÄÖÜ]{3}/.test(t) && t === t.toUpperCase());
    const gesperrt = stile.some((s) => (parseFloat(s.letterSpacing) || 0) / parseFloat(s.fontSize) >= 0.05);
    /* "klein" allein zaehlt nur bei einer kurzen Einzeilenzeile; ein Absatz
       Fliesstext vor der naechsten Ueberschrift ist keine Dachzeile. */
    const zeilenhoehe = parseFloat(getComputedStyle(kandidat).lineHeight) || parseFloat(getComputedStyle(kandidat).fontSize) * 1.4;
    const einzeilig = rk.height < zeilenhoehe * 1.8 && t.length <= 48;
    /* und nur, wenn sie eng an der Ueberschrift klebt: Ein Absatz vor einer
       neuen Sektion hat den grossen Sektionsabstand dazwischen. */
    const eng = rh.top - rk.bottom <= hgr * 0.6;
    const klein = einzeilig && eng && stile.every((s) => parseFloat(s.fontSize) < hgr * 0.6);
    if (NUMMER.test(t)) {
      befunde.push({ art: 'nummernmarke', hart: true, text: t, ueberschrift: text(h).slice(0, 70), ort: pfad(kandidat) });
    } else if (versal || gesperrt || klein) {
      befunde.push({ art: 'dachzeile', hart: true, text: t, ueberschrift: text(h).slice(0, 70), ort: pfad(kandidat),
        merkmal: [versal && 'Versalien', gesperrt && 'gesperrt', klein && 'klein'].filter(Boolean).join(', ') });
    }
  }
  for (const h of ueberschriften) {
    const t = text(h);
    if (/^\s*0\d\s/.test(t)) befunde.push({ art: 'nummernmarke', hart: true, text: t.slice(0, 70), ueberschrift: t.slice(0, 70), ort: pfad(h) });
  }

  /* --- teilauszeichnung --------------------------------------------- */
  for (const h of ueberschriften) {
    const hs = getComputedStyle(h);
    const ganz = text(h);
    for (const k of h.querySelectorAll('*')) {
      if (k.tagName === 'BR' || !sicht(k)) continue;
      const t = text(k);
      if (!t || t === ganz || t.replace(/\W/g, '').length < 3) continue; /* ganze Ueberschrift als Link, Einzelzeichen-Plakette */
      const ks = getComputedStyle(k);
      const merkmal = [];
      if (ks.color !== hs.color) merkmal.push('Farbe');
      if (ks.fontStyle !== hs.fontStyle) merkmal.push('Kursive');
      if (ks.fontFamily !== hs.fontFamily) merkmal.push('Familie');
      if (ks.backgroundImage !== 'none') merkmal.push('Verlauf');
      if (ks.backgroundColor !== 'rgba(0, 0, 0, 0)' && ks.backgroundColor !== hs.backgroundColor) merkmal.push('Flaeche');
      if (merkmal.length) befunde.push({ art: 'teilauszeichnung', hart: true, text: t, ueberschrift: ganz.slice(0, 70), merkmal: merkmal.join(', '), ort: pfad(k) });
    }
  }

  /* --- verlaufsschleier --------------------------------------------- */
  /* Gesperrt ist nicht jeder Verlauf, sondern die Ausblendung: ein Verlauf,
     der an einem Ende deckend wird (Alpha ab 0,85) und das Foto dort in eine
     Flaeche aufloest, oder eine Maske, die es transparent auslaufen laesst.
     Ein leichter Lesbarkeitsschleier bleibt erlaubt. */
  const alphas = (wert) => {
    const a = [];
    for (const m of String(wert).matchAll(/rgba?\(([^)]+)\)/g)) {
      const t = m[1].split(/[ ,/]+/).filter(Boolean);
      a.push(t.length >= 4 ? parseFloat(t[3]) : 1);
    }
    if (/\b(transparent)\b/.test(wert)) a.push(0);
    return a;
  };
  const deckendeAusblendung = (wert) => /gradient\(/.test(wert) && alphas(wert).some((x) => x >= 0.85) && alphas(wert).some((x) => x <= 0.5);
  const maskenAusblendung = (wert) => /gradient\(/.test(wert || '') && alphas(wert).some((x) => x <= 0.15);
  const verlauf = (st, istBild) => {
    if (!st) return false;
    const maske = st.maskImage || st.webkitMaskImage || '';
    if (maskenAusblendung(maske)) return true;
    return !istBild && deckendeAusblendung(st.backgroundImage);
  };
  const gemeldet = new Set();
  for (const bild of document.querySelectorAll('img, video, picture')) {
    if (!sicht(bild)) continue;
    const rb = bild.getBoundingClientRect();
    if (rb.width < innerWidth * 0.4 || rb.height < 200) continue;
    let treffer = null;
    if (verlauf(getComputedStyle(bild), true)) treffer = bild;
    for (let e = bild.parentElement, n = 0; !treffer && e && n < 4; e = e.parentElement, n++) {
      for (const p of ['::before', '::after']) if (verlauf(getComputedStyle(e, p))) { treffer = e; break; }
      if (!treffer && verlauf(getComputedStyle(e)) && e.getBoundingClientRect().height > 0) {
        /* ein Verlauf als Hintergrund eines Vorfahren liegt nur dann ueber dem Bild, wenn er eine eigene Ebene ist */
      }
      if (!treffer) for (const g of e.children) {
        if (g === bild || g.contains(bild)) continue;
        const gs = getComputedStyle(g);
        if ((gs.position === 'absolute' || gs.position === 'fixed') && verlauf(gs)) {
          const rg = g.getBoundingClientRect();
          const ueber = Math.max(0, Math.min(rg.right, rb.right) - Math.max(rg.left, rb.left)) * Math.max(0, Math.min(rg.bottom, rb.bottom) - Math.max(rg.top, rb.top));
          if (ueber > rb.width * rb.height * 0.3) { treffer = g; break; }
        }
      }
    }
    if (treffer && !gemeldet.has(treffer)) {
      gemeldet.add(treffer);
      befunde.push({ art: 'verlaufsschleier', hart: true, text: (bild.alt || bild.currentSrc || '').slice(0, 70), ort: pfad(treffer) });
    }
  }

  /* --- gleichfoermigkeit -------------------------------------------- */
  const startseite = /^\/(index\.html)?$/.test(location.pathname);
  const main = document.querySelector('main') || document.body;
  let bloecke = [...main.children].filter(sicht);
  if (bloecke.length === 1) bloecke = [...bloecke[0].children].filter(sicht);
  const signatur = (b) => {
    const h = b.querySelector('h2, h3');
    if (!h) return null;
    /* die Ausdehnung des gesetzten Textes, nicht des Blockkastens */
    const bereich = document.createRange(); bereich.selectNodeContents(h);
    const rh = bereich.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const bilder = [...b.querySelectorAll('img, video')].filter(sicht).filter((i) => i.getBoundingClientRect().width > 160);
    let bildlage = 'ohne';
    if (bilder.length) {
      const ri = bilder[0].getBoundingClientRect();
      bildlage = ri.width > rb.width * 0.8 ? 'vollbreit' : (ri.left + ri.width / 2 < rb.left + rb.width / 2 ? 'links' : 'rechts');
    }
    const mitte = rh.left + rh.width / 2 - rb.left;
    const ueberschrift = Math.abs(mitte - rb.width / 2) < rb.width * 0.08 ? 'mittig' : 'links';
    /* steht Inhalt NEBEN der Ueberschrift? */
    const neben = [...b.querySelectorAll('p, ul, ol, dl, table, img, figure')].some((x) => {
      if (h.contains(x)) return false;
      const rx = x.getBoundingClientRect();
      return rx.left > rh.right + 16 && rx.top < rh.bottom + 40 && rx.width > 0;
    });
    return [ueberschrift, neben ? 'nebeneinander' : 'untereinander', bildlage].join('/');
  };
  const folge = bloecke.map((b) => ({ s: signatur(b), b })).filter((x) => x.s);
  let lauf = 1;
  for (let i = 1; i < folge.length; i++) {
    if (folge[i].s === folge[i - 1].s) {
      lauf++;
      /* Gesperrt nur auf der Startseite. Auf einer Speisekarte oder einem Index
         wiederholen sich Gruppen zwangslaeufig gleich, dort ist es ein Hinweis. */
      if (!startseite && lauf !== 3) continue; /* je Folge nur einmal melden */
      befunde.push({ art: 'gleichfoermigkeit', hart: startseite && lauf >= 3, text: folge[i].s, ueberschrift: text(folge[i].b.querySelector('h2, h3')).slice(0, 70),
        merkmal: lauf + ' Sektionen in Folge mit derselben Anordnung', ort: pfad(folge[i].b) });
    } else lauf = 1;
  }
  return JSON.stringify({ befunde, sektionen: folge.map((x) => x.s) });
})()`;

const routenListe = await routen();
const binary = chromiumSuchen();
if (!binary) { console.error('Kein Browser verfuegbar. Ohne Browser ist diese Pruefung nicht belegt.'); process.exit(2); }

const port = 9300 + Math.floor(Math.random() * 400);
const libs = bibliothekspfad();
const umgebung = { ...process.env };
if (libs) umgebung.LD_LIBRARY_PATH = umgebung.LD_LIBRARY_PATH ? `${libs}:${umgebung.LD_LIBRARY_PATH}` : libs;
const prozess = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, 'about:blank'],
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
await senden('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

interface Befund { art: string; hart: boolean; text: string; ueberschrift?: string; merkmal?: string; ort: string; seite?: string }
const alle: Befund[] = [];
const bericht: Record<string, unknown> = {};
try {
  for (const pfad of routenListe) {
    await senden('Page.navigate', { url: basis + pfad }, sessionId);
    await warten(1200);
    await senden('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true }, sessionId);
    const r = await senden('Runtime.evaluate', { expression: MESSUNG, returnByValue: true }, sessionId);
    const roh = r?.result?.value;
    if (!roh) { console.error(`   FEHLER: keine Messung fuer ${pfad}`); process.exitCode = 1; continue; }
    const daten = JSON.parse(roh) as { befunde: Befund[]; sektionen: string[] };
    bericht[pfad] = daten;
    for (const b of daten.befunde) alle.push({ ...b, seite: pfad });
    const hart = daten.befunde.filter((b) => b.hart).length;
    console.log(`   ${pfad}: ${hart} Sperren, ${daten.befunde.length - hart} Befunde`);
  }
} finally {
  socket.close();
  try { process.kill(-prozess.pid!); } catch { prozess.kill(); }
}

mkdirSync(dirname(ausgabe), { recursive: true });
writeFileSync(ausgabe, JSON.stringify({ basis, geprueft: new Date().toISOString(), ergebnisse: bericht }, null, 2) + '\n', 'utf8');

const NAMEN: Record<string, string> = {
  dachzeile: 'Dachzeile ueber Ueberschrift',
  nummernmarke: 'Nummernmarke',
  teilauszeichnung: 'Teilauszeichnung in Ueberschrift',
  verlaufsschleier: 'Verlauf ueber Foto',
  gleichfoermigkeit: 'gleichfoermige Sektionsfolge',
};
for (const b of alle) {
  console.log(`   ${b.hart ? 'SPERRE' : 'Befund'} ${b.seite}  ${NAMEN[b.art] ?? b.art}${b.merkmal ? ` (${b.merkmal})` : ''}: "${b.text}"${b.ueberschrift && b.ueberschrift !== b.text ? `  vor/in "${b.ueberschrift}"` : ''}`);
}
const harte = alle.filter((b) => b.hart).length;
console.log(`   ${routenListe.length} Seiten geprueft, ${harte} harte Sperren, ${alle.length - harte} weitere Befunde. Bericht: ${ausgabe}`);
console.log('   Regeln: web-brain 20-design/anti-ai-slop.md#Harte Sperren');
process.exit(harte ? 1 : (process.exitCode ?? 0));
