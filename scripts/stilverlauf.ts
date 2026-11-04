/**
 * Stilverlauf: welche Displayschrift, Aktionsform und welchen Grundton die
 * zuletzt gebauten Websites tragen, und ob ein neuer Entwurf sie wiederholt.
 *
 *   node --experimental-strip-types scripts/stilverlauf.ts \
 *     [--wurzel ../projekte] [--anzahl 6] [--kandidat <preset-name|pfad.json|tokens.css>]
 *
 * Warum: Jeder Lauf prueft nur sich selbst. Dass vier Websites hintereinander
 * mit Radius null, einer Antiqua und einem Papiergrund ausgeliefert wurden,
 * sieht kein einzelner Lauf. Regel in web-brain
 * 20-design/design-direction.md#Abstand zu den letzten Projekten.
 *
 * Gelesen wird das ausgelieferte CSS jeder Website (dist/, site/dist/,
 * versions/<fassung>/dist/ oder eine index.html direkt im Ordner), nicht der
 * Quelltext: was der Besucher bekommt, zaehlt. Die Werte sind Naeherungen
 * aus Regex, kein Render. Exit-Code 0 immer; Befunde sind Hinweise.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPreset, presetPfad, type TokenFile, type Preset } from './tokens-lib.ts';

const here = dirname(fileURLToPath(import.meta.url));
function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}

const wurzel = resolve(arg('--wurzel', join(here, '../../projekte'))!);
const anzahl = Number(arg('--anzahl', '6'));
const kandidat = arg('--kandidat');

interface Stil {
  name: string;
  geaendert: Date;
  display: string;
  serif: boolean;
  aktionsRadius: string;
  aktionsform: 'kante' | 'weich' | 'rund' | 'pille' | '?';
  grund: string;
  helligkeit: 'hell' | 'dunkel' | '?';
  /** Heller Grund mit deutlichem Gelb-Rot-Stich: Creme, Leinen, Papier. */
  papier: boolean;
}

const IGNORIERT = new Set(['node_modules', '.git', 'research', 'extract', 'qa-bericht', 'tests', '.next', '.venv']);

function dateien(ordner: string, endung: string, tiefe = 0): string[] {
  if (tiefe > 4) return [];
  const aus: string[] = [];
  for (const name of readdirSync(ordner)) {
    if (IGNORIERT.has(name) || name.startsWith('.')) continue;
    const voll = join(ordner, name);
    const info = statSync(voll);
    if (info.isDirectory()) aus.push(...dateien(voll, endung, tiefe + 1));
    else if (name.endsWith(endung)) aus.push(voll);
  }
  return aus;
}

/** Ordner mit der ausgelieferten Website, Logik wie staticSites.ts der /dev-Plattform. */
function builds(projekt: string): { name: string; ordner: string }[] {
  const index = (o: string) => [o, join(o, 'dist'), join(o, 'build')].find((k) => existsSync(join(k, 'index.html')));
  const versionen = join(projekt, 'versions');
  if (existsSync(versionen)) {
    return readdirSync(versionen).filter((v) => !v.startsWith('.'))
      .map((v) => ({ name: `${basename(projekt)}/${v}`, ordner: index(join(versionen, v)) }))
      .filter((b): b is { name: string; ordner: string } => !!b.ordner);
  }
  const ordner = index(join(projekt, 'site')) ?? index(projekt);
  return ordner ? [{ name: basename(projekt), ordner }] : [];
}

function luminanz(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return NaN;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function papier(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return luminanz(hex) > 0.75 && r - b >= 8 && r >= g;
}

function form(radius: string, schrift = 16): Stil['aktionsform'] {
  const r = radius.trim();
  if (!r) return '?';
  if (/9999|999px|50%|var\(--radius-full\)/.test(r)) return 'pille';
  const px = /([\d.]+)rem/.test(r) ? parseFloat(r) * schrift : /([\d.]+)px/.test(r) ? parseFloat(r) : r === '0' ? 0 : NaN;
  if (Number.isNaN(px)) return '?';
  if (px <= 2) return 'kante';
  if (px <= 8) return 'weich';
  if (px < 20) return 'rund';
  return 'pille';
}

/** Liest Stilmerkmale aus CSS-Text. */
function ausCss(css: string): Omit<Stil, 'name' | 'geaendert'> {
  const variablen = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!variablen.has(m[1])) variablen.set(m[1], m[2].trim());
  const aufloesen = (wert: string, tiefe = 0): string =>
    tiefe > 5 ? wert : wert.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, n, f) => aufloesen(variablen.get(n) ?? f ?? '', tiefe + 1));

  const h1 = /(?:^|[},\s])h1[^{,]*(?:,[^{]*)?\{[^}]*font-family:\s*([^;}]+)/m.exec(css)?.[1];
  const displayStack = aufloesen(variablen.get('--font-display') ?? h1 ?? variablen.get('--anzeige') ?? '');
  const display = displayStack.split(',')[0]?.replace(/['"]/g, '').trim() || '?';
  const serif = /(^|,)\s*serif\s*(,|$)/.test(displayStack) || /georgia|times|garamond|antiqua/i.test(displayStack);

  let radius = variablen.get('--aktion-radius') ?? '';
  if (!radius) {
    for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
      if (/(\.knopf|\.aktion|\.button|\.btn|\.cta|\bbutton\b|\.handlung a)/.test(m[1]) && /border-radius/.test(m[2])) {
        radius = /border-radius:\s*([^;}]+)/.exec(m[2])![1];
        break;
      }
    }
  }
  radius = aufloesen(radius);

  const bgRoh = variablen.get('--color-bg') ?? /body\s*\{[^}]*background(?:-color)?:\s*([^;}]+)/.exec(css)?.[1] ?? '';
  const grund = aufloesen(bgRoh).split(/\s/)[0] ?? '?';
  const l = luminanz(grund);
  return {
    display, serif, aktionsRadius: radius || '?', aktionsform: form(radius), grund: grund || '?',
    helligkeit: Number.isNaN(l) ? '?' : l > 0.4 ? 'hell' : 'dunkel', papier: papier(grund),
  };
}

