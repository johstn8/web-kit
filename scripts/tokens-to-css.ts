/**
 * Erzeugt tokens/tokens.css aus tokens/tokens.json.
 *
 *   node --experimental-strip-types scripts/tokens-to-css.ts [tokens.json] [ziel.css]
 *
 * Die CSS-Datei ist generiert und wird nicht von Hand bearbeitet.
 * Quelle der Wahrheit ist immer die JSON-Datei.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, resolveAlias, applyPreset, type TokenFile, type ColorToken, type Theme, type Preset } from './tokens-lib.ts';

const here = dirname(fileURLToPath(import.meta.url));
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}
const frei = process.argv.slice(2).filter((a, i, alle) => !a.startsWith('--') && !alle[i - 1]?.startsWith('--'));

const src = resolve(frei[0] ?? resolve(here, '../tokens/tokens.json'));
const presetName = arg('--preset');
const out = resolve(arg('--out') ?? frei[1] ?? resolve(here, '../tokens/tokens.css'));

const basis: TokenFile = JSON.parse(readFileSync(src, 'utf8'));
const preset: Preset | undefined = presetName
  ? JSON.parse(readFileSync(resolve(here, `../tokens/presets/${presetName}.json`), 'utf8'))
  : undefined;
const tokens: TokenFile = applyPreset(basis, preset);
const problems = validate(tokens);
if (problems.length) {
  console.error('Tokenvertrag nicht erfuellt:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

const byName = new Map<string, ColorToken>(tokens.color.map((t) => [t.name, t]));
const colorBlock = (theme: Theme) =>
  tokens.color.map((t) => `  --color-${t.name}: ${resolveAlias(t.value[theme], byName, theme)};`).join('\n');

const scalars = (family: 'spacing' | 'radius' | 'layout' | 'motion') =>
  tokens[family].map((t) => `  --${t.name}: ${t.value};`).join('\n');

const fonts = tokens.font.map((t) => `  --font-${t.name}: ${t.value};`).join('\n');

/**
 * Die Grammatik des Presets wird zu Tokens, damit die Bloecke sie auswerten
 * koennen. Ohne diesen Schritt waere ein Preset nur ein Farb- und
 * Schriftwechsel; die Entscheidung "Rahmen oder Flaeche oder Weissraum"
 * ist aber der Teil, der zwei Websites wirklich verschieden macht.
 */
const g = preset?.grammar;
const grammatik = [
  `  --container-rahmen: ${
    g?.abgrenzung === 'rahmen' ? '1px solid var(--color-border)'
    : g?.abgrenzung === 'linie' ? '1px solid var(--color-border)'
    : g?.abgrenzung === 'weissraum' ? 'none'
    : '1px solid var(--color-border)'};`,
  `  --container-flaeche: ${
    g?.abgrenzung === 'flaeche' ? 'var(--color-surface)'
    : g?.abgrenzung === 'weissraum' ? 'transparent'
    : g?.abgrenzung === 'linie' ? 'transparent'
    : 'var(--color-surface)'};`,
  `  --container-tiefe: ${g?.tiefe === 'schatten' ? '0 1px 2px rgb(0 0 0 / 0.06)' : 'none'};`,
  `  --sektion-trennlinie: ${g?.sektionstrenner === 'linie' ? '1px solid var(--color-border)' : 'none'};`,
  `  --sektion-flaechenwechsel: ${g?.sektionstrenner === 'flaeche' || g?.sektionstrenner === 'bild' ? '1' : '0'};`,
  `  --beschriftung-versalien: ${g?.versalbeschriftung ? 'uppercase' : 'none'};`,
  `  --beschriftung-sperrung: ${g?.versalbeschriftung ? '0.06em' : '0'};`,
].join('\n');

const typography = tokens.typography
  .map((t) => [
    `  --text-${t.name}: ${t.value.size};`,
    `  --text-${t.name}--line-height: ${t.value['line-height']};`,
    `  --text-${t.name}--font-weight: ${t.value.weight};`,
    `  --text-${t.name}--letter-spacing: ${t.value.tracking};`,
  ].join('\n'))
  .join('\n');

const css = `/* Generiert aus tokens/tokens.json - nicht von Hand bearbeiten.
   Quelle: ${tokens.meta.name} ${tokens.meta.version}, Stand ${tokens.meta.updated}
   Neu erzeugen: node --experimental-strip-types scripts/tokens-to-css.ts */

:root {
  color-scheme: light dark;

${colorBlock('light')}

${fonts}

${grammatik}

${typography}

${scalars('spacing')}

${scalars('radius')}

${scalars('layout')}

${scalars('motion')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${colorBlock('dark').replace(/^/gm, '  ')}
  }
}

:root[data-theme='dark'] {
${colorBlock('dark')}
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 1ms;
    --duration-base: 1ms;
    --duration-slow: 1ms;
  }
}
`;

writeFileSync(out, css, 'utf8');
console.log(`tokens.css geschrieben: ${out} (${tokens.color.length} Farbrollen, beide Themes${presetName ? `, Preset ${presetName}` : ''})`);
