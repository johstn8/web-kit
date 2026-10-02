# Art-Direction-Presets

Fünf Stilrichtungen als **Datei**, nicht als Prosa. Jede ist ein
vollständiger Tokensatz: Schriftrollen, Palette für Licht und Dunkel,
Radius-, Abstands- und Bewegungsgrammatik, dazu die Entscheidung, was die
Abgrenzung trägt.

Der Zweck: Wer eine Richtung wählt, startet nicht beim statistischen
Mittel. Genau dieses Mittel ist der Grund, warum generierte Websites
einander gleichen — das Modell greift ohne Vorgabe zur wahrscheinlichsten
Lösung, und die ist überall dieselbe.

| Preset | Für | Abgrenzung | Radius | Display / Text | Belegt an |
|---|---|---|---|---|---|
| `werkstatt` | Handwerk, Fahrzeugservice, Logistik, Bau | Rahmen | 0 | Archivo 800 / Public Sans | car-tex.de, spedition-stuckmann.de, fahrschule-gosink.de |
| `praxis` | Gesundheit, Pflege, Therapie | Fläche | 0,875 rem | Source Serif 4 / Public Sans | zahnarztpraxis-uhlenhorst.de, drquidenus.at, daylight-health.com |
| `tisch` | Gastronomie, Bäckerei, Hofladen, Hotellerie | Fläche, dunkel | 0,25 rem | Alegreya 400 / Work Sans | minerestaurant.de, amritpalace.com, munrooftoprome.com |
| `kanzlei` | Kanzlei, Steuerberatung, Verwaltung | Linie | 0 | Spectral / Spectral | sacherer-partner.de, ko-mon.de, dediq.com |
| `atelier` | Studio, Architektur, Fotografie, Portfolio | Weißraum | 0 | Bricolage Grotesque / Hanken Grotesk | kononenkogroup.com, phillipohren.com, huts.com |

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
| `ziffernmarken` | wann `01 / 02 / 03` zulässig ist: nur im Inhalt einer echten Abfolge, nie als Marke über einer Überschrift |

Ohne diesen Block wäre ein Preset nur ein Farb- und Schriftwechsel. Die
Entscheidung „Rahmen oder Fläche oder Weißraum" ist aber der Teil, der zwei
Websites wirklich verschieden macht. Was nicht gültig ist, sind zwei
Trennmittel gleichzeitig: Hairline **und** Schatten am selben Element ist
ein Befund nach `20-design/anti-ai-slop.md`.

## Warum diese Schriften

Keine von ihnen ist eine der Familien, zu denen ein Modell ohne Vorgabe
greift. Inter, Roboto, Open Sans, Lato und der System-Stack sind die
zuverlässigsten Schrifthinweise auf eine generierte Seite.

Alle fünf Presets verwenden ausschließlich Schriften unter der
**SIL Open Font License 1.1**. `fetch-fonts.ts` lädt sie herunter und
hostet sie im Projekt: eine Einbindung von `fonts.googleapis.com` wäre ein
Drittanbieter-Datenfluss und damit ein Consent-Fall für etwas, das keinen
Consent braucht. Die Lizenz gehört danach in das Asset Register des
Projekts.

Geladen werden nur die Schnitte, die die Type Ramp des Presets wirklich
anfordert — beim Basissystem zwölf Dateien, rund 300 KB.
