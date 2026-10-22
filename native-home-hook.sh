#!/bin/sh
# Minimal trusted Homebrew boot entrypoint. Does not read or source config.
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
BASE=/var/lib/webosbrew/native-home
OWNER=$(stat -c %u "$BASE" 2>/dev/null) || exit 1
MODE=$(stat -c %a "$BASE" 2>/dev/null) || exit 1
[ "$OWNER" = 0 ] && [ "$MODE" = 700 ] &&
  [ -d "$BASE" ] && [ ! -L "$BASE" ] || exit 1
MANAGER=$BASE/manager.sh
[ -f "$MANAGER" ] && [ ! -L "$MANAGER" ] &&
  [ "$(stat -c %u "$MANAGER")" = 0 ] &&
  [ "$(stat -c %a "$MANAGER")" = 700 ] || exit 1
exec "$MANAGER" boot
