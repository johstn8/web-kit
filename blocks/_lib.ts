/** Gemeinsame Typen und Helfer der Bloecke. Datenmodell: content/schema.json. */
export interface Bild { src: string; alt: string; ai_placeholder?: boolean }
export interface Preis { betrag: number; waehrung?: string; ab?: boolean }
export interface Aktion { label: string; ziel: string; art?: 'primaer' | 'sekundaer' }
export interface Zeit { tag: 'mo'|'di'|'mi'|'do'|'fr'|'sa'|'so'; von: string; bis: string; hinweis?: string }

export const TAGE: Record<Zeit['tag'], string> = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag',
  fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
};
export const TAG_FOLGE: Zeit['tag'][] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

const preisFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function preis(p: Preis): string {
  const betrag = p.waehrung && p.waehrung !== 'EUR'
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.waehrung }).format(p.betrag)
    : preisFormat.format(p.betrag);
  return p.ab ? `ab ${betrag}` : betrag;
}

/** Erzeugt den tel:-Verweis aus der Anzeigeform. Beide Pointer gehoeren zusammen. */
export function telHref(anzeige: string): string {
  const ziffern = anzeige.replace(/[^\d+]/g, '');
  return `tel:${ziffern.startsWith('+') ? ziffern : ziffern.replace(/^0/, '+49')}`;
}

/** Fasst gleiche aufeinanderfolgende Zeiten zu einer Zeile zusammen. */
export function zeitenGruppieren(zeiten: Zeit[]): { tage: string; zeit: string; hinweis?: string }[] {
  const nachTag = new Map(zeiten.map((z) => [z.tag, z]));
  const zeilen: { tage: string; zeit: string; hinweis?: string }[] = [];
  let lauf: { start: Zeit['tag']; ende: Zeit['tag']; zeit: string; hinweis?: string } | null = null;

  const schliessen = () => {
    if (!lauf) return;
    const tage = lauf.start === lauf.ende ? TAGE[lauf.start] : `${TAGE[lauf.start]} bis ${TAGE[lauf.ende]}`;
    zeilen.push({ tage, zeit: lauf.zeit, hinweis: lauf.hinweis });
    lauf = null;
  };

  for (const tag of TAG_FOLGE) {
    const z = nachTag.get(tag);
    const zeit = z ? `${z.von} bis ${z.bis} Uhr` : 'geschlossen';
    const hinweis = z?.hinweis;
    if (lauf && lauf.zeit === zeit && lauf.hinweis === hinweis) lauf.ende = tag;
    else { schliessen(); lauf = { start: tag, ende: tag, zeit, hinweis }; }
  }
  schliessen();
  return zeilen;
}
