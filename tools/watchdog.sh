#!/usr/bin/env bash
# Watchdog for agent sessions: prints one line per stuck process (each stdout line is an event).
# - A wait loop on `pgrep -f`/`pkill -f` matches its own command line and never ends:
#   it is always a bug, so it is killed right away (KILLED line).
# - Any other `until/while ...; do sleep` wait loop alive for 30 min is killed too.
# - A visual test (run.mjs), sim run or headless browser older than LIMIT seconds is only
#   reported (HUNG? line), because a long sim can be legitimate.
# - Memory guard (every 5 s): when the WSL has less than MIN_FREE_MB available, the biggest test
#   browser (chrome-headless-shell) is killed before the machine runs out of memory and freezes
#   (KILLED low memory line). Test browsers only: the game and the editor are never touched.
# Usage: tools/watchdog.sh [limitSeconds=1200] [pollSeconds=60]
LIMIT=${1:-1200}
POLL=${2:-60}
MIN_FREE_MB=${MIN_FREE_MB:-1000}
seen=" "

# Kills the biggest test browser while available memory is under MIN_FREE_MB.
memguard() {
  local free pid rss
  free=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  [ "$free" -ge "$MIN_FREE_MB" ] && return
  read -r pid rss < <(ps -eo pid=,rss=,args= | grep chrome-headless-shell | grep -v grep | sort -k2 -nr | awk '{print $1, $2}' | head -1)
  [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null &&
    echo "$(date '+%F %T') KILLED low memory (${free} MB free): test browser pid $pid ($((rss / 1024)) MB)"
}

while true; do
  while read -r pid age args; do
    [ "$pid" = "$$" ] && continue
    case "$args" in
      *"until "*pgrep\ -f*|*"while "*pgrep\ -f*)
        if [ "$age" -gt 120 ] && kill "$pid" 2>/dev/null; then
          echo "KILLED self-matching wait loop pid $pid (${age}s): $(grep -o "until[^;]*" <<<"$args" | head -c 120)"
        fi ;;
      *"until "*"do sleep"*|*"while "*"do sleep"*)
        # Any other wait loop alive for 30 min is waiting for something that will not come.
        if [ "$age" -gt 1800 ] && kill "$pid" 2>/dev/null; then
          echo "KILLED stale wait loop pid $pid (${age}s): $(grep -o "until[^;]*\|while[^;]*" <<<"$args" | head -c 120)"
        fi ;;
      *run.mjs*|*tools/sim*|*cache/sim*|*chrome-headless-shell\ --disable*)
        if [ "$age" -gt "$LIMIT" ] && [[ "$seen" != *" $pid "* ]]; then
          seen="$seen$pid "
          echo "HUNG? pid $pid running ${age}s: ${args:0:140}"
        fi ;;
    esac
  done < <(ps -eo pid=,etimes=,args= | grep -v -e watchdog.sh -e "ps -eo")
  for ((t = 0; t < POLL; t += 5)); do
    memguard
    sleep 5
  done
done
