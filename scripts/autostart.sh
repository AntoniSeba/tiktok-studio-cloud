#!/usr/bin/env bash
# autostart.sh: runs TikTok Studio Cloud as a service that starts with the computer and comes back after every crash.
#   macOS: a launchd agent (~/Library/LaunchAgents/com.softsynergy.tiktok-studio-cloud.plist)
#   Linux: a systemd user service (~/.config/systemd/user/tiktok-studio-cloud.service)
# usage (from the repo folder): bash scripts/autostart.sh        again after moving the folder or changing Python
# Keys stay in .env (the server reads it itself); nothing secret goes into the service file.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
NODE="$(command -v node)"
mkdir -p logs
# the python3 the generator will call: the first one in PATH that has numpy and Pillow
PYDIR=""
APPLE=0; [ "$(uname -s)" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ] && APPLE=1
for p in $(which -a python3 2>/dev/null | awk '!seen[$0]++'); do
  if { [ $APPLE = 1 ] && arch -arm64 "$p" -c 'import numpy, PIL' 2>/dev/null; } || { [ $APPLE = 0 ] && "$p" -c 'import numpy, PIL' 2>/dev/null; }; then PYDIR="$(dirname "$p")"; break; fi
done
[ -z "$PYDIR" ] && { echo "Żaden python3 nie ma numpy i Pillow. Najpierw: python3 -m pip install --user numpy Pillow, potem uruchom ten skrypt jeszcze raz."; exit 1; }
SVC_PATH="$PYDIR:$(dirname "$NODE"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if [ "$(uname -s)" = "Darwin" ]; then
  LABEL=com.softsynergy.tiktok-studio-cloud
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  ARCHARGS=""; [ $APPLE = 1 ] && ARCHARGS="    <string>/usr/bin/arch</string>
    <string>-arm64</string>
"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
$ARCHARGS    <string>$NODE</string>
    <string>src/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$SVC_PATH</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$ROOT/logs/local-out.log</string>
  <key>StandardErrorPath</key><string>$ROOT/logs/local-err.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "Usługa macOS: $PLIST"
  echo "Restart: launchctl kickstart -k gui/$(id -u)/$LABEL   Stop: launchctl bootout gui/$(id -u)/$LABEL"
else
  UNIT="$HOME/.config/systemd/user/tiktok-studio-cloud.service"
  mkdir -p "$(dirname "$UNIT")"
  cat > "$UNIT" <<EOF
[Unit]
Description=TikTok Studio Cloud
After=network-online.target

[Service]
WorkingDirectory=$ROOT
ExecStart=$NODE src/server.js
Environment=PATH=$SVC_PATH
Restart=always
RestartSec=10
StandardOutput=append:$ROOT/logs/local-out.log
StandardError=append:$ROOT/logs/local-err.log

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now tiktok-studio-cloud
  loginctl enable-linger "$USER" 2>/dev/null || echo "(żeby działało bez zalogowania: sudo loginctl enable-linger $USER)"
  echo "Usługa Linux: $UNIT"
  echo "Restart: systemctl --user restart tiktok-studio-cloud   Stop: systemctl --user stop tiktok-studio-cloud"
fi
sleep 6
PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2)"; PORT="${PORT:-4318}"
if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" | grep -q 200; then echo "DZIAŁA: http://localhost:$PORT"; else echo "Serwer jeszcze nie odpowiada. Zobacz: tail -n 30 \"$ROOT/logs/local-err.log\""; fi
tail -n 3 logs/local-out.log 2>/dev/null || true
