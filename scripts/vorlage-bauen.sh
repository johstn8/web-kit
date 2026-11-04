#!/usr/bin/env bash
#
# Baut eine Website-Vorlage aus vorlagen/<name>/ als statische Seite.
#
#   scripts/vorlage-bauen.sh <name> [ziel]
#
# ziel ist standardmaessig ../projekte/kit-vorlagen/versions/<name>/dist, das
# erscheint von allein auf /dev. Alle Pfade im Ergebnis sind relativ, damit die
# Seite auch unter einem Unterpfad laeuft. Startet keinen Browser.
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="$1"; V="$KIT/vorlagen/$NAME"
ZIEL="${2:-$KIT/../projekte/kit-vorlagen/versions/$NAME/dist}"
T="$KIT/.vorlagenbau"
mkdir -p "$T/src/pages" "$T/src/styles" "$T/public/bilder" "$ZIEL"
cp "$KIT/starter/astro.config.mjs" "$KIT/starter/package.json" "$KIT/starter/tsconfig.json" "$T/"
ln -sfn "$KIT/starter/node_modules" "$T/node_modules"
cp "$KIT"/vorlagen/_bilder/*.webp "$T/public/bilder/"
# Schriften der vorigen Vorlage nicht mitnehmen.
find "$T/public" -name "*.woff2" -delete
cp "$V/Seite.astro" "$T/src/pages/index.astro"
node --experimental-strip-types "$KIT/scripts/tokens-to-css.ts" --preset "$V/preset.json" --out "$T/src/styles/tokens.css" >/dev/null
for versuch in 1 2 3; do
  node --experimental-strip-types "$KIT/scripts/fetch-fonts.ts" --preset "$V/preset.json" --out "$T/public/fonts" --css "$T/src/styles/fonts.css" >/dev/null && break
  sleep 3
done
(cd "$T" && npx astro build 2>&1 | grep -E "ERROR|rror:|Complete!" | head -6)
cp -r "$T/dist/." "$ZIEL/"
python3 - "$ZIEL" <<'PY'
import sys, pathlib
z = pathlib.Path(sys.argv[1])
for f in z.rglob('*.html'):
    s = f.read_text()
    for a in ('_astro', 'fonts', 'bilder'):
        s = s.replace(f'"/{a}/', f'"./{a}/').replace(f"'/{a}/", f"'./{a}/").replace(f'(/{a}/', f'(./{a}/')
    f.write_text(s)
for f in z.rglob('*.css'):
    s = f.read_text().replace("url(/fonts/", "url(../fonts/").replace("url('/fonts/", "url('../fonts/").replace('url("/fonts/', 'url("../fonts/')
    f.write_text(s)
PY
