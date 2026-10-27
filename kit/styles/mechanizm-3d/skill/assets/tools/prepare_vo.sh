#!/usr/bin/env bash
# Lektor z ElevenLabs -> wycięta KAŻDA cisza i oddech -> tempo 1,12x -> poziom -> transkrypcja słowo w słowo.
# Według Biblii TikToka (skill tiktok-biblia, scripts/tts_tnij.py). Bez Biblii na tym komputerze: stare cięcie bez tempa.
# użycie (z katalogu projektu): bash tools/prepare_vo.sh "/Users/antoni/Downloads/ElevenLabs_....mp3"
# Wynik: assets/vo-raw.mp3 (oryginał), assets/vo.mp3 (cisza wycięta, 1,12x, szczyt -3,5 dBFS),
#        assets/vo-cut.mp3 (kopia vo.mp3), assets/silence-map.json, assets/transcript.json (+ transcript.orig.json).
set -euo pipefail
SRC="$1"
BIBLIA="$HOME/.claude/skills/tiktok-biblia/scripts/tts_tnij.py"
cp "$SRC" assets/vo-raw.mp3
if [ -f "$BIBLIA" ]; then
  python3 "$BIBLIA" assets/vo-raw.mp3 assets/vo.mp3 --silence-map assets/silence-map.json
  cp assets/vo.mp3 assets/vo-cut.mp3
else
  echo "UWAGA: brak ~/.claude/skills/tiktok-biblia, stare cięcie bez tempa 1,12x (zainstaluj skille: bash zainstaluj-skille.sh)"
  python3 tools/cut_silence.py assets/vo-raw.mp3 assets/vo-cut.mp3
  MAX=$(ffmpeg -hide_banner -i assets/vo-cut.mp3 -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  GAIN=$(python3 -c "print(round(-3.6 - ($MAX), 2))")
  ffmpeg -y -hide_banner -loglevel error -i assets/vo-cut.mp3 -af "volume=${GAIN}dB" -b:a 192k assets/vo.mp3
fi
ffmpeg -hide_banner -i assets/vo.mp3 -af volumedetect -f null - 2>&1 | grep -E "max_volume|mean_volume"
ffprobe -v error -show_entries format=duration -of csv=p=0 assets/vo.mp3
# transkrypcja nadpisuje assets/transcript.json, więc najpierw kopia, jeśli istnieje
[ -f assets/transcript.json ] && cp assets/transcript.json assets/transcript.bak.json
npx --yes hyperframes@0.8.58 transcribe assets/vo.mp3 -m medium -l pl --json
cp assets/transcript.json assets/transcript.orig.json
python3 - <<'EOF'
import json
w = json.load(open("assets/transcript.json"))
w = w if isinstance(w, list) else w.get("words", w)
print(len(w), "słów")
print(" ".join(f"{(x.get('text') or x.get('word')).strip()}@{x['start']:.2f}" for x in w))
EOF
