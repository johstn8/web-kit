# legal/

Geruest fuer Rechtsseiten und Consent. **Alles hier sind pruefpflichtige
Entwuerfe, keine fertigen Rechtstexte.** Was veroeffentlicht wird,
entscheidet ausschliesslich der Nutzer beziehungsweise der benannte Owner,
nie die KI. Kanonisch in web-brain `50-legal/legal-decision-tree.md` und
`50-legal/privacy-and-consent.md`.

## Ablauf

1. `impressum.astro` und `datenschutz.astro` in das Projekt kopieren.
2. Alle `{{...}}`-Stellen aus `content/<website>.json` (Abschnitt `recht`)
   und den realen Datenfluessen fuellen.
3. Jeden tatsaechlich eingesetzten Drittanbieter im Datenschutztext
   auffuehren. Kein Anbieter im Text, der nicht eingebunden ist, und kein
   eingebundener Anbieter, der im Text fehlt.
4. Den Entwurf im Projekt als `pruefpflichtig` markieren und in
   `release-readiness/<website-slug>.md` als offene Sperre fuehren, bis der
   Owner ihn freigegeben hat.

## Consent

`consent/` enthaelt die Mechanik fuer Einbettungen, die erst nach
Zustimmung laden - Karten, Videos, Schriften von Drittanbietern. Ohne
Zustimmung wird der Platzhalter gezeigt, nicht das Embed.

Technisch notwendige Dinge brauchen keinen Consent und stehen deshalb
nicht in diesem Mechanismus. Wer alles durch das Consent-Banner schiebt,
macht es unbrauchbar.
