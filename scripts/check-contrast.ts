/**
 * Prueft den Tokenvertrag auf Kontrast in Licht und Dunkel.
 *
 *   node --experimental-strip-types scripts/check-contrast.ts [tokens.json]
 *
 * Gate G1 verlangt: jede Text-auf-Flaeche-Kombination des Tokenvertrags
 * erfuellt den Zielstandard in beiden Themes. Dieses Skript rechnet das
 * nach, damit die Zusage nicht erst am Render auffaellt.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kontrastPruefen, applyPreset, type TokenFile, type Preset } from './tokens-lib.ts';

const here = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--preset');
const presetName = i === -1 ? undefined : process.argv[i + 1];
const frei = process.argv.slice(2).filter((a, n, alle) => !a.startsWith('--') && !alle[n - 1]?.startsWith('--'));

const src = resolve(frei[0] ?? resolve(here, '../tokens/tokens.json'));
const basis: TokenFile = JSON.parse(readFileSync(src, 'utf8'));
const preset: Preset | undefined = presetName
  ? JSON.parse(readFileSync(resolve(here, `../tokens/presets/${presetName}.json`), 'utf8'))
  : undefined;
const tokens: TokenFile = applyPreset(basis, preset);

const befunde = kontrastPruefen(tokens);
const gefallen = befunde.filter((b) => !b.bestanden);
const ungeprueft = befunde.filter((b) => b.ist === null);

for (const theme of ['light', 'dark'] as const) {
  console.log(`\n${theme === 'light' ? 'Licht' : 'Dunkel'}`);
  for (const b of befunde.filter((x) => x.theme === theme)) {
    const wert = b.ist === null ? 'nicht berechenbar' : `${b.ist.toFixed(2)}:1`;
    const zeichen = b.ist === null ? '  ?' : b.bestanden ? ' ok' : 'FEHLER';
    console.log(`  ${zeichen}  ${b.vorne} auf ${b.hinten}: ${wert} (Ziel ${b.soll}:1)`);
  }
}

console.log(`\n${befunde.length} Paare geprueft, ${gefallen.length} unter dem Ziel, ${ungeprueft.length} nicht berechenbar.`);
if (ungeprueft.length) {
  console.log('Nicht berechenbare Paare verwenden rgb(), hsl() oder oklch() und werden am Render belegt.');
}
process.exit(gefallen.length ? 1 : 0);
