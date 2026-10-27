#!/bin/bash
# 新建 collage-info HyperFrames 项目：new_project.sh <项目名>
# 项目落在 ${HYPERFRAMES_PROJECTS_DIR:-~/hyperframes-projects}/<项目名>/，assets 从 skill 拷入（项目自包含）
set -euo pipefail

NAME="${1:?用法: new_project.sh <项目名，如 2026-08-01-collage-info-主题>}"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="${HYPERFRAMES_PROJECTS_DIR:-$HOME/hyperframes-projects}/$NAME"

if [ -e "$PROJ" ]; then echo "已存在: $PROJ" >&2; exit 1; fi

mkdir -p "$PROJ"/{assets,style-plates,compositions,renders,qa}
cp "$SKILL_DIR/assets/collage.css" "$SKILL_DIR/assets/gsap.min.js" "$PROJ/assets/"
cp -r "$SKILL_DIR/assets/sfx" "$PROJ/assets/sfx"

cat > "$PROJ/hyperframes.json" <<'EOF'
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": {
    "blocks": "compositions",
    "components": "compositions/components",
    "assets": "assets"
  }
}
EOF

cat > "$PROJ/package.json" <<EOF
{
  "name": "$(echo "$NAME" | tr -cd 'a-zA-Z0-9-' | tr '[:upper:]' '[:lower:]')",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "npx --yes hyperframes@0.7.56 preview",
    "lint": "npx --yes hyperframes@0.7.56 lint",
    "render": "npx --yes hyperframes@0.7.56 render"
  }
}
EOF

cat > "$PROJ/meta.json" <<EOF
{
  "id": "$NAME",
  "name": "$NAME",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF

echo "$PROJ"
