/**
 * Zieht aus einer bestehenden Website die Inhalte, die ein Neubau braucht.
 *
 *   node --experimental-strip-types scripts/extract-old-site.ts \
 *     --url https://alte-seite.de --out ../projekte/<kunde>/extract [--tiefe 2]
 *
 * Ergebnis:
 *   extract/seiten/<slug>.md      Text je Seite, als Fliesstext lesbar
 *   extract/bilder.json           gefundene Bilder mit Quelle und Alt-Text
 *   extract/betriebsdaten.json    Vorbefuellung nach content/schema.json
 *   extract/quelleninventar.md    was gefunden wurde und was fehlt
 *
 * Das Ergebnis ist ein Rohbestand, keine fertige Wahrheit. Jede Angabe wird
 * gegen eine Primaerquelle geprueft, bevor sie in content/<website>.json
 * wandert. Kanonisch in web-brain 10-strategy/existing-website-rebuild.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

function arg(flag: string, standard?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? standard : process.argv[i + 1];
}

const start = arg('--url');
if (!start) {
  console.error('Aufruf: extract-old-site.ts --url <adresse> --out <verzeichnis> [--tiefe 2]');
  process.exit(2);
}
const ziel = resolve(arg('--out', 'extract')!);
const maxTiefe = Number(arg('--tiefe', '2'));
const startUrl = new URL(start);

mkdirSync(join(ziel, 'seiten'), { recursive: true });

interface Seite { url: string; titel: string; beschreibung: string; text: string; slug: string }
const seiten: Seite[] = [];
const bilder: { seite: string; src: string; alt: string }[] = [];
const gesehen = new Set<string>();

function text(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map((z) => z.trim()).join('\n')
    .trim();
}

function attribut(tag: string, name: string): string {
  return new RegExp(`${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? '';
}

async function holen(url: URL, tiefe: number): Promise<void> {
  const schluessel = url.origin + url.pathname;
  if (gesehen.has(schluessel) || tiefe > maxTiefe) return;
  gesehen.add(schluessel);

  let html: string;
  try {
    const antwort = await fetch(url, { headers: { 'User-Agent': 'web-kit extract-old-site' } });
    if (!antwort.ok || !(antwort.headers.get('content-type') ?? '').includes('text/html')) return;
    html = await antwort.text();
  } catch (fehler) {
    console.error(`nicht erreichbar: ${url.href} (${(fehler as Error).message})`);
    return;
  }

  const slug = url.pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'start';
  seiten.push({
    url: url.href,
    titel: /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '',
    beschreibung: attribut(/<meta[^>]+name=["']description["'][^>]*>/i.exec(html)?.[0] ?? '', 'content'),
    text: text(html),
    slug,
  });
  console.error(`gelesen: ${url.href}`);

  for (const treffer of html.matchAll(/<img[^>]+>/gi)) {
    const src = attribut(treffer[0], 'src');
    if (src) bilder.push({ seite: url.href, src: new URL(src, url).href, alt: attribut(treffer[0], 'alt') });
  }

  for (const treffer of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    try {
      const naechste = new URL(treffer[1], url);
      if (naechste.origin === startUrl.origin) await holen(naechste, tiefe + 1);
    } catch { /* unbrauchbare Adresse */ }
  }
}

await holen(startUrl, 0);

for (const seite of seiten) {
  writeFileSync(
    join(ziel, 'seiten', `${seite.slug}.md`),
    `<!-- Quelle: ${seite.url} -->\n\n# ${seite.titel}\n\n${seite.beschreibung ? `> ${seite.beschreibung}\n\n` : ''}${seite.text}\n`,
    'utf8',
  );
}
writeFileSync(join(ziel, 'bilder.json'), JSON.stringify(bilder, null, 2) + '\n', 'utf8');

// Vorbefuellung. Jede Angabe ist ein Fund, keine bestaetigte Wahrheit.
const alles = seiten.map((s) => s.text).join('\n');
const telefon = /(?:\+49|0)[\d\s/()-]{7,}\d/.exec(alles)?.[0]?.trim() ?? '';
const email = /[\w.+-]+@[\w-]+\.[\w.]{2,}/.exec(alles)?.[0] ?? '';
const plzOrt = /\b(\d{5})\s+([A-ZÄÖÜ][\wäöüß-]+(?:\s[A-ZÄÖÜ][\wäöüß-]+)?)/.exec(alles);
const strasse = /\b([A-ZÄÖÜ][\wäöüß.-]*(?:stra(?:ss|ß)e|str\.|weg|platz|allee|gasse|ring|damm)\s+\d+\w?)/i.exec(alles)?.[1] ?? '';

writeFileSync(join(ziel, 'betriebsdaten.json'), JSON.stringify({
  betrieb: { name: seiten[0]?.titel ?? '', kurzbeschreibung: seiten[0]?.beschreibung ?? '' },
  kontakt: {
    telefon, email,
    adresse: { strasse, plz: plzOrt?.[1] ?? '', ort: plzOrt?.[2] ?? '', land: 'DE' },
  },
  seiten: seiten.map((s) => ({ slug: s.slug === 'start' ? '' : s.slug, titel: s.titel, beschreibung: s.beschreibung, bloecke: [] })),
}, null, 2) + '\n', 'utf8');

const ohneAlt = bilder.filter((b) => !b.alt.trim()).length;
writeFileSync(join(ziel, 'quelleninventar.md'), `# Quelleninventar

Gezogen am ${new Date().toISOString().slice(0, 10)} von ${startUrl.origin}, Tiefe ${maxTiefe}.

| Sache | Stand |
|---|---|
| Seiten | ${seiten.length} |
| Bilder | ${bilder.length}, davon ${ohneAlt} ohne Alt-Text |
| Telefon | ${telefon || 'nicht gefunden'} |
| E-Mail | ${email || 'nicht gefunden'} |
| Anschrift | ${[strasse, plzOrt?.[1], plzOrt?.[2]].filter(Boolean).join(', ') || 'nicht gefunden'} |

## Vor der Uebernahme zu klaeren

- [ ] Jede gefundene Angabe gegen eine Primaerquelle pruefen. Ein Fund auf der
      alten Seite ist kein Beleg; veraltete Preise und Zeiten stehen dort am
      haeufigsten.
- [ ] Oeffnungszeiten, Preise und Leistungen mit dem Betrieb bestaetigen.
- [ ] Bildrechte und tatsaechlichen Einsatz im Asset Register erfassen.
- [ ] Verifizierte offizielle Profile und den Maps-Eintrag ergaenzen.
- [ ] Alte Adressen, die erhalten bleiben muessen, als Weiterleitung planen.

## Seiten

${seiten.map((s) => `- \`${s.slug}\` - ${s.titel || '(ohne Titel)'} - ${s.url}`).join('\n')}
`, 'utf8');

console.log(`${seiten.length} Seiten und ${bilder.length} Bilder nach ${ziel} geschrieben.`);
console.log('Das Ergebnis ist ein Rohbestand. Jede Angabe vor der Uebernahme gegen eine Primaerquelle pruefen.');
