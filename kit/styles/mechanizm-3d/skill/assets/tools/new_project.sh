#!/usr/bin/env bash
# Zakłada nowy projekt filmu z szablonu skilla.
# użycie: bash new_project.sh <katalog-videos> <id-filmu> <model1> [model2 ...]
#   <katalog-videos>  np. ".../scratch-2026-09-20-17b148/videos" albo dowolny folder projektu Antoniego
#   <id-filmu>        np. "r5-lepsze" (małe litery, myślniki)
#   <modelN>          nazwy katalogów z assets/models: r5-audi r6-s54 r6-2jz r3-turbo v6-ohc v8-ohc v8-smallblock wankel zawieszenie
# Po założeniu: popraw importy w film/main.js pod wybrane modele, wrzuć lektora do assets/vo-raw.mp3.
set -euo pipefail
SK="$(cd "$(dirname "$0")/.." && pwd)"
DST="$1/$2"
shift 2
mkdir -p "$DST"/{assets/broll/cut,film,tools,renders,model}
cp "$SK/template/index.html" "$DST/index.html"
cp "$SK/template/film/main.js" "$DST/film/main.js"
cp "$SK/template/hyperframes.json" "$DST/"
ID="$(basename "$DST")"
sed "s/r5-lepsze/$ID/g" "$SK/template/package.json" > "$DST/package.json"
printf '{\n  "id": "%s",\n  "name": "%s",\n  "createdAt": "%s"\n}\n' "$ID" "$ID" "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" > "$DST/meta.json"
cp "$SK/tools/"*.py "$SK/tools/"*.sh "$DST/tools/" 2>/dev/null || true
rsync -a "$SK/models/vendor/" "$DST/model/vendor/"
for m in "$@"; do rsync -a "$SK/models/$m/" "$DST/model/$m/"; done
cp "$SK/models/turbo-standalone.js" "$DST/film/turbo.js"
# fonty do surowego podglądu (ten sam plik, którego używa render)
mkdir -p "$DST/.dbgfonts/osw" "$DST/.dbgfonts/plex"
cp ~/.cache/hyperframes/fonts/oswald/600-normal-*.woff2 "$DST/.dbgfonts/osw/" 2>/dev/null || true
cp ~/.cache/hyperframes/fonts/ibm-plex-mono/600-normal-*.woff2 "$DST/.dbgfonts/plex/" 2>/dev/null || true
echo "gotowe: $DST"
ls "$DST" "$DST/model"
