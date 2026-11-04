# web-kit

Material für Websites lokaler Betriebe: **womit** gebaut wird. Die
Entscheidungen, **wie** gebaut wird, stehen im Schwesterrepository
[web-brain](https://github.com/johstn8/web-brain).

Ausgangspunkt einer neuen Website ist eine ganze Vorlage aus `vorlagen/` oder
eine vom Nutzer genannte Seite. Blöcke und Presets sind Hilfen dazu.

## Struktur

```
tokens/     tokens.json als Quelle, tokens.css generiert, Theme-Ableitung
tokens/presets/  acht Art-Direction-Presets als Datei
vorlagen/   zehn vollständige Startseiten, je nach dem Aufbau einer Website
blocks/     Kopfzeile, Kopfinsel, auftakt/ (neun Kompositionen), Leistungen,
            Öffnungszeiten, Anfahrt, Team, Kontaktformular, Bewertungen,
            Preise, Karte, FAQ, Fußzeile, dazu Wortlicht, Kennzahlen,
            Bogenkarte, Querband, Kacheln, Freisteller, Farbfelder und das
            Glasmaterial; Herkunft und Voraussetzungen in blocks/README.md
legal/      Impressum, Datenschutz, consent/
content/    schema.json - Datenmodell für Betriebsdaten, mit Karten
            (Speisen, Getränke, Preislisten) und freien Texten
scripts/    extract-old-site.ts, render-shots.ts, check-axe.ts,
            check-slop.ts, check-contrast.ts, link-check.ts, tokens-*.ts, qa.sh,
            stilverlauf.ts, stil-messen.ts, routen.ts,
            deploy.sh, kontakt-endpoint.mjs, nginx-site.conf.template,
            fetch-fonts.ts
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

## Harte Sperren

`scripts/check-slop.ts` misst am gerenderten Dokument, was
`web-brain 20-design/anti-ai-slop.md#Harte Sperren` ausdrücklich sperrt:
Dachzeile über einer Überschrift, Nummernmarke, farbig oder kursiv
abgesetzte Teile einer Überschrift, ein Verlauf, der ein Foto in den
Seitengrund ausblendet, und auf der Startseite drei Sektionen in Folge mit
derselben Anordnung. `qa.sh` führt die Prüfung immer aus. Macht das Vorbild der
Website es selbst so, stuft `--erlaubt nummernmarke,teilauszeichnung` diese
Sperren zum Befund herab.

Geeicht an realen Seiten: minerestaurant.de, pageou.de, barraberlin.com,
lilianewyork.com und carbonenewyork.com bestehen, impastorosso.de fällt
mit zwei Dachzeilen durch.

**Die unveränderte Startseite des Starters besteht die Prüfung nicht.**
Sie stapelt vier gleich gebaute Sektionen und ist ein technisches Gerüst,
keine Vorlage für die Sektionsfolge. Im Projekt wird sie umgebaut.

## Art Direction

```bash
node --experimental-strip-types scripts/tokens-to-css.ts  --preset werkstatt --out tokens/tokens.css
node --experimental-strip-types scripts/fetch-fonts.ts    --preset werkstatt
```

Acht Richtungen, fünf davon gegenwärtig (`produkt`, `freundlich`, `klar`,
`atelier`, `werkstatt`) und drei klassisch mit Serife (`praxis`, `tisch`,
`kanzlei`). Ein Preset wechselt nur Farben und Schriften; den Aufbau bringt
eine Vorlage aus `vorlagen/`. Jede hat eigene Schrift, Palette, Radius-, Trenn- und
Aktionsgrammatik. Einzelheiten und Übersichtsbild in
[tokens/presets/README.md](tokens/presets/README.md).

Ein Preset ist der technische Startpunkt. Der Stil eines Auftrags entsteht
aus der Stilrecherche dieses Laufs und liegt als eigenes Preset im Projekt;
`--preset` nimmt dafür auch einen Pfad. `scripts/stil-messen.ts` misst an
einer Referenzseite Schriften, Type Ramp, Aktions- und Kachelradien, Grund
und Akzent, damit die Ableitung nicht geraten wird. `scripts/stilverlauf.ts`
zeigt, was die letzten Websites trugen, und meldet Wiederholungen.

Der Sinn: Wer eine Richtung wählt, startet nicht beim statistischen Mittel.
Genau dieses Mittel ist der Grund, warum generierte Websites einander
gleichen.

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
Screenshots, axe und harte Sperren laufen über alle Routen der Website:
Sitemap und HTML-Dateien im Build, nicht über eine feste Liste.
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
