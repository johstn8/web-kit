# Blöcke

Blöcke sind Einzelteile. Eine neue Website startet mit einer ganzen Vorlage aus
`vorlagen/`; Blöcke helfen, wo sie passen, und werden nicht vorgeschrieben.

Alle Blöcke nutzen nur die Rollen des Tokenvertrags und laufen deshalb in
jedem Preset. Text und Bilder kommen als Props, nie aus dem Block selbst.

Die Gestaltungsidee stammt bei den Blöcken unten aus Websites, die der Nutzer
am 2026-11-04 eingereicht hat. Der Code ist eigener Code: Übernommen wurden
Aufbau und gemessene Werte, nicht Quelltext, Texte oder Bilder.

## Auftakte

| Block | Für | Herkunft | Braucht |
|---|---|---|---|
| `auftakt/Leitbild` | Gastronomie, gesetzt | MINE, Carbone | ein starkes Raumfoto oder Video |
| `auftakt/Vollbild` | Dienstleister, Veranstaltung; mit `hoehe="seite"` auch Kopf jeder Unterseite | comito.de, ko-mon.de | gutes Foto oder Video |
| `auftakt/Schlicht` | Dienstleister mit gutem Ruf und wenig Fotos | jovoco.io | echte Bewertung, optional Kundenlogos mit Erlaubnis |
| `auftakt/Riesenwort` | Marken mit kurzem Namen, Gastronomie, Produkte | standard-berlin.de, lightshiprv.com | ein kurzes Wort, höchstens etwa 14 Zeichen |
| `auftakt/Glasbuehne` | Finanzen, Software, hochwertige Dienstleistung | mercury.com | Bild mit ruhiger Mitte; bei einem Feld ein echtes Formularziel |

## Kopfzeilen

| Block | Wirkung | Herkunft |
|---|---|---|
| `Header` | klassische volle Leiste | Kit |
| `Kopfinsel` | schwebt, weit über dem Auftakt, zieht sich beim Scrollen zur Glasinsel zusammen; Logo links oder mittig, Sprachwahl | lightshiprv.com, jovoco.io, meracinque.com, ko-mon.de |

## Abschnitte

| Block | Wirkung | Herkunft | Braucht |
|---|---|---|---|
| `Wortlicht` | großer Satz färbt sich beim Scrollen Wort für Wort ein, einmal je Seite | ko-mon.de | einen Satz, der es wert ist |
| `Kennzahlen` | Boxen, versetzt und beim Scrollen gegeneinander verschoben, oder ruhige Zeile; eine Box darf ein Bild sein | metagram-solutions.com, jovoco.io, ko-mon.de | belegte Zahlen |
| `Bogenkarte` | schräg liegende Punktkarte, Bögen zeichnen sich beim Scrollen vom Mittelpunkt zu den Orten | metagram-solutions.com | mehrere echte Standorte oder Einsatzorte |
| `Querband` | große Karten zum Wischen, Plus klappt Text auf | lightshiprv.com | starke Bilder |
| `Kacheln` | Kachelraster mit großer Bildfläche, hell und dunkel im Wechsel, Kennwerte als Glasetiketten | mercury.com, rico-gmbh.de | Motive; belegte Kennwerte |
| `Freisteller` | freigestellte Objekte oder Rechteckbilder am Rand direkt auf hellem Grund | lagalante-restaurant.de, standard-berlin.de | sehr gute Bilder |
| `Farbfelder` | bildschirmhohe Farbfelder fahren übereinander, riesiges Wort, kurzer Text | the1.amsterdam, meracinque.com | Preset mit `grammar.farbfelder` |

## Elemente aus dem Eingang vom 2026-11-07

Hier hat der Nutzer an einer Seite nur einzelne Teile gelobt. Deshalb gibt es dafür
keine Vorlage, sondern genau diese Teile als Block, damit sie sich in eine neue
Website einsetzen lassen. Alle auf einer Seite: `scripts/muster-bauen.sh <preset>`,
dann `/elemente/`.

| Block | Wirkung | Herkunft, was gelobt wurde |
|---|---|---|
| `auftakt/Pfadflug` | Gegenstand fliegt auf gestrichelter Bahn durch nummerierte Schritte | sales-culture.de: der bewegte Flieger im Auftakt |
| `BildText` | Text neben Bild, auf dem Handy Bild nach dem Text | sales-culture.de: „Unsere Lösung", nur nebeneinander |
| `auftakt/Farbbild` | Markenfarbe liegt über dem Foto, Partner darauf, Zahlen mit Bild auf runder Farbform | opti-mice.de: Farbelemente mit Bildern, die Zahlen |
| `auftakt/Profil` | Profilbild vor Farbfläche, schwebendes Feld mit Wachstumskurve, Knopf mit Unterzeile | martinahalek.de: genau diese drei Teile |
| `Schwarzblende` | schwarzer Grund, Bild läuft ins Schwarz, Flächen blenden weich auf, blasses Wort im Grund | agencyinvest.de: schwarze Überlagerungen mit Fade; `--erlaubt verlaufsschleier` |
| `Aufstieg` | Satz steigt beim Scrollen hinter einem Produkt hervor | modulo-consulting.de: diese Scrollanimation |
| `Produktkacheln` | eckige hellgraue Kacheln mit Produkt, Marke, Titel, Plus | modulo-consulting.de: die eckigen Produktkacheln |
| `Produktschritte` | Produkt in Schritten, Reiter links, Bildschirm rechts, neutrale Flächen | consile.app: Konzept der Produktvorstellung, ohne Orange und Verläufe |
| `Schwebend` | Elemente schweben versetzt, Karten mit ruhigem Hover | saadsalman.org: schwebende Teile, Hover |
| `Produktansicht` | Objekt in benannten Ansichten, Farbe, Größe, Details | 180-Grad-Produktbetrachter: Produktansichten, Knöpfe |
| `Bildwerte` | Hochformatbilder mit Namensschild und bis zu drei Werten in einer Glasleiste | espmedia.de: Creator-Bilder mit Zahlen im Overlay |
| `Reservierung` | schwebendes Reservierungsfeld, einklappbar, auf dem Handy erst auf Tipp | tuluslotrek.de: die Idee, inhaltlich und gestalterisch verbessert |

## Material

`glas.css` ist das gemeinsame Glas (`.glas`, `.glas-dunkel`) mit Werten von
glisse.kelvinzhang.ca, deckendem Rückfall und `prefers-reduced-transparency`.
`GlasFilter.astro` ergänzt echte Lichtbrechung am Rand, nur in Chromium.
Glas gehört auf Schichtung über Bild oder Video, nicht auf einfarbigen Grund.

## Bewegung

Bewegung läuft wo möglich als reines CSS über `animation-timeline` und fällt
ohne Unterstützung auf den ruhenden Zustand zurück. Skripte sind `is:inline`,
damit sie auch in der sandboxed Vorschau unter `/dev` laufen. Alles
respektiert `prefers-reduced-motion`. Keine Bibliothek, kein gsap.

## Ansehen

```bash
scripts/muster-bauen.sh <preset>
```

Baut `starter/muster/` mit dem Preset nach `.blocktest/dist`.
