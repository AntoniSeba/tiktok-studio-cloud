#!/usr/bin/env bash
# Renderuje podglądy 18 stylów z pakietu studio-18 (ta sama polska treść w każdym stylu)
# do public/styles/csk-<id>/example.mp4 i poster.jpg. Każdy styl osobno, żeby nie zapchać dysku.
#   bash scripts/render-style-previews.sh                wszystkie
#   bash scripts/render-style-previews.sh swiss-grid     wybrane
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KIT="$ROOT/kit/styles/studio-18/skill"; OUT="$ROOT/public/styles"; WORK="${TMPDIR:-/tmp}/tss-style-previews"
ids=("$@"); [ ${#ids[@]} -eq 0 ] && ids=($(ls "$KIT/styles"))
for id in "${ids[@]}"; do
  W="$WORK/$id"; rm -rf "$W"; mkdir -p "$W"
  echo "== $id"
  python3 "$KIT/scripts/lookbook.py" "$W" --only "$id" > "$W/build.log" 2>&1 || { tail -5 "$W/build.log"; continue; }
  (cd "$W" && npx --yes hyperframes@0.8.58 render . -q standard -o renders/full.mp4 > render.log 2>&1) || { tail -8 "$W/render.log"; continue; }
  mkdir -p "$OUT/csk-$id"
  # bez 2,4 s planszy tytułowej lookbooka
  ffmpeg -v error -y -ss 2.4 -i "$W/renders/full.mp4" -vf scale=540:960 -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 96k -movflags +faststart "$OUT/csk-$id/example.mp4"
  ffmpeg -v error -y -ss 4.2 -i "$W/renders/full.mp4" -frames:v 1 -vf scale=540:960 -q:v 4 "$OUT/csk-$id/poster.jpg"
  rm -rf "$W"
done
echo "gotowe: $OUT"
