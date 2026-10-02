#!/usr/bin/env bash
#
# QA-Lauf einer gebauten Website. Gehoert zur Fast Lane und zu Gate G1/G4.
#
#   scripts/qa.sh [--dir starter/dist] [--port 4321] [--skip lighthouse,axe]
#
# Prueft der Reihe nach:
#   1. Platzhalter- und TODO-Reste im Build
#   2. interner Link-Check ueber das ausgelieferte HTML
#   3. Screenshots bei 375 und 1280 Pixel, ganzseitig
#   4. axe (Accessibility)
#   5. Harte Sperren gegen KI-Anmutung (Dachzeile, Nummernmarke,
#      Teilauszeichnung, Verlauf ueber Foto, gleichfoermige Startseite)
#   6. Lighthouse (Performance, SEO, Best Practices)
#
# Exit-Code 1, sobald eine Pflichtpruefung faellt. Fehlende optionale
# Werkzeuge werden als UEBERSPRUNGEN gemeldet, nicht als bestanden.

set -uo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$KIT/starter/dist"
PORT=4321
SKIP=""
BERICHT="$KIT/starter/qa-bericht"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)   DIR="$2"; shift 2 ;;
    --port)  PORT="$2"; shift 2 ;;
    --skip)  SKIP="$2"; shift 2 ;;
    --out)   BERICHT="$2"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

node_bin="$(command -v node || echo /opt/node-v24.19.0/bin/node)"
FEHLER=0
UEBERSPRUNGEN=()

ueberspringen() { [[ ",$SKIP," == *",$1,"* ]]; }
kopf()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
fehlt() { UEBERSPRUNGEN+=("$1"); printf '   UEBERSPRUNGEN: %s\n' "$2"; }

if [[ ! -d "$DIR" ]]; then
  echo "Build-Verzeichnis fehlt: $DIR" >&2
  echo "Zuerst 'npm run build' im Projekt ausfuehren." >&2
  exit 2
fi
mkdir -p "$BERICHT"

# ---------------------------------------------------------------- 1. Reste
kopf "Platzhalter- und TODO-Reste"
MUSTER='TODO|FIXME|XXX|Lorem ipsum|PLATZHALTER|\{\{[a-z_]+\}\}|ai-placeholder'
if grep -rEn --include='*.html' --include='*.css' --include='*.js' "$MUSTER" "$DIR" > "$BERICHT/reste.txt" 2>/dev/null; then
  echo "   FEHLER: Reste im Build gefunden"
  sed 's/^/     /' "$BERICHT/reste.txt" | head -20
  FEHLER=1
else
  echo "   ok: keine Platzhalter- oder TODO-Reste"
  : > "$BERICHT/reste.txt"
fi

# --------------------------------------------------------- 2. Link-Check
kopf "Interner Link-Check"
"$node_bin" --experimental-strip-types "$KIT/scripts/link-check.ts" "$DIR" | tee "$BERICHT/links.txt"
[[ ${PIPESTATUS[0]} -ne 0 ]] && FEHLER=1

# ------------------------------------------------- Server fuer 3 bis 6
kopf "Statischen Server starten"
"$node_bin" "$KIT/scripts/serve.mjs" "$DIR" "$PORT" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT
for _ in $(seq 1 40); do
  curl -sf "http://localhost:$PORT/" -o /dev/null && break
  sleep 0.25
done
if ! curl -sf "http://localhost:$PORT/" -o /dev/null; then
  echo "   FEHLER: Server nicht erreichbar auf Port $PORT"
  exit 1
fi
echo "   ok: http://localhost:$PORT"

# ------------------------------------------------------- 3. Screenshots
kopf "Screenshots bei 375 und 1280"
if ueberspringen screenshots; then
  fehlt screenshots "durch --skip abgewaehlt"
else
  "$node_bin" --experimental-strip-types "$KIT/scripts/render-shots.ts" \
    --base "http://localhost:$PORT" --out "$BERICHT/shots" 2>&1 | sed 's/^/   /'
  if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
    fehlt screenshots "kein Browser verfuegbar - ohne Render ist Gate G1 nicht erfuellt"
  fi
