#!/usr/bin/env bash
#
# Baut eine Website und legt sie auf dem Server ab.
#
#   scripts/deploy.sh --projekt ../projekte/<kunde> --ziel /srv/www/<slug> [--preview]
#
# Atomarer Wechsel: der Build entsteht neben dem aktiven Stand und wird erst
# nach bestandenem Smoke-Test per Symlink aktiviert. Ein fehlgeschlagener
# Build veraendert den ausgelieferten Stand nicht.
#
# Domain, DNS, TLS und Zugangsdaten bleiben ausserhalb dieses Skripts.
# Die nginx-Vorlage liegt daneben als nginx-site.conf.template.

set -euo pipefail

PROJEKT=""
ZIEL=""
PREVIEW=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --projekt) PROJEKT="$2"; shift 2 ;;
    --ziel)    ZIEL="$2"; shift 2 ;;
    --preview) PREVIEW=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$PROJEKT" && -n "$ZIEL" ]] || { echo "--projekt und --ziel sind Pflicht" >&2; exit 2; }

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="$PROJEKT/site"
[[ -d "$SITE" ]] || { echo "Kein site/ in $PROJEKT" >&2; exit 2; }

RELEASE="$ZIEL/releases/$(date +%Y%m%d-%H%M%S)"

echo "== Build =="
( cd "$SITE" && npm ci --no-audit --no-fund && npm run build )

echo "== QA =="
"$KIT/scripts/qa.sh" --dir "$SITE/dist" --out "$PROJEKT/qa-bericht"

echo "== Ablegen =="
mkdir -p "$RELEASE"
cp -r "$SITE/dist/." "$RELEASE/"

if [[ $PREVIEW -eq 1 ]]; then
  # Vorschau: noindex zusaetzlich in der robots.txt, nicht nur als Header.
  # Das Gate allein haelt Inhalte nicht aus dem Index, wenn eine URL geteilt wird.
  printf 'User-agent: *\nDisallow: /\n' > "$RELEASE/robots.txt"
  rm -f "$RELEASE/sitemap.xml"
  echo "   Vorschau: robots.txt auf Disallow, sitemap.xml entfernt"
fi

echo "== Smoke-Test =="
node "$KIT/scripts/serve.mjs" "$RELEASE" 4399 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT
for _ in $(seq 1 40); do curl -sf http://localhost:4399/ -o /dev/null && break; sleep 0.25; done
for pfad in / /impressum /datenschutz; do
  curl -sf "http://localhost:4399$pfad" -o /dev/null || { echo "   FEHLER: $pfad nicht erreichbar" >&2; exit 1; }
  echo "   ok $pfad"
done
kill "$SERVER" 2>/dev/null || true
trap - EXIT

echo "== Aktivieren =="
ln -sfn "$RELEASE" "$ZIEL/current.neu"
mv -Tf "$ZIEL/current.neu" "$ZIEL/current"
echo "   aktiv: $RELEASE"

# Nur die letzten fuenf Releases behalten, damit ein Rollback moeglich bleibt.
( cd "$ZIEL/releases" && ls -1dt ./*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf )

echo
echo "Rollback: ln -sfn <aelterer-release> $ZIEL/current"
echo "nginx neu laden: sudo systemctl reload nginx"
