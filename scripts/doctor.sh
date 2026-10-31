#!/usr/bin/env bash
# doctor.sh: checks everything TikTok Studio Cloud and its generator need, one line per item.
# OK = fine, BRAK = missing (with the fix), UWAGA = optional. Never prints key values.
# usage (from the repo folder): bash scripts/doctor.sh        exit code 1 when something required is missing
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
FAIL=0
ok()   { printf '  OK     %s\n' "$1"; }
brak() { printf '  BRAK   %s\n         naprawa: %s\n' "$1" "$2"; FAIL=1; }
warn() { printf '  UWAGA  %s\n         %s\n' "$1" "$2"; }
OS="$(uname -s)"; ARCH="$(uname -m)"
echo "TikTok Studio Cloud: kontrola instalacji ($OS $ARCH)"

echo "1. Programy"
if [ "$OS" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ] && [ "$ARCH" = "x86_64" ]; then
  warn "terminal działa pod Rosettą (x86_64) na Macu z Apple Silicon" "paczki Pythona arm64 nie zadziałają w x86_64; usługa startuje przez 'arch -arm64' (scripts/autostart.sh), testy Pythona niżej też"
fi
PY="python3"; [ "$OS" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ] && PY="arch -arm64 python3"
if command -v node >/dev/null; then
  NV="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NV" -ge 20 ] && ok "node $(node -v)" || brak "node $(node -v) jest za stary (potrzeba 20+)" "macOS: brew install node@22 | Linux: https://nodejs.org (LTS 22)"
else brak "node" "macOS: brew install node@22 | Linux: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs"; fi
command -v npm >/dev/null && ok "npm" || brak "npm" "instaluje się razem z node"
for b in ffmpeg ffprobe; do command -v $b >/dev/null && ok "$b" || brak "$b" "macOS: brew install ffmpeg | Linux: sudo apt-get install -y ffmpeg"; done
command -v tesseract >/dev/null && ok "tesseract (OCR stref TikToka)" || brak "tesseract" "macOS: brew install tesseract | Linux: sudo apt-get install -y tesseract-ocr"
command -v python3 >/dev/null && ok "python3 ($(python3 -V 2>&1))" || brak "python3" "macOS: brew install python@3.12 | Linux: sudo apt-get install -y python3 python3-pip"
if $PY -c 'import numpy, PIL' 2>/dev/null; then ok "python: numpy i Pillow ($(command -v python3))"
else brak "python: numpy i Pillow w $(command -v python3) (pierwszy python3 w PATH; ten sam musi być w PATH usługi)" "$PY -m pip install --user numpy Pillow   (Linux z błędem externally-managed: dodaj --break-system-packages)"; fi
# same order as kit/tools/words.py: whisper.cpp (with a ggml-base model), then faster-whisper, then openai-whisper
WHISPER=""
for m in "$WHISPER_CPP_MODEL" "$HOME/remotion/scratch/whisper.cpp/ggml-base.bin" "$HOME/.cache/whisper/ggml-base.bin" /opt/homebrew/share/whisper-cpp/ggml-base.bin; do
  [ -n "$m" ] && [ -f "$m" ] && command -v whisper-cli >/dev/null && WHISPER="whisper.cpp ($m)" && break
done
[ -z "$WHISPER" ] && $PY -c 'import faster_whisper' 2>/dev/null && WHISPER="faster-whisper"
[ -z "$WHISPER" ] && $PY -c 'import whisper' 2>/dev/null && WHISPER="openai-whisper"
[ -n "$WHISPER" ] && ok "czasy słów lektora: $WHISPER" || brak "whisper (czasy słów lektora)" "macOS: brew install whisper-cpp && mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin | Linux: $PY -m pip install --user faster-whisper"
if command -v claude >/dev/null; then ok "Claude Code ($(claude --version 2>/dev/null | head -1))"
else brak "Claude Code (silnik agenta wideo)" "npm install -g @anthropic-ai/claude-code, potem w terminalu: claude (zaloguj się) albo wpisz ANTHROPIC_API_KEY do .env"; fi
if [ -d "$HOME/.npm/_npx" ] && ls "$HOME"/.npm/_npx/*/node_modules/hyperframes >/dev/null 2>&1; then ok "hyperframes 0.8.58 w cache npx"
else warn "hyperframes jeszcze nie pobrany" "npx --yes hyperframes@0.8.58 --version   (raz, pobiera też przeglądarkę do renderu)"; fi

echo "2. Projekt"
[ -d node_modules/better-sqlite3 ] && ok "paczki Node (node_modules)" || brak "paczki Node" "npm install"
if [ -f .env ]; then
  ok ".env istnieje"
  has() { grep -qE "^$1=.+" .env || [ -n "${!1}" ]; }   # in .env, or exported by the shell profile
  has OPENROUTER_API_KEY && ok "OPENROUTER_API_KEY ustawiony" || brak "OPENROUTER_API_KEY (lektor Gemini, obrazy AI, asystent)" "klucz z https://openrouter.ai/keys wpisz do .env"
  for k in PEXELS_API_KEY APIFY_API_TOKEN BREVO_SMTP_KEY; do has $k && ok "$k ustawiony" || warn "$k brak (opcjonalny)" "bez niego część funkcji jest wyłączona, reszta działa"; done
  [ "$(stat -f %Lp .env 2>/dev/null || stat -c %a .env)" = "600" ] && ok ".env ma prawa 600" || warn ".env czytelny dla innych" "chmod 600 .env"
else brak ".env" "Claude tworzy go według INSTALL.md, krok 5 (pyta o klucze)"; fi
FREE=$(df -Pk "$ROOT" | LC_ALL=C awk 'NR==2{printf "%.1f", $4/1048576}')
LC_ALL=C awk -v f="$FREE" 'BEGIN{exit !(f >= 10)}' && ok "wolne miejsce na dysku: $FREE GB" || warn "wolne miejsce na dysku: $FREE GB" "generator potrzebuje min. 2 GB, a na serię filmów 3D licz 10 GB i więcej"

echo "3. Kanał Silniki (tylko jeśli go używasz)"
SK="${SKILLS_DIR:-$HOME/.claude/skills}"; SIL="${SILNIKI_DIR:-$HOME/projekty/silniki-tiktok}"
for s in tiktok-biblia tiktok-silnik-film tiktok-silnik-skrypt; do [ -f "$SK/$s/SKILL.md" ] && ok "skill $s" || warn "skill $s brak w $SK" "git clone https://github.com/AntoniSeba/silniki-tiktok.git \"$SIL\" && bash \"$SIL/zainstaluj-skille.sh\""; done
[ -d "$SIL/filmy" ] && ok "repo silniki-tiktok w $SIL" || warn "repo silniki-tiktok nie jest w $SIL" "sklonuj je tam albo ustaw SILNIKI_DIR w .env"

echo
[ $FAIL = 0 ] && echo "WYNIK: wszystko, co wymagane, jest na miejscu." || echo "WYNIK: są braki (BRAK wyżej). Napraw je i uruchom ponownie: bash scripts/doctor.sh"
exit $FAIL
