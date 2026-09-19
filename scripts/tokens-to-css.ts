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
import { validate, resolveAlias, type TokenFile, type ColorToken, type Theme } from './tokens-lib.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] ?? resolve(here, '../tokens/tokens.json'));
const out = resolve(process.argv[3] ?? resolve(here, '../tokens/tokens.css'));

const tokens: TokenFile = JSON.parse(readFileSync(src, 'utf8'));
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
console.log(`tokens.css geschrieben: ${out} (${tokens.color.length} Farbrollen, beide Themes)`);
