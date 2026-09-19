# web-kit

Material für Websites lokaler Betriebe: **womit** gebaut wird. Die
Entscheidungen, **wie** gebaut wird, stehen im Schwesterrepository
[web-brain](https://github.com/johstn8/web-brain).

Das Kit ist der Pflichtausgangspunkt der Fast Lane. Wer einen Block neu
schreibt, den es hier gibt, hat den falschen Weg genommen.

## Struktur

```
tokens/     tokens.json als Quelle, tokens.css generiert, Theme-Ableitung
blocks/     Kopfzeile, auftakt/ (vier Kompositionen), Leistungen,
            Öffnungszeiten, Anfahrt, Team, Kontaktformular, Bewertungen,
            Preise, FAQ, Fußzeile
legal/      Impressum, Datenschutz, consent/
content/    schema.json - Datenmodell für Betriebsdaten
scripts/    extract-old-site.ts, render-shots.ts, check-axe.ts,
            check-contrast.ts, link-check.ts, tokens-*.ts, qa.sh,
            deploy.sh, kontakt-endpoint.mjs, nginx-site.conf.template
starter/    lauffähiges Astro-Projekt, das alles einbindet
```

## Start

```bash
cd starter
npm install
npm run dev        # Entwicklung
npm run build      # statischer Build nach starter/dist
../scripts/qa.sh   # QA-Lauf gegen den Build
```

Node 22 oder neuer. Die Skripte sind TypeScript und laufen ohne Buildschritt
über `node --experimental-strip-types`.

## Tokens

`tokens/tokens.json` ist die einzige Quelle. Die Rollennamen sind fix und in
jedem Kundensystem identisch; deshalb laufen alle Blöcke ohne Änderung in
jedem Kundensystem. Nur die Werte wechseln pro Kunde.

```bash
node --experimental-strip-types scripts/tokens-to-css.ts        # tokens.css neu erzeugen
node --experimental-strip-types scripts/check-contrast.ts       # Kontrast in Licht und Dunkel
node --experimental-strip-types scripts/tokens-to-designsystem.ts \
  --project ../projekte/<kunde>/design-system/site/tokens.json \
  --out     ../projekte/<kunde>/design-system/site/design-system.json
```

Der Export bricht ab, sobald ein Wert benannte Farbe, `var()` oder
`color-mix()` enthält: solche Werte fallen beim Import in ein
Design-System-Artifact weg, und ein stiller Verlust ist schlimmer als ein
lauter Abbruch.

## QA

`scripts/qa.sh` prüft Platzhalter- und `TODO`-Reste, interne Links,
Screenshots bei 375 und 1280 Pixel, axe gegen WCAG 2.1 AA und Lighthouse.
Fehlt ein Werkzeug, wird die Prüfung als **übersprungen** gemeldet, nie als
bestanden; übersprungene Prüfungen gehören als offener Punkt in
`release-readiness/<website-slug>.md`.

## Ausliefern

```bash
scripts/deploy.sh --projekt ../projekte/<kunde> --ziel /srv/www/<slug>
scripts/deploy.sh --projekt ../projekte/<kunde> --ziel /srv/www/<slug> --preview
```

Der Build entsteht neben dem aktiven Stand und wird erst nach bestandenem
Smoke-Test per Symlink aktiviert; ein fehlgeschlagener Build verändert den
ausgelieferten Stand nicht. Die letzten fünf Releases bleiben liegen, damit
ein Rollback ein einziger `ln -sfn` ist.

`nginx-site.conf.template` ist die Serverkonfiguration mit öffentlicher
Route, Formular-Proxy und gesperrter Vorschau-Subdomain.
`kontakt-endpoint.mjs` nimmt das Formular entgegen: Origin-Prüfung,
Ratelimit, serverseitige Allowlist-Validierung, Honeypot, Versand über
`sendmail`. Domain, DNS, TLS und Zugangsdaten bleiben außerhalb des
Repositories.

## Wie das Kit wächst

Nicht aus einer Wunschliste, sondern aus echten Builds. Beim Kundenprojekt
wird jeder Block herausgezogen, der ein zweites Mal vorkommen wird - nicht
jeder, der vorkommen könnte.
