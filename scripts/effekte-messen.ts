/**
 * Misst die Effekte einer Live-Website: Hover, Scrollanimationen, Animationen
 * und Uebergaenge samt Dauer und Kurve. Ergaenzt stil-messen.ts, das die
 * ruhende Seite misst. Ein Screenshot zeigt keine Bewegung; ohne diese Messung
 * werden Effekte geschaetzt statt nachgebaut.
 *
 *   node --experimental-strip-types scripts/effekte-messen.ts \
 *     --url https://www.example.com --out ../projekte/<kunde>/research/stil/example [--film] [--warten 2500]
 *
 * Ergebnis in <out>/effekte.json und als Zusammenfassung auf der Konsole:
 *   erklaert    @keyframes, :hover-Regeln, transition und animation aus allen
 *               Stylesheets, Scroll-Timelines, sanftes Scrollen
 *   bibliothek  gsap-Tweens und ScrollTrigger mit Start, Ende, scrub und pin,
 *               Lenis, Swiper, soweit auf der Seite vorhanden
 *   hover       echte Mausbewegung ueber jede Aktion und jede klickbare Flaeche;
 *               gemessen wird, was sich am Element und an seinen Kindern aendert,
 *               auch ueber die Einzel-Properties translate, scale und rotate, die
 *               Tailwind v4 statt transform setzt
 *   scroll      in kleinen Schritten durch die Seite; gemeldet werden Elemente,
 *               deren Lage, Transform (samt translate/scale/rotate), Deckkraft,
 *               Farbe oder Clip sich mit dem
 *               Scrollen aendern, mit Scrollbereich und Anfangs- und Endwert
 *   kopf        feste und klebende Elemente, die sich beim Scrollen verwandeln
 * --film legt zusaetzlich alle 250 Pixel ein kleines Bild ab (film-NN.jpg).
 *
 * Uebernommen werden Werte, nicht Quelltext; siehe web-brain
 * 90-references/inspiration-eingang.md#Verarbeiten. Startet genau einen Browser.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}
const url = arg('--url');
if (!url) { console.error('--url fehlt'); process.exit(2); }
const ziel = resolve(arg('--out', 'effekt-messung')!);
mkdirSync(ziel, { recursive: true });
const film = process.argv.includes('--film');
const ladezeit = Number(arg('--warten', '2500'));

// Das Ausblenden von Einwilligungsbannern steht einmal, in stil-messen.ts.
const hier = dirname(fileURLToPath(import.meta.url));
const quelle = readFileSync(join(hier, 'stil-messen.ts'), 'utf8');
const BANNER_WEG = quelle.slice(quelle.indexOf('const BANNER_WEG = String.raw`') + 30, quelle.indexOf('})()`;', quelle.indexOf('const BANNER_WEG')) + 4);

function chromiumSuchen(): string | null {
  const kandidaten: string[] = [];
  const cache = join(homedir(), '.cache/ms-playwright');
  if (existsSync(cache)) for (const e of readdirSync(cache)) if (e.startsWith('chromium-')) kandidaten.push(join(cache, e, 'chrome-linux64/chrome'), join(cache, e, 'chrome-linux/chrome'));
  kandidaten.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return kandidaten.reverse().find((k) => existsSync(k)) ?? null;
}
const libs = [join(homedir(), '.local/lib/chromium-deps/usr/lib/x86_64-linux-gnu'), join(homedir(), '.local/lib/chromium-deps')].find((k) => existsSync(k));

/** Im Dokument: gemeinsame Helfer, einmal eingesetzt. */
const HELFER = String.raw`(() => {
  window.__fx = {
    pfad(el) { const t = []; for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const k = [...e.classList].filter((c) => !/^(astro-|svelte-|css-|sc-|jsx-)/.test(c) && c.length < 30).slice(0, 2); if (k.length) s += '.' + k.join('.'); t.unshift(s); } return t.join(' > '); },
    werte(el) { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { transform: s.transform, translate: s.translate, scale: s.scale, rotate: s.rotate, opacity: s.opacity, bg: s.backgroundColor, bgimg: s.backgroundImage.slice(0, 80), color: s.color, shadow: s.boxShadow, border: s.borderTopColor + ' ' + s.borderTopWidth, filter: s.filter, clip: s.clipPath, radius: s.borderTopLeftRadius, deko: s.textDecorationLine, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; },
    diff(a, b) { const d = {}; for (const k in a) if (a[k] !== b[k]) d[k] = [a[k], b[k]]; return d; },
  };
  return 1;
})()`;

