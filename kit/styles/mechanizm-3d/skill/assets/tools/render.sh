#!/usr/bin/env bash
# Render MP4 TYLKO na wyraźne polecenie Antoniego ("wygeneruj mp4", "renderuj").
# Renderuje z izolowanej kopii (Studio dopisuje data-hf-id do index.html), zawsze --workers 1.
# użycie: bash render.sh <katalog-projektu> <plik-wyjściowy.mp4> <katalog-roboczy-w-scratchpadzie>
# np.:    bash render.sh ".../videos/r5-lepsze" "/Users/antoni/Downloads/r5-lepsze.mp4" "$SCRATCH/render-r5"
set -euo pipefail
P="$1"; OUT="$2"; S="$3"
rm -rf "$S"; mkdir -p "$S"
rsync -a --exclude .dbgfonts --exclude renders --exclude snapshots --exclude assets/vo-raw.mp3 --exclude 'model/*/node_modules' "$P/" "$S/"
sed -i '' -E 's/ data-hf-id="[^"]*"//g' "$S/index.html"
echo "data-hf-id po czyszczeniu: $(grep -c 'data-hf-id' "$S/index.html" || true)"
cd "$S"
npx --yes hyperframes@0.8.58 lint . | tail -2
# typowo 5 do 8 minut na 140 do 170 s filmu; uruchamiać w tle i czekać na koniec procesu
npx --yes hyperframes@0.8.58 render . -q high --workers 1 -o "$OUT" > render.log 2>&1
tr '\r' '\n' < render.log | grep -av '^\s*$' | tail -3
ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name -of compact "$OUT"
ffmpeg -hide_banner -i "$OUT" -af volumedetect -vn -f null - 2>&1 | grep -E "max_volume|mean_volume"
# szczyt ma wyjść ok. -3,5 do -3,7 dBFS; jeśli wyżej niż -3, popraw bez ponownego renderu:
#   ffmpeg -i in.mp4 -af volume=-1dB -c:v copy -c:a aac out.mp4
