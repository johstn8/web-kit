# Art-Direction-Presets

Acht Stilrichtungen als **Datei**, nicht als Prosa. Jede ist ein
vollständiger Tokensatz: Schriftrollen, Palette für Licht und Dunkel,
Radius-, Abstands- und Bewegungsgrammatik, dazu die Entscheidung, was die
Abgrenzung trägt.

Der Zweck: Wer eine Richtung wählt, startet nicht beim statistischen
Mittel. Genau dieses Mittel ist der Grund, warum generierte Websites
einander gleichen — das Modell greift ohne Vorgabe zur wahrscheinlichsten
Lösung, und die ist überall dieselbe.

| Preset | Anmutung | Für | Abgrenzung | Aktion | Display / Text | Belegt an |
|---|---|---|---|---|---|---|
| `produkt` | gegenwärtig | Hersteller, Industrie, Technik, B2B mit Produkten | Fläche, Kacheln mit großem Radius | weich | Onest / Onest | rico-gmbh.de |
| `freundlich` | gegenwärtig | Kita, Friseur, Café, Sport, Fahrschule, Nachhilfe | Farbfläche | Pille | Gabarito / Figtree | – |
| `klar` | gegenwärtig | Beratung, Immobilien, IT-Dienstleister, moderne Praxis | Haarlinie | rund | Golos Text / Golos Text | – |
| `atelier` | gegenwärtig | Studio, Architektur, Fotografie, Portfolio | Weißraum | Pille | Bricolage Grotesque / Hanken Grotesk | kononenkogroup.com, phillipohren.com, huts.com |
| `werkstatt` | gegenwärtig | Handwerk, Fahrzeugservice, Logistik, Bau | Rahmen | Kante | Archivo 800 / Public Sans | car-tex.de, spedition-stuckmann.de |
| `praxis` | klassisch | Gesundheit, Pflege, Therapie | Fläche | rund | Source Serif 4 / Public Sans | zahnarztpraxis-uhlenhorst.de, drquidenus.at, daylight-health.com |
| `tisch` | klassisch | Gastronomie, Bäckerei, Hofladen, Hotellerie | Fläche, dunkel | weich | Alegreya 400 / Work Sans | minerestaurant.de, amritpalace.com, munrooftoprome.com |
| `kanzlei` | klassisch | Kanzlei, Steuerberatung, Verwaltung | Linie | Kante | Spectral / Spectral | sacherer-partner.de |

**Gegenwärtig ist der Normalfall.** Die drei klassischen Presets tragen eine
Serife und zitieren damit eine ältere Anmutung. Sie werden nur gewählt, wenn
Marke, Ort oder Auftrag diesen Zeitbezug tragen, nicht weil die Gattung es
nahelegt. Bis 2026-11-04 gab es nur fünf Presets, drei davon mit Radius null
und drei mit Serife; fünf der letzten acht gebauten Websites trugen danach
eine Serife als Displayschrift. Regel in
`web-brain 20-design/design-direction.md#Stilwahl je Auftrag`.

**Ein Preset wechselt Farben und Schriften, nicht den Aufbau.** Für einen eigenen Aufbau gibt es die Website-Vorlagen unter `vorlagen/`; sie sind der Ausgangspunkt einer neuen Website, Presets die Ergänzung.

**Ein Preset ist ein technischer Startpunkt, kein Stil.** Der Stil eines
Auftrags entsteht aus der eigenen Stilrecherche dieses Laufs und liegt danach
als projekteigenes Preset unter `<projekt>/design/<name>.json`. Die Skripte
nehmen dafür einen Pfad statt eines Namens:

```bash
node --experimental-strip-types scripts/tokens-to-css.ts --preset ../projekte/<kunde>/design/<name>.json --out ...
```

Werte einer Referenzseite misst `scripts/stil-messen.ts --url <adresse> --out <ordner>`:
Schriften, Type Ramp, Radius von Aktionen, Kacheln und Bildern, Grund- und
Akzentfarben, dazu Aufnahmen bei 1440 und 390 Pixel. `produkt` ist so aus
rico-gmbh.de abgeleitet: Aktionen 8 px, Kacheln 20 px, Kachelgrund
`#f0f2f5`, keine Schatten.

**Vor der Festlegung den Stilverlauf prüfen:**

```bash
node --experimental-strip-types scripts/stilverlauf.ts --kandidat ../projekte/<kunde>/design/<name>.json
```

