#!/usr/bin/env bash
# SessionStart hook: make sure one watchdog runs for this repo, logging to logs/watchdog.log.
# Uses a pid file (never `pgrep -f`, which matches itself).
cd "$(dirname "$0")/../.." || exit 0
mkdir -p logs
pidf=logs/watchdog.pid
if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then exit 0; fi
nohup tools/watchdog.sh 1200 60 >> logs/watchdog.log 2>&1 &
echo $! > "$pidf"
exit 0