function stilVon(name: string, ordner: string): Stil {
  const css = dateien(ordner, '.css').map((d) => readFileSync(d, 'utf8')).join('\n');
  const html = readFileSync(join(ordner, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  return { name, geaendert: statSync(join(ordner, 'index.html')).mtime, ...ausCss(`${css}\n${inline}`) };
}

function stilVonKandidat(k: string): Stil {
  if (k.endsWith('.css')) return { name: `Kandidat ${basename(k)}`, geaendert: new Date(), ...ausCss(readFileSync(k, 'utf8')) };
  const basis: TokenFile = JSON.parse(readFileSync(join(here, '../tokens/tokens.json'), 'utf8'));
  const preset: Preset = JSON.parse(readFileSync(presetPfad(k, here), 'utf8'));
  const t = applyPreset(basis, preset);
  const displayStack = t.font.find((f) => f.name === 'display')!.value;
  const radiusSm = t.radius.find((r) => r.name === 'radius-sm')!.value;
  const radiusMd = t.radius.find((r) => r.name === 'radius-md')!.value;
  const af = preset.grammar?.aktionsform ?? 'weich';
  const radius = af === 'kante' ? '0' : af === 'pille' ? '9999px' : af === 'rund' ? radiusMd : radiusSm;
  const bg = (t.color.find((c) => c.name === 'bg')!.value as { light: string }).light;
  const l = luminanz(bg);
  return {
    name: `Kandidat ${basename(k)}`, geaendert: new Date(),
    display: displayStack.split(',')[0].trim(),
    serif: /(^|,)\s*serif\s*(,|$)/.test(displayStack),
    aktionsRadius: radius, aktionsform: form(radius), grund: bg,
    helligkeit: Number.isNaN(l) ? '?' : l > 0.4 ? 'hell' : 'dunkel', papier: papier(bg),
  };
}

const alle: Stil[] = [];
for (const projekt of readdirSync(wurzel)) {
  const pfad = join(wurzel, projekt);
  if (projekt.startsWith('.') || !statSync(pfad).isDirectory()) continue;
  for (const b of builds(pfad)) {
    try { alle.push(stilVon(b.name, b.ordner)); } catch { /* unlesbar, uebergehen */ }
  }
}
alle.sort((a, b) => b.geaendert.getTime() - a.geaendert.getTime());
const letzte = alle.slice(0, anzahl);

console.log(`Stilverlauf der letzten ${letzte.length} Websites unter ${wurzel}\n`);
const zeile = (s: Stil) =>
  `  ${s.geaendert.toISOString().slice(0, 10)}  ${s.name.padEnd(34)} ${(s.display + (s.serif ? ' (Serife)' : '')).padEnd(30)} ${s.aktionsform.padEnd(6)} ${s.helligkeit.padEnd(6)} ${s.grund}${s.papier ? ' (Papier)' : ''}`;
console.log('  Datum       Website                            Displayschrift                 Aktion Grund');
for (const s of letzte) console.log(zeile(s));

const serifAnteil = letzte.filter((s) => s.serif).length;
const kantig = letzte.filter((s) => s.aktionsform === 'kante').length;
const papierAnteil = letzte.filter((s) => s.papier).length;
console.log(`\n  Serife als Displayschrift: ${serifAnteil} von ${letzte.length}; kantige Aktionen: ${kantig} von ${letzte.length}; Papiergrund: ${papierAnteil} von ${letzte.length}`);

if (kandidat) {
  const k = stilVonKandidat(kandidat);
  console.log(`\n${zeile(k)}\n`);
  const vorige = letzte.slice(0, 3);
  const befunde: string[] = [];
  if (vorige.some((s) => s.display.toLowerCase() === k.display.toLowerCase())) {
    befunde.push(`Displayschrift ${k.display} trug schon eine der letzten drei Websites.`);
  }
  if (k.serif && vorige.filter((s) => s.serif).length >= 2) {
    befunde.push('Serife als Displayschrift, und zwei der letzten drei trugen ebenfalls eine.');
  }
  if (vorige.length >= 2 && vorige.slice(0, 2).every((s) => s.aktionsform === k.aktionsform)) {
    befunde.push(`Aktionsform ${k.aktionsform} wie bei den letzten zwei Websites.`);
  }
  if (k.papier && vorige.filter((s) => s.papier).length >= 2) {
    befunde.push('Warmer Papiergrund, und zwei der letzten drei trugen ebenfalls einen.');
  }
  const gleich = vorige.filter((s) =>
    [s.display.toLowerCase() === k.display.toLowerCase(), s.aktionsform === k.aktionsform, s.helligkeit === k.helligkeit, s.serif === k.serif]
      .filter(Boolean).length >= 3);
  if (gleich.length) befunde.push(`In drei von vier Merkmalen gleich wie ${gleich.map((s) => s.name).join(', ')}.`);

  if (befunde.length) {
    console.log('  Befund: der Kandidat wiederholt die letzten Projekte.');
    for (const b of befunde) console.log(`   - ${b}`);
    console.log('  Ohne Begruendung aus Marke oder Auftrag eine andere Richtung waehlen.');
  } else {
    console.log('  Kein Befund: der Kandidat setzt sich von den letzten drei Websites ab.');
  }
}
