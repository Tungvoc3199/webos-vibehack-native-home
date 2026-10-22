#!/bin/sh
# webos-vibehack native Home: boot-time, reversible bind mount (rooted TV only)
set -u
BASE=/var/lib/webosbrew/native-home
TARGET=/usr/lib/qml/KeyFilters/systemUi.js
CONFIG="$BASE/config"
log() { echo "native-home: $*" >&2; }
[ "$(id -u 2>/dev/null)" = "0" ] || { log "not root; skip"; exit 0; }
[ -f "$CONFIG" ] || { log "not configured"; exit 0; }
[ ! -f "$BASE/disabled" ] || { log "disabled"; exit 0; }
[ ! -e /var/luna/preferences/webosbrew_failsafe ] || { log "failsafe active; skip"; exit 0; }
. "$CONFIG"
case "$APP_ID" in ""|*[!a-zA-Z0-9._-]*) log "invalid app id"; exit 0;; esac
case "$STOCK_SHA:$PATCH_SHA" in
  *[!a-f0-9:]*|"") log "invalid digest"; exit 0;;
esac
[ "${#STOCK_SHA}" -eq 64 ] && [ "${#PATCH_SHA}" -eq 64 ] || { log "bad digests"; exit 0; }
SOURCE="$BASE/patched-systemUi.js"
APP="/media/developer/apps/usr/palm/applications/$APP_ID/appinfo.json"
[ -r "$SOURCE" ] && [ -r "$TARGET" ] && [ -f "$APP" ] || { log "file or app missing"; exit 0; }
hash() { sha256sum "$1" | cut -d ' ' -f1; }
[ "$(hash "$SOURCE")" = "$PATCH_SHA" ] || { log "patched source differs; skip"; exit 0; }
if awk -v tgt="$TARGET" '$5==tgt{seen=1} END{exit !seen}' /proc/self/mountinfo; then
  log "target already mounted; leave unchanged"
  exit 0
fi
[ "$(hash "$TARGET")" = "$STOCK_SHA" ] || { log "stock differs; skip"; exit 0; }
if mount --bind "$SOURCE" "$TARGET"; then
  if [ "$(hash "$TARGET")" = "$PATCH_SHA" ]; then
    log "Home mapping active"
  else
    log "verification failed; restoring mount"
    umount "$TARGET" || true
  fi
else
  log "bind mount failed; stock Home retained"
fi
exit 0