const ERKLAERT = String.raw`(() => {
  const keyframes = [], hover = [], uebergaenge = new Map(), animationen = new Map(); let timelines = 0, gesperrt = 0;
  const bewegung = /transform|translate|scale|rotate|opacity|filter|clip-path|box-shadow|background|color|border|width|height|letter-spacing|text-decoration/;
  const lauf = (regeln) => { for (const r of regeln) {
    if (r.type === 7 || r.constructor.name === 'CSSKeyframesRule') { keyframes.push({ name: r.name, text: r.cssText.replace(/\s+/g, ' ').slice(0, 500) }); continue; }
    if (r.cssRules && !r.selectorText) { lauf(r.cssRules); continue; }
    if (!r.selectorText || !r.style) continue;
    const t = r.style.cssText;
    if (/:hover/.test(r.selectorText)) { const decl = [...r.style].filter((p) => bewegung.test(p)).map((p) => p + ': ' + r.style.getPropertyValue(p)).join('; '); if (decl) hover.push({ sel: r.selectorText.slice(0, 120), decl: decl.slice(0, 240) }); }
    const tr = r.style.getPropertyValue('transition'); if (tr && !/^all 0s/.test(tr)) uebergaenge.set(tr, (uebergaenge.get(tr) || 0) + 1);
    const an = r.style.getPropertyValue('animation'); if (an && an !== 'none') animationen.set(an, (animationen.get(an) || 0) + 1);
    if (/animation-timeline|view-timeline|scroll-timeline/.test(t)) timelines++;
  } };
  for (const s of document.styleSheets) { try { lauf(s.cssRules); } catch (e) { gesperrt++; } }
  const sortiert = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  return JSON.stringify({ keyframes: keyframes.slice(0, 40), hover: hover.slice(0, 80), uebergaenge: sortiert(uebergaenge), animationen: sortiert(animationen), timelines, gesperrteStylesheets: gesperrt, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior });
})()`;

const BIBLIOTHEK = String.raw`(() => {
  const o = { gsap: null, scrollTrigger: [], lenis: !!(document.documentElement.className.match(/lenis/) || window.lenis || window.Lenis), swiper: !!window.Swiper, laufend: [] };
  const g = window.gsap;
  if (g && g.globalTimeline) {
    const kinder = g.globalTimeline.getChildren(true, true, false).slice(0, 80);
    o.gsap = { version: g.version, tweens: kinder.map((t) => { const v = t.vars || {}; const ziele = (t.targets ? t.targets() : []).slice(0, 2).map((x) => x && x.nodeType ? __fx.pfad(x) : String(x)); const eig = Object.keys(v).filter((k) => !/^(on|callback|scrollTrigger|ease|duration|delay|stagger|overwrite|immediateRender|lazy|id|paused|data)/.test(k)); return { ziele, dauer: t.duration(), ease: typeof v.ease === 'string' ? v.ease : (v.ease ? 'Funktion' : 'standard'), stagger: v.stagger ?? null, eigenschaften: eig.map((k) => k + ':' + (typeof v[k] === 'object' ? JSON.stringify(v[k]).slice(0, 60) : v[k])) }; }) };
  }
  const st = window.ScrollTrigger || (g && g.core && g.core.globals && g.core.globals().ScrollTrigger);
  if (st && st.getAll) o.scrollTrigger = st.getAll().slice(0, 60).map((t) => ({ ziel: t.trigger ? __fx.pfad(t.trigger) : '', start: t.start, ende: t.end, scrub: t.vars?.scrub ?? null, pin: !!t.vars?.pin, toggle: t.vars?.toggleActions ?? null, startText: String(t.vars?.start ?? ''), endeText: String(t.vars?.end ?? '') }));
  if (document.getAnimations) o.laufend = document.getAnimations().slice(0, 60).map((a) => { const e = a.effect, t = e && e.getComputedTiming ? e.getComputedTiming() : {}; return { art: a.constructor.name, name: a.animationName || a.transitionProperty || '', ziel: e && e.target ? __fx.pfad(e.target) : '', dauer: t.duration, kurve: e && e.getTiming ? e.getTiming().easing : '', wiederholung: t.iterations, timeline: a.timeline && a.timeline.constructor ? a.timeline.constructor.name : '' }; });
  return JSON.stringify(o);
})()`;

