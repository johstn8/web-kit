#!/usr/bin/env bash
#
# Baut die Musterseite aller Inspirationsbloecke mit einem Preset.
#
#   scripts/muster-bauen.sh <preset>
#
# Der Bau liegt in .blocktest/ neben dem Starter, weil die Bloecke ueber den
# relativen Pfad ../../../blocks eingebunden sind; das Ergebnis liegt danach
# unter .blocktest/dist. Beide Ordner stehen nicht in Git und werden beim
# naechsten Lauf ueberschrieben. Das Skript startet keinen Browser.
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRESET="$1"
T="$KIT/.blocktest"
mkdir -p "$T/src/pages/auftakt" "$T/public"
cp -r "$KIT/starter/src/styles" "$KIT/starter/src/content" "$T/src/"
cp -r "$KIT/starter/muster/public/muster" "$T/public/"
cp "$KIT/starter/astro.config.mjs" "$KIT/starter/package.json" "$KIT/starter/tsconfig.json" "$T/"
cp "$KIT/starter/muster/index.astro" "$T/src/pages/index.astro"
sed "s#'\.\./styles#'../../styles#; s#'\.\./\.\./\.\./blocks#'../../../../blocks#" "$KIT/starter/muster/auftakte.astro" > "$T/src/pages/auftakt/[art].astro"
ln -sfn "$KIT/starter/node_modules" "$T/node_modules"
sed -i "s#@import '../../../tokens/tokens.css';#@import './tokens.css';#" "$T/src/styles/global.css"
node --experimental-strip-types "$KIT/scripts/tokens-to-css.ts" --preset "$PRESET" --out "$T/src/styles/tokens.css" >/dev/null
node --experimental-strip-types "$KIT/scripts/fetch-fonts.ts" --preset "$PRESET" --out "$T/public/fonts" --css "$T/src/styles/fonts.css" >/dev/null
cd "$T" && npx astro build 2>&1 | grep -E "ERROR|rror:|Complete!" | head -8
