/**
 * Laedt die Schriften eines Presets herunter und hostet sie im Projekt.
 *
 *   node --experimental-strip-types scripts/fetch-fonts.ts \
 *     --preset werkstatt --out starter/public/fonts [--css starter/src/styles/fonts.css]
 *
 * Warum selbst hosten: eine Einbindung von fonts.googleapis.com ist ein
 * Drittanbieter-Datenfluss und damit ein Consent- und Datenschutzfall fuer
 * eine Sache, die kein Consent braucht. Lokal ausgeliefert entfaellt der
 * Fall, und der Ladeweg wird kuerzer.
 *
 * Geladen werden nur die im Preset tatsaechlich verwendeten Gewichte und
 * nur der lateinische Zeichensatz. Die Lizenz gehoert danach in das
 * Asset Register des Projekts; alle Kit-Presets verwenden SIL OFL 1.1.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPreset, gewichteJeRolle, type TokenFile, type Preset } from './tokens-lib.ts';

const here = dirname(fileURLToPath(import.meta.url));
function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}

const presetName = arg('--preset');
const zielVerzeichnis = resolve(arg('--out', join(here, '../starter/public/fonts'))!);
const cssZiel = resolve(arg('--css', join(here, '../starter/src/styles/fonts.css'))!);

const basis: TokenFile = JSON.parse(readFileSync(join(here, '../tokens/tokens.json'), 'utf8'));
const preset: Preset | undefined = presetName
  ? JSON.parse(readFileSync(join(here, `../tokens/presets/${presetName}.json`), 'utf8'))
  : undefined;
const tokens = applyPreset(basis, preset);

/** Erste Familie eines Stacks; der Rest ist Fallback und wird nicht geladen. */
const familie = (stack: string) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '');

// Je Rolle nur die Schnitte, die ihre Stufen der Type Ramp wirklich
// anfordern. Alle Gewichte fuer alle Familien zu laden waere ein Vielfaches
// an Bytes fuer Schnitte, die keine Regel je benutzt.
const proRolle = gewichteJeRolle(tokens);
const gebraucht = new Map<string, Set<number>>();
for (const eintrag of tokens.font) {
  const name = familie(eintrag.value);
  if (/^(ui-monospace|monospace|sans-serif|serif|system-ui)$/.test(name)) continue;
  const menge = gebraucht.get(name) ?? new Set<number>();
  for (const g of proRolle[eintrag.name] ?? [400]) menge.add(g);
  gebraucht.set(name, menge);
}

mkdirSync(zielVerzeichnis, { recursive: true });
mkdirSync(dirname(cssZiel), { recursive: true });

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const bloecke: string[] = [];
let geladen = 0;

for (const [name, menge] of gebraucht) {
  const achse = [...menge].sort((a, b) => a - b);
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@${achse.join(';')}&display=swap`;
  let css: string;
  try {
    const antwort = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    css = await antwort.text();
  } catch (fehler) {
    console.error(`  ${name}: nicht ladbar (${(fehler as Error).message}). Fallback des Stacks greift.`);
    continue;
  }

  // Nur den lateinischen Block behalten; die uebrigen Zeichensaetze kosten
  // Bytes, die diese Websites nicht brauchen.
  const gesichter = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)]
    .filter((m) => m[1] === 'latin' || m[1] === 'latin-ext');

  for (const gesicht of gesichter) {
    const block = gesicht[2];
    const gewicht = /font-weight:\s*([^;]+);/.exec(block)?.[1].trim() ?? '400';
    const quelle = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
    if (!quelle) continue;
    const unicode = /unicode-range:\s*([^;]+);/.exec(block)?.[1].trim();

    const dateiname = `${name.toLowerCase().replace(/\s+/g, '-')}-${gewicht.replace(/\s+/g, '-')}-${gesicht[1]}.woff2`;
    const daten = Buffer.from(await (await fetch(quelle, { headers: { 'User-Agent': UA } })).arrayBuffer());
    writeFileSync(join(zielVerzeichnis, dateiname), daten);
    geladen++;

    bloecke.push(
      `@font-face {\n` +
      `  font-family: '${name}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${gewicht};\n` +
      `  font-display: swap;\n` +
      `  src: url('/fonts/${dateiname}') format('woff2');\n` +
      (unicode ? `  unicode-range: ${unicode};\n` : '') +
      `}`,
    );
    console.log(`  ${dateiname}  ${(daten.length / 1024).toFixed(1)} KB`);
  }
}

writeFileSync(cssZiel,
  `/* Selbst gehostete Schriften${presetName ? `, Preset ${presetName}` : ''}.\n` +
  `   Erzeugt von scripts/fetch-fonts.ts - nicht von Hand bearbeiten.\n` +
  `   Lizenz: SIL Open Font License 1.1. Gehoert in das Asset Register des Projekts. */\n\n` +
  bloecke.join('\n\n') + '\n', 'utf8');

console.log(`\n${geladen} Schriftschnitte nach ${zielVerzeichnis}, ${cssZiel} geschrieben.`);
if (!geladen) {
  console.error('Keine Schrift geladen. Ohne eigene Schrift greift der System-Stack -');
  console.error('und der ist genau die Anmutung, die vermieden werden soll.');
  process.exit(1);
}
