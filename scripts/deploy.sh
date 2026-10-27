#!/usr/bin/env bash
# deploy.sh: ship TikTok Studio Cloud to the Soft Synergy VPS.
# Usage (from the project root):  bash scripts/deploy.sh
# Needs the soft-synergy-server skill helpers (they answer the SSH key passphrase).
# The server keeps its own .env and data/; neither is ever uploaded or overwritten.
set -euo pipefail

SSH=~/.claude/skills/soft-synergy-server/ssh.exp
APP_DIR=/home/admin/tiktok-studio-cloud
NODE_BIN=/home/admin/node22/bin/node
ARCHIVE=$(mktemp -t tsc-XXXX).tgz

tar --exclude node_modules --exclude data --exclude logs --exclude .env --exclude .git -czf "$ARCHIVE" .
$SSH "mkdir -p $APP_DIR/data $APP_DIR/logs && cat > /tmp/tsc.tgz" < "$ARCHIVE"
$SSH "cd $APP_DIR && tar -xzf /tmp/tsc.tgz && rm /tmp/tsc.tgz \
  && { test -f .env || { echo 'Brak .env na serwerze: skopiuj .env.example do .env i uzupełnij'; exit 1; }; } \
  && PATH=$(dirname $NODE_BIN):\$PATH npm ci --omit=dev --no-audit --no-fund \
  && NODE_BIN=$NODE_BIN pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save"
rm -f "$ARCHIVE"
echo "Gotowe. Sprawdź: curl -s https://studio.soft-synergy.com/api/health"