fi

# ------------------------------------------------------------- 4. axe
kopf "Accessibility (axe)"
if ueberspringen axe; then
  fehlt axe "durch --skip abgewaehlt"
else
  "$node_bin" --experimental-strip-types "$KIT/scripts/check-axe.ts" \
    --base "http://localhost:$PORT" --out "$BERICHT/axe.json" 2>&1 | sed 's/^/   /'
  case "${PIPESTATUS[0]}" in
    0) : ;;
    1) FEHLER=1 ;;
    *) fehlt axe "axe-core oder Browser nicht verfuegbar" ;;
  esac
fi

# -------------------------------------------------- 5. Harte Sperren
# Nicht abwaehlbar ueber --skip: Diese Muster sind gesperrt, nicht
# begruendbar. Regeln: web-brain 20-design/anti-ai-slop.md#Harte Sperren
kopf "Harte Sperren gegen KI-Anmutung"
"$node_bin" --experimental-strip-types "$KIT/scripts/check-slop.ts" \
  --base "http://localhost:$PORT" --out "$BERICHT/slop.json" 2>&1 | sed 's/^/   /'
case "${PIPESTATUS[0]}" in
  0) : ;;
  1) FEHLER=1 ;;
  *) echo "   FEHLER: Pruefung nicht ausfuehrbar. Ohne Browser ist sie nicht belegt."; FEHLER=1 ;;
esac

# ------------------------------------------------------- 6. Lighthouse
kopf "Lighthouse"
if ueberspringen lighthouse; then
  fehlt lighthouse "durch --skip abgewaehlt"
elif ! command -v npx > /dev/null; then
  fehlt lighthouse "npx nicht verfuegbar"
else
  CHROME="$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)"
  if [[ -n "$CHROME" ]]; then export CHROME_PATH="$CHROME"; fi
  LIBS="$HOME/.local/lib/chromium-deps/usr/lib/x86_64-linux-gnu"
  if [[ -d "$LIBS" ]]; then export LD_LIBRARY_PATH="$LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"; fi
  if npx --yes lighthouse "http://localhost:$PORT/" \
      --quiet --chrome-flags='--headless=new --no-sandbox' \
      --output=json --output=html \
      --output-path="$BERICHT/lighthouse" > "$BERICHT/lighthouse.txt" 2>&1; then
    "$node_bin" -e '
      const r = require(process.argv[1] + ".report.json");
      const ziel = { performance: 0.9, accessibility: 0.95, "best-practices": 0.9, seo: 0.95 };
      let schlecht = 0;
      for (const [k, min] of Object.entries(ziel)) {
        const s = r.categories[k]?.score ?? 0;
        const ok = s >= min;
        if (!ok) schlecht++;
        console.log(`   ${ok ? "ok " : "FEHLER"} ${k}: ${(s * 100).toFixed(0)} (Ziel ${min * 100})`);
      }
      process.exit(schlecht ? 1 : 0);
    ' "$BERICHT/lighthouse" || FEHLER=1
  else
    fehlt lighthouse "nicht ausfuehrbar, siehe $BERICHT/lighthouse.txt"
  fi
fi

# ----------------------------------------------------------- Ergebnis
kopf "Ergebnis"
if [[ ${#UEBERSPRUNGEN[@]} -gt 0 ]]; then
  printf '   uebersprungen: %s\n' "$(IFS=', '; echo "${UEBERSPRUNGEN[*]}")"
  echo "   Uebersprungene Pruefungen gelten nicht als bestanden und gehoeren"
  echo "   als offener Punkt in release-readiness/<website-slug>.md."
fi
if [[ $FEHLER -eq 0 ]]; then
  echo "   QA bestanden. Bericht: $BERICHT"
else
  echo "   QA nicht bestanden. Bericht: $BERICHT"
fi
exit $FEHLER
