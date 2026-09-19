/**
 * Erzeugt aus den projektspezifischen Werten einer Website die Datei,
 * die in ein Design-System-Artifact publiziert wird.
 *
 *   node --experimental-strip-types scripts/tokens-to-designsystem.ts \
 *     --project ../projekte/<kunde>/design-system/site/tokens.json \
 *     --out     ../projekte/<kunde>/design-system/site/design-system.json \
 *     --name    "<Betrieb>"
 *
 * Ohne --project wird das Basissystem aus tokens/tokens.json exportiert.
 *
 * Zielformat, verbindlich:
 * - Jede Tokenfamilie ist eine LISTE von Eintraegen, nie eine
 *   Name-zu-Wert-Zuordnung.
 * - Farbwerte als Hex, rgb(), hsl(), oklch() oder Alias auf einen
 *   existierenden Token. Aliase werden hier aufgeloest.
 * - Keine benannten Farben, kein var(), kein color-mix(). Solche Werte
 *   fallen beim Import weg, deshalb bricht der Export vorher ab.
 *
 * Die Rollennamen sind fix, die Werte kommen pro Kunde.
 * Kanonisch in web-brain 20-design/design-systems-und-artefakte.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validate, resolveAlias, checkColorValue,
  type TokenFile, type ColorToken, type Theme,
} from './tokens-lib.ts';

const here = dirname(fileURLToPath(import.meta.url));

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

const base: TokenFile = JSON.parse(readFileSync(resolve(here, '../tokens/tokens.json'), 'utf8'));
const projectPath = arg('--project');
const project: Partial<TokenFile> | undefined = projectPath
  ? JSON.parse(readFileSync(resolve(projectPath), 'utf8'))
  : undefined;

/** Projektwerte ueberschreiben Basiswerte je Rollenname. Rollen kommen nie hinzu oder weg. */
function merge<T extends { name: string }>(baseList: T[], overrides: T[] | undefined): T[] {
  if (!overrides) return baseList;
  const byName = new Map(overrides.map((t) => [t.name, t]));
  const unknown = overrides.filter((t) => !baseList.some((b) => b.name === t.name));
  if (unknown.length) {
    throw new Error(
      `Unbekannte Rollennamen im Projekt: ${unknown.map((t) => t.name).join(', ')}. ` +
      'Die Rollennamen des Tokenvertrags sind fix; nur die Werte kommen pro Kunde.',
    );
  }
  return baseList.map((b) => (byName.get(b.name) ?? b));
}

const merged: TokenFile = {
  meta: { ...base.meta, ...(project?.meta ?? {}) },
  color:      merge(base.color,      project?.color),
  typography: merge(base.typography, project?.typography),
  spacing:    merge(base.spacing,    project?.spacing),
  radius:     merge(base.radius,     project?.radius),
  layout:     merge(base.layout,     project?.layout),
  motion:     merge(base.motion,     project?.motion),
};

const problems = validate(merged);
if (problems.length) {
  console.error('Export abgebrochen, Tokenvertrag nicht erfuellt:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

const byName = new Map<string, ColorToken>(merged.color.map((t) => [t.name, t]));
const themes: Theme[] = ['light', 'dark'];

const colors = merged.color.map((t) => {
  const value: Record<string, string> = {};
  for (const theme of themes) {
    const resolved = resolveAlias(t.value[theme], byName, theme);
    const check = checkColorValue(resolved, new Set());
    if (!check.ok) throw new Error(`${t.name} (${theme}): ${check.reason}`);
    value[theme] = resolved;
  }
  return { name: t.name, value, usage: t.usage };
});

const output = {
  name: arg('--name') ?? merged.meta.name,
  description: merged.meta.description,
  version: merged.meta.version,
  generated: new Date().toISOString().slice(0, 10),
  source: projectPath ? resolve(projectPath) : 'web-kit/tokens/tokens.json',
  tokens: {
    color: colors,
    typography: merged.typography.map((t) => ({ name: t.name, value: { ...t.value }, usage: t.usage })),
    spacing: merged.spacing.map((t) => ({ name: t.name, value: t.value, usage: t.usage })),
    radius:  merged.radius.map((t)  => ({ name: t.name, value: t.value, usage: t.usage })),
    layout:  merged.layout.map((t)  => ({ name: t.name, value: t.value, usage: t.usage })),
    motion:  merged.motion.map((t)  => ({ name: t.name, value: t.value, usage: t.usage })),
  },
};

// Letzter Riegel vor dem Schreiben: verbotene Konstrukte im gesamten Output.
const serialized = JSON.stringify(output, null, 2);
for (const forbidden of ['var(', 'color-mix(']) {
  if (serialized.includes(forbidden)) {
    console.error(`Export abgebrochen: ${forbidden} im Ergebnis gefunden.`);
    process.exit(1);
  }
}

const outPath = resolve(arg('--out') ?? resolve(here, '../tokens/design-system.json'));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, serialized + '\n', 'utf8');

const counts = Object.entries(output.tokens).map(([k, v]) => `${k}: ${(v as unknown[]).length}`).join(', ');
console.log(`Design-System-Datei geschrieben: ${outPath}`);
console.log(`Familien als Liste - ${counts}`);
