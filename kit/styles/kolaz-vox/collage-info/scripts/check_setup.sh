#!/bin/bash
# 首次使用自检：check_setup.sh
# 检查渲染全链路依赖：Node >= 22、Chrome（headless 截样帧）、ffmpeg/ffprobe
set -uo pipefail

PASS=0; FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "gbro-collage-info 环境自检"
echo

# 1. Node >= 22
if command -v node >/dev/null 2>&1; then
  MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
  if [ "$MAJOR" -ge 22 ]; then
    ok "node $(node -v)（>= 22）"
  else
    bad "node $(node -v) 版本过低，hyperframes 需要 >= 22。若装有新版 node，把其目录前置到 PATH（如 PATH=/usr/local/bin:\$PATH）"
  fi
else
  bad "未找到 node，请安装 Node.js >= 22"
fi

# 2. Chrome / Chromium（headless 样帧截图）
CHROME=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v google-chrome 2>/dev/null)" \
  "$(command -v chromium 2>/dev/null)" \
  "$(command -v chromium-browser 2>/dev/null)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
done
if [ -n "$CHROME" ]; then
  ok "Chrome/Chromium: $CHROME"
else
  bad "未找到 Chrome/Chromium（Gate 2 样帧截图需要）"
fi

# 3. ffmpeg / ffprobe
command -v ffmpeg  >/dev/null 2>&1 && ok "ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')" || bad "未找到 ffmpeg"
command -v ffprobe >/dev/null 2>&1 && ok "ffprobe" || bad "未找到 ffprobe"

# 4. skill 自带资产完整性
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SKILL_DIR/assets/collage.css" ]  && ok "assets/collage.css" || bad "缺 assets/collage.css"
[ -f "$SKILL_DIR/assets/gsap.min.js" ]  && ok "assets/gsap.min.js" || bad "缺 assets/gsap.min.js"
SFX_N=$(ls "$SKILL_DIR/assets/sfx/"*.mp3 2>/dev/null | wc -l | tr -d ' ')
[ "$SFX_N" -ge 10 ] && ok "assets/sfx/（$SFX_N 个音效）" || bad "assets/sfx/ 音效不全（$SFX_N/10）"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过（$PASS 项）。渲染器 hyperframes@0.7.56 会在首次 npx 时自动下载，无需预装。"
else
  echo "$FAIL 项未通过，请先补齐再使用。"
  exit 1
fi