/** Kandidaten fuer Hover: Aktionen und klickbare Flaechen, je Bauart einmal. */
const KANDIDATEN = String.raw`(() => {
  const gesehen = new Set(), liste = [];
  const alle = [...document.querySelectorAll('a, button, [role=button], [onclick], summary, label, li, article, figure, [class*=card], [class*=Card], [class*=item], [class*=tile]')];
  for (const el of alle) {
    const r = el.getBoundingClientRect(); if (r.width < 24 || r.height < 16 || r.width > innerWidth * 0.98) continue;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') continue;
    const klick = el.matches('a, button, [role=button], summary') || s.cursor === 'pointer';
    if (!klick) continue;
    const art = el.tagName + '.' + [...el.classList].slice(0, 2).join('.') + '|' + Math.round(r.width / 40) + 'x' + Math.round(r.height / 40);
    if (gesehen.has(art)) continue; gesehen.add(art);
    el.setAttribute('data-fx-k', String(liste.length)); liste.push(art);
    if (liste.length >= 45) break;
  }
  return liste.length;
})()`;

const binary = chromiumSuchen();
if (!binary) { console.error('Kein Browser verfuegbar.'); process.exit(2); }
const port = 9900 + Math.floor(Math.random() * 90);
const umgebung = { ...process.env };
if (libs) umgebung.LD_LIBRARY_PATH = umgebung.LD_LIBRARY_PATH ? `${libs}:${umgebung.LD_LIBRARY_PATH}` : libs;
const prozess = spawn(binary, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore', detached: true, env: umgebung });
const warten = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ws = '';
for (let v = 0; v < 60 && !ws; v++) { await warten(250); try { ws = ((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl; } catch { /* noch nicht bereit */ } }
if (!ws) { prozess.kill(); console.error('Browser nicht erreichbar.'); process.exit(2); }
const socket = new WebSocket(ws);
await new Promise((r, x) => { socket.onopen = r; socket.onerror = x; });
let id = 0;
const offen = new Map<number, (wert: any) => void>();
socket.onmessage = (e) => { const d = JSON.parse(String(e.data)); if (d.id && offen.has(d.id)) { offen.get(d.id)!(d.result ?? d.error); offen.delete(d.id); } };
const senden = (m: string, p: unknown = {}, s?: string) => new Promise<any>((auf) => { const n = ++id; offen.set(n, auf); socket.send(JSON.stringify({ id: n, method: m, params: p, sessionId: s })); });
const { targetId } = await senden('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await senden('Target.attachToTarget', { targetId, flatten: true });
await senden('Page.enable', {}, sessionId);
await senden('Runtime.enable', {}, sessionId);
const auswerten = async (a: string, limit = 30000) => (await Promise.race([senden('Runtime.evaluate', { expression: a, returnByValue: true, awaitPromise: true }, sessionId), warten(limit).then(() => null)]))?.result?.value;
const maus = (x: number, y: number) => senden('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId);

const B = 1440, H = 900;
const ergebnis: any = { url, gemessen: new Date().toISOString(), breite: B };
try {
  await senden('Emulation.setDeviceMetricsOverride', { width: B, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
  await senden('Page.navigate', { url }, sessionId);
  await warten(ladezeit);
  await auswerten('document.fonts.ready.then(() => 1)');
  await auswerten(BANNER_WEG);
  await warten(1200);
  await auswerten(HELFER);
  ergebnis.erklaert = JSON.parse(await auswerten(ERKLAERT) ?? '{}');
  ergebnis.bibliothek = JSON.parse(await auswerten(BIBLIOTHEK) ?? '{}');

  // Scroll: in Schritten von 150 Pixeln, je Schritt die Werte aller Elemente
  // im und knapp ausserhalb des Sichtfelds. Gemeldet wird, was sich aendert,
  // ohne dass es nur mitscrollt.
  await auswerten(String.raw`(() => { window.__fxs = new Map(); window.__fxk = new Map(); window.__fxe = []; return 1; })()`);
  const gesamt = Math.min(Number(await auswerten('document.documentElement.scrollHeight')), 30000);
  let bildNr = 0;
  for (let y = 0; y <= gesamt - H + 150; y += 150) {
    await auswerten(`(async () => { for (let i = 0; i < 6; i++) { scrollBy(0, ${y} > scrollY ? 25 : 0); await new Promise(r => setTimeout(r, 16)); } scrollTo(0, ${y}); await new Promise(r => setTimeout(r, 140)); })()`);
    await auswerten(String.raw`(() => {
      const y = scrollY, alle = document.querySelectorAll('body *'); let n = 0;
      for (const el of alle) {
        if (n > 2500) break; const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom < -innerHeight * 0.2 || r.top > innerHeight * 1.2) continue; n++;
        const s = getComputedStyle(el), fest = s.position === 'fixed' || s.position === 'sticky';
        const sig = [s.transform, s.translate, s.scale, s.rotate, s.opacity, s.clipPath, s.filter, s.color, s.backgroundColor, fest ? '' : Math.round(r.top + y), Math.round(r.width), Math.round(r.height), fest ? Math.round(r.top) : '', s.borderTopLeftRadius].join('|');
        let e = __fxs.get(el); if (!e) { e = { pfad: __fx.pfad(el), fest, folge: [] }; __fxs.set(el, e); }
        const letzt = e.folge[e.folge.length - 1]; if (!letzt || letzt.sig !== sig) e.folge.push({ y, sig, w: { transform: s.transform, translate: s.translate, scale: s.scale, rotate: s.rotate, opacity: s.opacity, clip: s.clipPath, filter: s.filter, color: s.color, bg: s.backgroundColor, top: Math.round(r.top + (fest ? 0 : y)), w: Math.round(r.width), h: Math.round(r.height), radius: s.borderTopLeftRadius } });
      }
      return n;
    })()`);
    if (film && y % 250 < 150 && bildNr < 80) {
      const b = await senden('Page.captureScreenshot', { format: 'jpeg', quality: 55, clip: { x: 0, y: 0, width: B, height: H, scale: 0.5 } }, sessionId);
      if (b?.data) writeFileSync(join(ziel, `film-${String(++bildNr).padStart(2, '0')}.jpg`), Buffer.from(b.data, 'base64'));
    }
  }
  ergebnis.scroll = JSON.parse(await auswerten(String.raw`(() => {
    const raus = [];
    for (const [el, e] of __fxs) {
      if (e.folge.length < 2) continue;
      const a = e.folge[0].w, z = e.folge[e.folge.length - 1].w, d = {};
      for (const k in a) if (a[k] !== z[k]) d[k] = [a[k], z[k]];
      if (!Object.keys(d).length) continue;
      if (!e.fest && Object.keys(d).length === 1 && d.top && Math.abs(d.top[0] - d.top[1]) < 3) continue;
      raus.push({ pfad: e.pfad, fest: e.fest, von: e.folge[0].y, bis: e.folge[e.folge.length - 1].y, schritte: e.folge.length, aenderung: d });
    }
    const gewicht = (x) => (x.fest ? 1000 : 0) + x.schritte;
    return JSON.stringify(raus.sort((a, b) => gewicht(b) - gewicht(a)).slice(0, 60));
  })()`, 60000) ?? '[]');
  ergebnis.laufendNachScroll = JSON.parse(await auswerten(BIBLIOTHEK) ?? '{}').laufend;

  // Hover: echte Mausbewegung, damit auch Effekte per Skript ausloesen.
  await auswerten('scrollTo(0, 0)'); await warten(600);
  const anzahl = Number(await auswerten(KANDIDATEN));
  ergebnis.hover = [];
  for (let k = 0; k < anzahl; k++) {
    const lage = JSON.parse(await auswerten(String.raw`(() => { const el = document.querySelector('[data-fx-k="${k}"]'); if (!el) return 'null'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); window.__fxv = [el, ...el.querySelectorAll('*')].slice(0, 14).map((x) => ({ x, w: __fx.werte(x) })); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, pfad: __fx.pfad(el), text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), uebergang: getComputedStyle(el).transition.slice(0, 160) }); })()`) ?? 'null');
    if (!lage) continue;
    await maus(2, 2); await warten(150);
    await auswerten(String.raw`(() => { window.__fxv = window.__fxv.map((v) => ({ x: v.x, w: __fx.werte(v.x) })); return 1; })()`);
    await maus(lage.x, lage.y); await warten(900);
    const diff = JSON.parse(await auswerten(String.raw`(() => JSON.stringify(__fxv.map((v, i) => { const d = __fx.diff(v.w, __fx.werte(v.x)); delete d.x; delete d.y; return Object.keys(d).length ? { teil: i ? __fx.pfad(v.x).split(' > ').pop() : 'selbst', d, uebergang: getComputedStyle(v.x).transition.slice(0, 120) } : null; }).filter(Boolean)))()`) ?? '[]');
    if (diff.length) ergebnis.hover.push({ ...lage, aenderungen: diff.slice(0, 6) });
    await maus(2, 2); await warten(250);
  }
  writeFileSync(join(ziel, 'effekte.json'), JSON.stringify(ergebnis, null, 2));

  const e = ergebnis.erklaert, b = ergebnis.bibliothek;
  console.log(`${url}\n`);
  console.log(`   Erklaert    ${e.keyframes?.length ?? 0} @keyframes, ${e.hover?.length ?? 0} :hover-Regeln, ${e.timelines ?? 0} Scroll-Timelines, scroll-behavior ${e.scrollBehavior}${e.gesperrteStylesheets ? `, ${e.gesperrteStylesheets} Stylesheets nicht lesbar` : ''}`);
  for (const [t, n] of (e.uebergaenge ?? []).slice(0, 6)) console.log(`               transition ${n}x  ${t.slice(0, 110)}`);
  for (const k of (e.keyframes ?? []).slice(0, 6)) console.log(`               @keyframes ${k.text.slice(0, 120)}`);
  console.log(`   Bibliothek  gsap ${b.gsap ? `${b.gsap.version}, ${b.gsap.tweens.length} Tweens` : 'nein'}, ScrollTrigger ${b.scrollTrigger?.length ?? 0}, Lenis ${b.lenis ? 'ja' : 'nein'}, Swiper ${b.swiper ? 'ja' : 'nein'}`);
  for (const t of (b.gsap?.tweens ?? []).slice(0, 8)) console.log(`               tween ${t.dauer}s ${t.ease} ${t.eigenschaften.join(' ').slice(0, 80)}  ${t.ziele[0] ?? ''}`.slice(0, 190));
  for (const t of (b.scrollTrigger ?? []).slice(0, 8)) console.log(`               trigger ${t.startText || t.start} bis ${t.endeText || t.ende} scrub ${t.scrub} pin ${t.pin}  ${t.ziel}`.slice(0, 190));
  console.log(`   Scroll      ${ergebnis.scroll.length} Elemente aendern sich mit dem Scrollen`);
  for (const s of ergebnis.scroll.slice(0, 12)) console.log(`               ${s.fest ? 'fest ' : ''}${s.von}-${s.bis}px ${Object.entries(s.aenderung).map(([k, v]: [string, any]) => `${k} ${String(v[0]).slice(0, 34)} -> ${String(v[1]).slice(0, 34)}`).join('; ').slice(0, 150)}  ${s.pfad.slice(-60)}`);
  console.log(`   Hover       ${ergebnis.hover.length} Elemente reagieren`);
  for (const h of ergebnis.hover.slice(0, 14)) console.log(`               "${h.text}" ${h.aenderungen.map((a: any) => `${a.teil}: ${Object.entries(a.d).filter(([k]) => k !== 'w' && k !== 'h').map(([k, v]: [string, any]) => `${k} ${String(v[0]).slice(0, 28)} -> ${String(v[1]).slice(0, 28)}`).join(', ')} [${a.uebergang.slice(0, 50)}]`).join(' | ').slice(0, 220)}`);
  console.log(`\n   Messung in ${join(ziel, 'effekte.json')}${film ? ', Film in film-*.jpg' : ''}`);
} finally {
  socket.close();
  try { process.kill(-prozess.pid!); } catch { prozess.kill(); }
}
