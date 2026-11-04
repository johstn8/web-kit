/**
 * Content-Loader nach der Build-Schnittstelle des Owner-Hostings.
 *
 *   wenn OWNER_HOSTING_CONTENT_FILE gesetzt:
 *     validierte Datei aus dem isolierten Build lesen
 *   sonst:
 *     die Projektdatei lesen
 *
 * Kanonisch in web-brain 60-operations/owner-hosting-interface.md.
 * Fehlt dieser Loader, schlaegt die Registrierung im Dashboard fehl.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import beispiel from './beispiel.json' with { type: 'json' };
import type { Karte } from '../../../blocks/_lib.ts';

export interface Inhalt {
  betrieb: { name: string; rechtsform?: string; inhaber?: string; kurzbeschreibung: string; gegruendet?: string };
  kontakt: {
    telefon: string; email: string;
    adresse: { strasse: string; plz: string; ort: string; land?: string };
    maps_url?: string;
  };
  oeffnungszeiten?: { tag: 'mo'|'di'|'mi'|'do'|'fr'|'sa'|'so'; von: string; bis: string; hinweis?: string }[];
  oeffnungszeiten_hinweis?: string;
  leistungen?: { titel: string; beschreibung: string; preis?: { betrag: number; waehrung?: string; ab?: boolean } }[];
  preise?: { position: string; preis: { betrag: number; waehrung?: string; ab?: boolean }; hinweis?: string }[];
  karten?: Karte[];
  /** Owner-bearbeitbare Fliesstexte je stabilem Schluessel; Komponenten tragen keinen eigenen Text. */
  texte?: Record<string, string | string[]>;
  team?: { name: string; rolle?: string; text?: string }[];
  bewertungen?: { text: string; autor?: string; quelle: string; url?: string; datum?: string }[];
  faq?: { frage: string; antwort: string }[];
  anfahrt?: { beschreibung?: string; oepnv?: string; parken?: string; karte_eingebettet?: boolean };
  seiten: { slug: string; titel: string; beschreibung?: string; indexieren?: boolean; bloecke: { typ: string; komposition?: string; karte?: string }[] }[];
  recht?: { umsatzsteuer_id?: string; aufsichtsbehoerde?: string; register?: string; verantwortlich_inhalt?: string; streitschlichtung?: boolean };
}

function laden(): Inhalt {
  const vomHosting = process.env.OWNER_HOSTING_CONTENT_FILE;
  if (vomHosting) {
    const pfad = vomHosting.startsWith('file:') ? fileURLToPath(vomHosting) : vomHosting;
    return JSON.parse(readFileSync(pfad, 'utf8')) as Inhalt;
  }
  return beispiel as unknown as Inhalt;
}

export const inhalt: Inhalt = laden();

/** Eine Karte nach ihrer stabilen id, etwa karte('speisen'). */
export const karte = (id: string) => inhalt.karten?.find((k) => k.id === id);

/** Ein Text aus inhalt.texte; fehlt der Schluessel, ist das ein Build-Fehler statt einer Leerstelle. */
export function text(schluessel: string): string | string[] {
  const wert = inhalt.texte?.[schluessel];
  if (wert === undefined) throw new Error(`Text '${schluessel}' fehlt in content.texte.`);
  return wert;
}
