# Website-Vorlagen

Je Vorlage eine vollständige Startseite nach dem Aufbau einer Website, die der
Nutzer genannt hat. Eine Vorlage bringt mit, was ein Preset nicht kann: eigene
Kopfzeile, eigene Sektionsfolge, eigene Maße, eigene Bewegung. **Hier entsteht
die Vielfalt.** Jede Datei ist in sich geschlossen; es gibt keinen gemeinsamen
Seitenaufbau, damit sich nichts wieder angleicht.

| Vorlage | Aufbau nach | Passt zu | Trägt die Seite |
|---|---|---|---|
| `hafen` | the1.amsterdam | Büro, Kultur, Coworking, Kreative | riesige Schrift, Farbbänder, große Fotos |
| `rahmen` | lightshiprv.com | Produkt, Fahrzeug, Handwerk mit Objekt | Foto im Rahmen, klebender Riesensatz, Bildstapel |
| `kuehl` | mercury.com | Software, Finanzen, Beratung | Spalte, wechselnde Bänder, Glas, Gerät im Foto |
| `schmal` | meracinque.com | Lebensmittel, Hofladen, Marke | schmale Antiqua, festes Produkt, Farbe |
| `wortmarke` | standard-berlin.de | Gastronomie mit Filialen, Laden | Wortmarke, Weiß, gerahmte Kästen |
| `kongress` | ko-mon.de | Veranstaltung, Messe, Verband | Pfirsich, Wortlicht, klebende Vollbilder |
| `rund` | jovoco.io | IT, Agentur, B2B-Dienstleister | runde Formen, dunkles Band, Zahlenmosaik |
| `verlauf` | metagram-solutions.com | Beratung, Technik | Weißraum, Diagramme, Schillerflächen, Karte |
| `system` | comito.de | Systemhaus, Dienstleister mit vielen Leistungen | dunkles Vollbild, rotes Puzzle, Leistungskarten |
| `gericht` | lagalante-restaurant.de | gehobene Gastronomie | Gerichte ohne Rahmen, Weiß, Karte mittig |
| `salon` | minerestaurant.de | Restaurant, Hotel, Bar | kursive Cardo, festes Band mit Zeiten unten, runder Aufkleber |
| `abend` | carbonenewyork.com | Restaurant mit Geschichte, Bar, Club | Marine und Creme, vollbreite Fotos, Halbseiten, keine Bewegung |
| `kurs` | scaly.com | Weiterbildung, Coaching, Förderangebote | Pfirsichkarte im Auftakt, Reiter, Blob-Foto, viel Beweis |
| `bogen` | tunymedia.at | Agentur, Dienstleister für eine Branche | Bogenkanten, gekippte Bildcollagen, Gerät im Abschluss |

Alle vierzehn auf einen Blick: [`uebersicht.webp`](uebersicht.webp).

Die Spalte „Passt zu" ist ein Hinweis. Ein Bäcker kann `hafen` tragen.

## Benutzen

```bash
scripts/vorlage-bauen.sh hafen    # nach ../projekte/kit-vorlagen/versions/hafen/dist, erscheint auf /dev
```

Für einen Auftrag `Seite.astro` und `preset.json` in das Projekt kopieren,
Inhalte nach `content/<website>.json` ziehen, Farben und Bilder des Betriebs
einsetzen. **Der Aufbau bleibt.** Am Ende neben das Original legen.

## Bewusste Abweichungen vom Original

- Farben sind wo nötig minimal nachgedunkelt, weil die Originale teils den Kontrast
  nach WCAG AA verfehlen: Grautext bei `rahmen`, Rosa und Lila bei `schmal`, Rot bei
  `system`, Orange bei `kongress`.
- `kongress` färbt wie ko:mon einzelne Wörter in Überschriften. In `qa.sh` dafür
  `--erlaubt teilauszeichnung` setzen. `hafen` trägt die Riesenziffern von the1.
- Dachzeilen der Originale sind entfallen; der Nutzer hat sie als KI-typisch benannt.
- `salon` trägt statt der Michelin-Plakette einen neutralen Gutschein-Aufkleber, und die
  Auszeichnungen sind zu Partnern geworden: Eine Vorlage behauptet keinen Preis.
- Illustrationen, Produktfotos und Gerichte der Originale gehören den Betrieben.
  Die Vorlagen zeigen dort Stockfotos oder einfache CSS-Formen; besonders `gericht`,
  `schmal` und `verlauf` leben erst mit echtem Material.

## Was eine Vorlage nicht enthält

Texte, Bilder, Logos und Quellcode der Referenzseite. Die Firmen in den
Vorlagen sind erfunden, die Fotos stehen unter Unsplash-Lizenz, siehe
`_bilder/QUELLEN.md`. Nachgebaut sind Aufbau und gemessene Maße. Wo die Seite
eine kommerzielle Schrift nutzt, steht die nächste freie Familie.

Eine neue Lieblingsseite wird eine neue Vorlage: mit
`scripts/stil-messen.ts --strecke 15` aufnehmen, Abschnitt für Abschnitt
nachbauen, neben das Original legen. Mehrere Seiten werden nie gemittelt.
