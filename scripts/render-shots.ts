/**
 * Ganzseitige Screenshots bei 375 und 1280 Pixel.
 *
 *   node --experimental-strip-types scripts/render-shots.ts \
 *     --base http://localhost:4321 --out qa-bericht/shots [--pfade /,/kontakt]
 *
 * Der Render ist zuerst Arbeitsmittel und erst danach Nachweis. Er ist
 * ganzseitig, nicht nur bis zur Falz: Ueberlauf, Kollision, abgeschnittene
 * Popover und Fehlerzustaende liegen unterhalb des sichtbaren Auftakts.
 * Kanonisch in web-brain 20-design/visual-iteration-loop.md.
 *
 * Verwendet Playwright, wenn es im Projekt liegt, sonst einen lokal
 * vorhandenen Chromium ueber das DevTools-Protokoll. Ist keines von beidem
 * da, endet das Skript mit Code 1 - ein fehlender Render ist ein Blocker,
 * kein stiller Uebersprung.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}

const basis = arg('--base', 'http://localhost:4321')!.replace(/\/$/, '');
const ziel = resolve(arg('--out', 'qa-bericht/shots')!);
const pfade = (arg('--pfade', '/,/leistungen,/kontakt')!).split(',').map((p) => p.trim()).filter(Boolean);
const BREITEN = [375, 1280] as const;

mkdirSync(ziel, { recursive: true });

function chromiumSuchen(): string | null {
  const kandidaten: string[] = [];
  const cache = join(homedir(), '.cache/ms-playwright');
  if (existsSync(cache)) {
    for (const eintrag of readdirSync(cache)) {
      // Der Ordnername wechselte mit den Playwright-Versionen von
      // chrome-linux zu chrome-linux64; beide Formen pruefen.
      if (eintrag.startsWith('chromium-')) {
        kandidaten.push(join(cache, eintrag, 'chrome-linux64/chrome'));
        kandidaten.push(join(cache, eintrag, 'chrome-linux/chrome'));
      }
      if (eintrag.startsWith('chromium_headless_shell-')) {
        kandidaten.push(join(cache, eintrag, 'chrome-linux64/headless_shell'));
        kandidaten.push(join(cache, eintrag, 'chrome-linux/headless_shell'));
      }
    }
  }
  kandidaten.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return kandidaten.reverse().find((k) => existsSync(k)) ?? null;
}

/** Weg 1: Playwright, wenn das Projekt es mitbringt. */
async function mitPlaywright(): Promise<boolean> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return false;
  }
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const breite of BREITEN) {
      const kontext = await browser.newContext({ viewport: { width: breite, height: 900 } });
      const seite = await kontext.newPage();
      for (const pfad of pfade) {
        await seite.goto(basis + pfad, { waitUntil: 'networkidle' });
        const name = (pfad === '/' ? 'start' : pfad.replace(/\//g, '-').replace(/^-/, '')) + `-${breite}.png`;
        await seite.screenshot({ path: join(ziel, name), fullPage: true });
        console.log(`ok ${name}`);
      }
      await kontext.close();
    }
  } finally {
    await browser.close();
  }
  return true;
}

/**
 * Chromium bringt seine Systembibliotheken nicht mit. Wo sie nicht global
 * installiert werden koennen, liegen sie entpackt im Benutzerverzeichnis;
 * dieser Pfad wird dann per LD_LIBRARY_PATH mitgegeben.
 */
function bibliothekspfad(): string | null {
  const kandidaten = [
    join(homedir(), '.local/lib/chromium-deps/usr/lib/x86_64-linux-gnu'),
    join(homedir(), '.local/lib/chromium-deps'),
  ];
  return kandidaten.find((k) => existsSync(k)) ?? null;
}

/** Weg 2: lokaler Chromium ueber das DevTools-Protokoll, ohne Paketinstallation. */
async function mitCdp(binary: string): Promise<boolean> {
  const port = 9333 + Math.floor(Math.random() * 400);
  const libs = bibliothekspfad();
  const umgebung = { ...process.env };
  if (libs) {
    umgebung.LD_LIBRARY_PATH = umgebung.LD_LIBRARY_PATH ? `${libs}:${umgebung.LD_LIBRARY_PATH}` : libs;
  }
  const prozess = spawn(binary, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
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
  if (!ws) { prozess.kill(); return false; }

  const socket = new WebSocket(ws);
  await new Promise((r, x) => { socket.onopen = r; socket.onerror = x; });

  let id = 0;
  const offen = new Map<number, (wert: any) => void>();
  socket.onmessage = (ereignis) => {
    const daten = JSON.parse(String(ereignis.data));
    if (daten.id && offen.has(daten.id)) { offen.get(daten.id)!(daten.result); offen.delete(daten.id); }
  };
  const senden = (methode: string, params: unknown = {}, sessionId?: string) =>
    new Promise<any>((aufloesen) => {
      const nummer = ++id;
      offen.set(nummer, aufloesen);
      socket.send(JSON.stringify({ id: nummer, method: methode, params, sessionId }));
    });

  const { targetId } = await senden('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await senden('Target.attachToTarget', { targetId, flatten: true });
  await senden('Page.enable', {}, sessionId);

  try {
    for (const breite of BREITEN) {
      for (const pfad of pfade) {
        await senden('Emulation.setDeviceMetricsOverride',
          { width: breite, height: 900, deviceScaleFactor: 1, mobile: breite < 768 }, sessionId);
        await senden('Page.navigate', { url: basis + pfad }, sessionId);
        await warten(900);
        const { cssContentSize } = await senden('Page.getLayoutMetrics', {}, sessionId);
        const { data } = await senden('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: breite, height: Math.ceil(cssContentSize.height), scale: 1 },
        }, sessionId);
        const name = (pfad === '/' ? 'start' : pfad.replace(/\//g, '-').replace(/^-/, '')) + `-${breite}.png`;
        writeFileSync(join(ziel, name), Buffer.from(data, 'base64'));
        console.log(`ok ${name} (${breite} x ${Math.ceil(cssContentSize.height)})`);
      }
    }
  } finally {
    socket.close();
    try { process.kill(-prozess.pid!); } catch { prozess.kill(); }
  }
  return true;
}

if (await mitPlaywright()) {
  console.log(`Screenshots in ${ziel}`);
} else {
  const binary = chromiumSuchen();
  if (binary && (await mitCdp(binary))) {
    console.log(`Screenshots in ${ziel} (ueber ${binary})`);
  } else {
    console.error('Kein Browser verfuegbar. Ohne echten Render ist Gate G1 nicht erfuellt;');
    console.error('das ist ein Blocker vor der Lieferung, kein Grund zum Ueberspringen.');
    console.error('Playwright als MCP-Server verbinden oder lokal installieren, siehe SETUP-OFFEN.md B3.');
    process.exit(1);
  }
}
