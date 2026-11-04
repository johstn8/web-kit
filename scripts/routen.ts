/**
 * Die Routen, die ein Pruefskript abarbeitet. Gemeinsam fuer
 * render-shots.ts, check-axe.ts und check-slop.ts, damit alle drei
 * dieselben Seiten sehen.
 *
 * Quelle: --pfade, sonst /sitemap.xml des laufenden Servers vereinigt mit
 * den HTML-Dateien unter --dir, zuletzt nur die Startseite. Frueher stand hier
 * die feste Liste /,/leistungen,/kontakt des Starters; ein Projekt mit
 * anderen Routen bekam damit Fehlseiten statt seiner Unterseiten geprueft.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function htmlRouten(wurzel: string): string[] {
  const funde: string[] = [];
  const gehe = (ordner: string) => {
    for (const name of readdirSync(ordner)) {
      const voll = join(ordner, name);
      if (statSync(voll).isDirectory()) gehe(voll);
      else if (name.endsWith('.html') && name !== '404.html') {
        const pfad = '/' + relative(wurzel, voll).split(sep).join('/');
        funde.push(pfad.replace(/index\.html$/, '').replace(/\.html$/, ''));
      }
    }
  };
  gehe(wurzel);
  return funde.sort();
}

export async function routen(basis: string): Promise<string[]> {
  const gegeben = arg('--pfade');
  if (gegeben) return gegeben.split(',').map((p) => p.trim()).filter(Boolean);
  const menge = new Set<string>();
  try {
    const antwort = await fetch(`${basis}/sitemap.xml`);
    if (antwort.ok) {
      for (const m of (await antwort.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
        try { menge.add(new URL(m[1]).pathname); } catch { menge.add(m[1]); }
      }
    }
  } catch { /* keine Sitemap */ }
  // Seiten mit noindex, etwa Impressum und Datenschutz, stehen nicht in der
  // Sitemap und werden trotzdem geprueft.
  const dir = arg('--dir');
  if (dir) {
    try {
      for (const pfad of htmlRouten(dir)) {
        const mitSchraegstrich = pfad.endsWith('/') ? pfad : `${pfad}/`;
        if (!menge.has(pfad) && !menge.has(mitSchraegstrich)) menge.add(pfad);
      }
    } catch { /* kein Build */ }
  }
  return menge.size ? [...menge] : ['/'];
}
