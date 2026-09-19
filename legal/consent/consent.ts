/**
 * Consent-Mechanik fuer Einbettungen, die erst nach Zustimmung laden.
 *
 * Grundsatz: Ohne Zustimmung wird der Platzhalter gezeigt, nicht das Embed.
 * Technisch notwendige Dinge laufen nicht ueber diesen Mechanismus - wer
 * alles durch das Banner schiebt, macht es unbrauchbar.
 *
 * Der Zustand liegt in localStorage und damit nur im Browser der Besucherin.
 * Er wird nie an den Server gesendet; der Build bleibt statisch.
 */

export type Kategorie = 'karte' | 'video' | 'schrift';

const SCHLUESSEL = 'consent';

export interface ConsentStand {
  /** ISO-Datum der Entscheidung, damit eine spaetere Aenderung nachvollziehbar bleibt. */
  stand: string;
  erteilt: Kategorie[];
}

function lesen(): ConsentStand {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return { stand: '', erteilt: [] };
    const daten = JSON.parse(roh) as ConsentStand;
    return { stand: daten.stand ?? '', erteilt: Array.isArray(daten.erteilt) ? daten.erteilt : [] };
  } catch {
    // Privates Fenster, gesperrte Site-Daten: gilt als "nicht zugestimmt".
    return { stand: '', erteilt: [] };
  }
}

function schreiben(stand: ConsentStand): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(stand));
  } catch {
    // Nicht speicherbar: die Zustimmung gilt dann nur fuer diese Seitenansicht.
  }
}

export function hatZugestimmt(kategorie: Kategorie): boolean {
  return lesen().erteilt.includes(kategorie);
}

export function zustimmen(kategorie: Kategorie): void {
  const stand = lesen();
  if (!stand.erteilt.includes(kategorie)) stand.erteilt.push(kategorie);
  stand.stand = new Date().toISOString();
  schreiben(stand);
  aktivieren(kategorie);
}

export function widerrufen(kategorie: Kategorie): void {
  const stand = lesen();
  stand.erteilt = stand.erteilt.filter((k) => k !== kategorie);
  stand.stand = new Date().toISOString();
  schreiben(stand);
  // Ein Widerruf entfernt das bereits geladene Embed erst beim naechsten Aufruf.
  // Das ist ehrlicher als so zu tun, als waere die Verbindung rueckgaengig zu machen.
  location.reload();
}

/**
 * Ersetzt den Platzhalter durch das echte Embed.
 * Das Markup des Embeds steht als <template data-consent-embed="<kategorie>">
 * im HTML und wird erst hier in das Dokument gehoben.
 */
function aktivieren(kategorie: Kategorie): void {
  const traeger = document.querySelectorAll<HTMLElement>(`[data-consent="${kategorie}"]`);
  for (const el of traeger) {
    const vorlage = el.querySelector<HTMLTemplateElement>(`template[data-consent-embed="${kategorie}"]`);
    if (!vorlage) continue;
    el.replaceChildren(vorlage.content.cloneNode(true));
  }
}

/** Einmal beim Laden aufrufen. Bindet die Zustimmungsknoepfe und aktiviert Erteiltes. */
export function consentStarten(): void {
  for (const kategorie of ['karte', 'video', 'schrift'] as Kategorie[]) {
    if (hatZugestimmt(kategorie)) aktivieren(kategorie);
  }
  document.addEventListener('click', (ereignis) => {
    const ziel = (ereignis.target as HTMLElement | null)?.closest<HTMLElement>('[data-consent-accept]');
    if (!ziel) return;
    ereignis.preventDefault();
    zustimmen(ziel.dataset.consentAccept as Kategorie);
  });
}
