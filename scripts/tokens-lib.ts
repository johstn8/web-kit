/**
 * Gemeinsame Typen und Pruefungen fuer den Tokenvertrag.
 *
 * Die Rollennamen sind fix. Sie sind in jedem Kundensystem identisch,
 * deshalb laufen alle Kit-Bloecke ohne Aenderung in jedem Kundensystem.
 * Kanonisch in web-brain 20-design/color-system.md#Tokenvertrag.
 */

export type Theme = 'light' | 'dark';

export interface ColorToken {
  name: string;
  value: Record<Theme, string>;
  usage: string;
}

export interface ScalarToken {
  name: string;
  value: string;
  usage: string;
}

export interface TypographyToken {
  name: string;
  value: { size: string; 'line-height': string; weight: string; tracking: string };
  usage: string;
}

export interface TokenFile {
  meta: { name: string; description: string; version: string; updated: string };
  color: ColorToken[];
  typography: TypographyToken[];
  font: ScalarToken[];
  spacing: ScalarToken[];
  radius: ScalarToken[];
  layout: ScalarToken[];
  motion: ScalarToken[];
}

/** Pflichtrollen des Vertrags. Fehlt eine, ist Gate G1 nicht erfuellt. */
export const REQUIRED_COLOR_ROLES = [
  'bg', 'surface', 'surface-alt',
  'text', 'text-secondary', 'text-tertiary',
  'border', 'border-hover',
  'accent', 'accent-subtle', 'accent-contrast',
  'focus',
  'success', 'success-subtle',
  'warning', 'warning-subtle',
  'danger', 'danger-subtle',
] as const;

/**
 * Erlaubte Farbwerte fuer den Import in ein Design-System-Artifact:
 * Hex, rgb(), hsl(), oklch() oder ein Alias auf einen existierenden Token.
 * Benannte Farben, var() und color-mix() fallen beim Import weg.
 */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNC = /^(rgb|rgba|hsl|hsla|oklch)\(\s*[^)]*\)$/;
const ALIAS = /^\{([a-z0-9-]+)\}$/;

export interface ColorCheck {
  ok: boolean;
  reason?: string;
  aliasOf?: string;
}

export function checkColorValue(value: string, knownNames: ReadonlySet<string>): ColorCheck {
  const v = value.trim();
  if (v.includes('var(')) return { ok: false, reason: 'var() faellt beim Import weg' };
  if (v.includes('color-mix(')) return { ok: false, reason: 'color-mix() faellt beim Import weg' };
  const alias = ALIAS.exec(v);
  if (alias) {
    if (!knownNames.has(alias[1])) return { ok: false, reason: `Alias {${alias[1]}} zeigt auf keinen existierenden Token` };
    return { ok: true, aliasOf: alias[1] };
  }
  if (HEX.test(v)) return { ok: true };
  if (FUNC.test(v)) return { ok: true };
  return { ok: false, reason: `benannte Farbe oder unbekanntes Format: ${v}` };
}

/** Loest Aliase auf, damit der Export nur konkrete Werte enthaelt. */
export function resolveAlias(value: string, byName: Map<string, ColorToken>, theme: Theme, seen = new Set<string>()): string {
  const alias = ALIAS.exec(value.trim());
  if (!alias) return value.trim();
  const target = alias[1];
  if (seen.has(target)) throw new Error(`Alias-Zyklus ueber {${target}}`);
  seen.add(target);
  const token = byName.get(target);
  if (!token) throw new Error(`Alias {${target}} zeigt auf keinen existierenden Token`);
  return resolveAlias(token.value[theme], byName, theme, seen);
}