Das Skript liest Displayschrift, Aktionsform, Grundhelligkeit und Papiergrund
aus dem ausgelieferten CSS der letzten Websites und meldet, wenn der
Kandidat sie wiederholt.

**Schriften gegen die Sperrliste.** Bis 2026-10-02 schlugen drei der fünf
Presets eine Familie vor, die auf der Sperrliste übernutzter Schriften steht
(Fraunces, Newsreader, Instrument Sans). Wer dem Kit folgte, landete damit
im Default, den die Presets verhindern sollen. Jede Schrift eines Presets
wird deshalb vor dem Eintrag gegen beide Listen geprüft, siehe
`web-brain 20-design/typography-layout-and-spacing.md#Sperrliste`.

Die Belegseiten stehen im
[Website Reference Pool](https://github.com/johstn8/web-brain) des Brains.
Ein Preset ist keine Kopie dieser Seiten, sondern die Ableitung ihrer
Grammatik auf den Tokenvertrag.

## Anwenden

```bash
node --experimental-strip-types scripts/tokens-to-css.ts --preset werkstatt --out tokens/tokens.css
node --experimental-strip-types scripts/fetch-fonts.ts   --preset werkstatt
node --experimental-strip-types scripts/check-contrast.ts --preset werkstatt
```

Danach die Werte dieses Betriebs setzen: Akzentfarbe aus Marke, Material
oder Ort, gegebenenfalls eine andere Schrift. **Die Rollennamen bleiben
unverändert** — deshalb laufen alle Blöcke ohne Änderung weiter.

Ein Preset ist ein Ausgangspunkt, kein Fertigprodukt. Zwei Websites mit
demselben Preset und denselben Werten wären ein Befund; zwei Websites mit
demselben Preset und verschiedenen Werten, Auftaktkompositionen und
Sektionsfolgen sind der Normalfall.

## `grammar`

Jedes Preset trägt einen `grammar`-Block. Er wird von
`tokens-to-css.ts` in Tokens übersetzt, die die Blöcke auswerten:

| Feld | Wirkung |
|---|---|
| `abgrenzung` | `rahmen` \| `flaeche` \| `linie` \| `weissraum` — was Container voneinander trennt |
| `tiefe` | `keine` \| `schatten` \| `ueberlagerung` |
| `versalbeschriftung` | schaltet Versalien für Beschriftungen; in allen fünf Presets `false` |
| `sektionstrenner` | `linie` \| `flaeche` \| `weissraum` \| `bild` |
| `farbfelder` | kräftige Flächen außerhalb der Rollen, je mit Schriftfarbe; werden zu `--feld-1-grund` usw., `check-contrast.ts` prüft jedes Paar |
| `ziffernmarken` | wann `01 / 02 / 03` zulässig ist: nur im Inhalt einer echten Abfolge, nie als Marke über einer Überschrift |
| `aktionsform` | `kante` \| `weich` \| `rund` \| `pille` — Form der Buttons, unabhängig vom Radius der Container; wird zu `--aktion-radius` |

Ohne diesen Block wäre ein Preset nur ein Farb- und Schriftwechsel. Die
Entscheidung „Rahmen oder Fläche oder Weißraum" ist aber der Teil, der zwei
Websites wirklich verschieden macht. Was nicht gültig ist, sind zwei
Trennmittel gleichzeitig: Hairline **und** Schatten am selben Element ist
ein Befund nach `20-design/anti-ai-slop.md`.

## Warum diese Schriften

Keine von ihnen ist eine der Familien, zu denen ein Modell ohne Vorgabe
greift. Inter, Roboto, Open Sans, Lato und der System-Stack sind die
zuverlässigsten Schrifthinweise auf eine generierte Seite.

Alle Presets verwenden ausschließlich Schriften unter der
**SIL Open Font License 1.1**. `fetch-fonts.ts` lädt sie herunter und
hostet sie im Projekt: eine Einbindung von `fonts.googleapis.com` wäre ein
Drittanbieter-Datenfluss und damit ein Consent-Fall für etwas, das keinen
Consent braucht. Die Lizenz gehört danach in das Asset Register des
Projekts.

Geladen werden nur die Schnitte, die die Type Ramp des Presets wirklich
anfordert — beim Basissystem zwölf Dateien, rund 300 KB.