export function validate(tokens: TokenFile): string[] {
  const problems: string[] = [];
  const names = new Set(tokens.color.map((t) => t.name));

  for (const role of REQUIRED_COLOR_ROLES) {
    if (!names.has(role)) problems.push(`Pflichtrolle fehlt: ${role}`);
  }
  for (const token of tokens.color) {
    if (!token.usage?.trim()) problems.push(`${token.name}: Usage-Notiz fehlt`);
    for (const theme of ['light', 'dark'] as Theme[]) {
      const raw = token.value?.[theme];
      if (!raw) { problems.push(`${token.name}: Wert fuer ${theme} fehlt`); continue; }
      const check = checkColorValue(raw, names);
      if (!check.ok) problems.push(`${token.name} (${theme}): ${check.reason}`);
    }
  }
  for (const family of ['font', 'spacing', 'radius', 'layout', 'motion'] as const) {
    for (const token of tokens[family]) {
      if (!token.usage?.trim()) problems.push(`${family}/${token.name}: Usage-Notiz fehlt`);
      if (!token.value?.trim()) problems.push(`${family}/${token.name}: Wert fehlt`);
    }
  }
  for (const token of tokens.typography) {
    if (!token.usage?.trim()) problems.push(`typography/${token.name}: Usage-Notiz fehlt`);
    for (const key of ['size', 'line-height', 'weight', 'tracking'] as const) {
      if (!token.value?.[key]) problems.push(`typography/${token.name}: ${key} fehlt`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- Kontrast

/** Paare, die in jedem Theme den Zielstandard erfuellen muessen.
 *  [Vordergrund, Hintergrund, Mindestverhaeltnis]
 *  4.5 fuer Normaltext, 3 fuer grossen Text und UI-Komponenten.
 *  Kanonisch in web-brain 20-design/color-system.md#Kontrast und Bedeutung. */
export const KONTRASTPAARE: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-alt', 4.5],
  ['text-secondary', 'bg', 4.5],
  ['text-secondary', 'surface', 4.5],
  ['text-secondary', 'surface-alt', 4.5],
  ['text-tertiary', 'bg', 4.5],
  ['text-tertiary', 'surface', 4.5],
  ['text-tertiary', 'surface-alt', 4.5],
  ['accent-contrast', 'accent', 4.5],
  ['accent', 'bg', 3],
  ['accent', 'surface', 3],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
  ['success', 'success-subtle', 4.5],
  ['warning', 'warning-subtle', 4.5],
  ['danger', 'danger-subtle', 4.5],
];

/**
 * Rahmen sind keine Textfarben. `border` und `border-hover` tragen als
 * Hairline eine Trennung, keine Bedienbarkeit, und werden deshalb nicht
 * gegen 3:1 geprueft - das waere das falsche Kriterium und wuerde jedes
 * ruhige Hairline-System als Fehler melden.
 *
 * Geprueft wird stattdessen, ob der Wechsel vom Ruhezustand in den
 * Hoverzustand ueberhaupt wahrnehmbar ist. Ein toter Hoverzustand ist
 * genau der Befund, den der Tokenvertrag mit `border-hover` verhindern will.
 *
 * Wo ein Rahmen Bedienbarkeit anzeigt - der Rahmen eines Eingabefelds -
 * gilt WCAG 1.4.11 mit 3:1. Das ist eine Komponentenentscheidung und wird
 * im jeweiligen Block gesetzt, nicht im Vertrag, siehe blocks/Kontaktformular.astro.
 */
export const UNTERSCHEIDBARKEIT: [string, string, number][] = [
  ['border-hover', 'border', 1.2],
];

function kanalZuLinear(kanal: number): number {
  const c = kanal / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative Leuchtdichte nach WCAG. Nur fuer Hex-Werte; andere Formate
 *  werden uebersprungen statt falsch geraten. */
export function leuchtdichte(hex: string): number | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((z) => z + z).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => kanalZuLinear(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kontrast(vorne: string, hinten: string): number | null {
  const a = leuchtdichte(vorne);
  const b = leuchtdichte(hinten);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface Kontrastbefund {
  theme: Theme; vorne: string; hinten: string;
  ist: number | null; soll: number; bestanden: boolean;
}

export function kontrastPruefen(tokens: TokenFile): Kontrastbefund[] {
  const byName = new Map<string, ColorToken>(tokens.color.map((t) => [t.name, t]));
  const befunde: Kontrastbefund[] = [];
  for (const theme of ['light', 'dark'] as Theme[]) {
    for (const [vorne, hinten, soll] of [...KONTRASTPAARE, ...UNTERSCHEIDBARKEIT]) {
      const a = byName.get(vorne);
      const b = byName.get(hinten);
      if (!a || !b) continue;
      const ist = kontrast(
        resolveAlias(a.value[theme], byName, theme),
        resolveAlias(b.value[theme], byName, theme),
      );
      // Nicht-Hex-Werte lassen sich hier nicht rechnen; sie gelten als
      // ungeprueft und muessen am Render belegt werden.
      befunde.push({ theme, vorne, hinten, ist, soll, bestanden: ist === null ? true : ist >= soll });
    }
  }
  return befunde;
}

// ---------------------------------------------------------------- Presets

/**
 * Ein Preset ist eine vollstaendige Art Direction als Datei: Schriftrollen,
 * Palette, Radius-, Abstands- und Bewegungsgrammatik. Es ueberschreibt das
 * Basissystem je Rollenname; Rollen kommen nie hinzu oder weg.
 *
 * Der Sinn: eine Stilrichtung ist dann ein Artefakt und keine Prosa mehr.
 * Wer eine Richtung waehlt, startet nicht beim statistischen Mittel.
 */
export interface Grammar {
  /** Was traegt die Abgrenzung: Rahmen, Flaeche, Linie oder Weissraum. */
  abgrenzung: 'rahmen' | 'flaeche' | 'linie' | 'weissraum';
  tiefe: 'keine' | 'schatten' | 'ueberlagerung';
  /** Versalbeschriftungen sind ein Generator-Merkmal und deshalb je Preset zu entscheiden. */
  versalbeschriftung: boolean;
  sektionstrenner: 'linie' | 'flaeche' | 'weissraum' | 'bild';
  ziffernmarken: string;
}

export type Preset = Partial<TokenFile> & { grammar?: Grammar };

export function mergeTokens<T extends { name: string }>(basis: T[], ueber: T[] | undefined): T[] {
  if (!ueber) return basis;
  const byName = new Map(ueber.map((t) => [t.name, t]));
  const unbekannt = ueber.filter((t) => !basis.some((b) => b.name === t.name));
  if (unbekannt.length) {
    throw new Error(
      `Unbekannte Rollennamen: ${unbekannt.map((t) => t.name).join(', ')}. ` +
      'Die Rollennamen des Tokenvertrags sind fix; nur die Werte wechseln.',
    );
  }
  return basis.map((b) => byName.get(b.name) ?? b);
}

export function applyPreset(basis: TokenFile, preset?: Preset): TokenFile {
  if (!preset) return basis;
  return {
    meta:       { ...basis.meta, ...(preset.meta ?? {}) },
    color:      mergeTokens(basis.color,      preset.color),
    typography: mergeTokens(basis.typography, preset.typography),
    font:       mergeTokens(basis.font,       preset.font),
    spacing:    mergeTokens(basis.spacing,    preset.spacing),
    radius:     mergeTokens(basis.radius,     preset.radius),
    layout:     mergeTokens(basis.layout,     preset.layout),
    motion:     mergeTokens(basis.motion,     preset.motion),
  };
}

/**
 * Welche Stufe der Type Ramp welche Schriftrolle traegt.
 *
 * Eine Festlegung an einer Stelle, damit fetch-fonts.ts und tokens.css
 * nicht auseinanderlaufen: sonst laedt das eine Schnitte, die das andere
 * nie anfordert, oder umgekehrt.
 */
export const STUFE_ZU_SCHRIFT: Record<string, 'display' | 'body'> = {
  display: 'display', h1: 'display', h2: 'display',
  h3: 'body', lead: 'body', body: 'body', small: 'body', label: 'body',
};

/** Gewichte je Schriftrolle, aus der tatsaechlich gesetzten Type Ramp. */
export function gewichteJeRolle(tokens: TokenFile): Record<string, Set<number>> {
  const aus: Record<string, Set<number>> = { display: new Set(), body: new Set(), mono: new Set([400]) };
  for (const stufe of tokens.typography) {
    const rolle = STUFE_ZU_SCHRIFT[stufe.name] ?? 'body';
    aus[rolle].add(Number(stufe.value.weight));
  }
  return aus;
}
