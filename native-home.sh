#!/bin/sh
# Native Home for rooted LG webOS; never flashes or rewrites firmware.
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
PARENT=/var/lib/webosbrew
BASE=$PARENT/native-home
INIT=$PARENT/init.d/90-native-home
TARGET=/usr/lib/qml/KeyFilters/systemUi.js
STOCK_ID=com.webos.app.home
LOCK=$PARENT/.native-home-lock
LOCK_HELD=0
STAGE=
say() { printf 'native-home: %s\n' "$*" >&2; }
stop() { say "STOP: $*"; exit 1; }
hash() { sha256sum "$1" | awk '{print $1}'; }
root() { [ "$(id -u)" = 0 ] || stop "root required"; }
valid_hash() {
  case "$1" in ""|*[!0123456789abcdef]*) return 1;; esac
  [ "$(printf %s "$1" | wc -c | tr -d ' ')" = 64 ]
}
valid_app() {
  case "$1" in ""|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-]*) return 1;; esac
}
trusted_dir() {
  [ -d "$1" ] && [ ! -L "$1" ] &&
  [ "$(stat -c %u "$1")" = 0 ] &&
  case "$(stat -c %a "$1")" in 700|750|755) true;; *) false;; esac
}
trusted_file() {
  [ -f "$1" ] && [ ! -L "$1" ] &&
  [ "$(stat -c %u "$1")" = 0 ] &&
  [ "$(stat -c %a "$1")" = "$2" ]
}
parent_ok() { trusted_dir "$PARENT" || stop "untrusted Homebrew directory"; }
cleanup() {
  if [ -n "$STAGE" ] && [ -d "$STAGE" ]; then rm -rf "$STAGE"; fi
  if [ "$LOCK_HELD" = 1 ]; then
    rmdir "$LOCK" || say "ERROR: could not release lock"
  fi
}
acquire_lock() {
  parent_ok
  (umask 077; mkdir "$LOCK") 2>/dev/null ||
    stop "another native-home operation is running or a stale lock needs inspection"
  LOCK_HELD=1
  trap 'cleanup' 0
  trap 'exit 2' 1 2 3 15
  trusted_dir "$LOCK" && [ "$(stat -c %a "$LOCK")" = 700 ] ||
    stop "untrusted lock"
}
trusted_source_file() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(stat -c %u "$1")" = 0 ] &&
  case "$(stat -c %a "$1")" in 600|644|700|755) true;; *) false;; esac
}
source_tree_ok() {
  # The entire source path must be root-owned and not writable by others.
  SOURCE_DIR=$(CDPATH= cd -P "$(dirname "$0")" && pwd -P) ||
    stop "cannot canonicalize source directory"
  CURRENT=$SOURCE_DIR
  while :; do
    trusted_dir "$CURRENT" || stop "untrusted source directory: $CURRENT"
    [ "$CURRENT" = / ] && break
    CURRENT=$(dirname "$CURRENT")
  done
  SELF=$SOURCE_DIR/$(basename "$0")
  HOOK_SOURCE=$SOURCE_DIR/native-home-hook.sh
  trusted_source_file "$SELF" || stop "untrusted manager source"
  trusted_source_file "$HOOK_SOURCE" || stop "untrusted hook source"
}
state_ok() {
  trusted_dir "$BASE" && [ "$(stat -c %a "$BASE")" = 700 ] || stop "untrusted state directory"
  trusted_file "$BASE/manifest" 600 || stop "untrusted manifest"
  trusted_file "$BASE/original-systemUi.js" 600 || stop "untrusted stock backup"
  trusted_file "$BASE/patched-systemUi.js" 644 || stop "untrusted patch"
  trusted_file "$BASE/manager.sh" 700 || stop "untrusted manager"
  trusted_file "$BASE/boot-hook.sh" 700 || stop "untrusted hook source"
  [ ! -L "$BASE/disabled" ] || stop "disabled flag symlink"
  if [ -e "$BASE/disabled" ]; then
    trusted_file "$BASE/disabled" 600 || stop "untrusted disabled flag"
  fi
  # A strict fixed-order manifest, never dot-sourced under root.
  [ "$(wc -l < "$BASE/manifest" | tr -d ' ')" = 3 ] || stop "invalid manifest lines"
  APP_ID=$(sed -n '1s/^APP_ID=//p' "$BASE/manifest")
  STOCK_SHA=$(sed -n '2s/^STOCK_SHA=//p' "$BASE/manifest")
  PATCH_SHA=$(sed -n '3s/^PATCH_SHA=//p' "$BASE/manifest")
  valid_app "$APP_ID" || stop "invalid APP_ID"
  valid_hash "$STOCK_SHA" || stop "invalid STOCK_SHA"
  valid_hash "$PATCH_SHA" || stop "invalid PATCH_SHA"
  [ "$STOCK_SHA" != "$PATCH_SHA" ] || stop "no patched change"
  [ "$(hash "$BASE/original-systemUi.js")" = "$STOCK_SHA" ] || stop "stock backup tampered"
  [ "$(hash "$BASE/patched-systemUi.js")" = "$PATCH_SHA" ] || stop "patch tampered"
}
mount_count() { awk -v t="$TARGET" '$5==t{n++} END{print n+0}' /proc/self/mountinfo; }
own_mount() {
  [ "$(mount_count)" = 1 ] &&
  [ "$(stat -c '%d:%i' "$TARGET")" = "$(stat -c '%d:%i' "$BASE/patched-systemUi.js")" ] &&
  [ "$(hash "$TARGET")" = "$PATCH_SHA" ]
}
own_hook() {
  trusted_file "$INIT" 700 &&
  [ "$(hash "$INIT")" = "$(hash "$BASE/boot-hook.sh")" ]
}
boot() {
  root; acquire_lock; state_ok
  [ ! -e "$BASE/disabled" ] || { say "disabled"; return 0; }
  [ ! -e /var/luna/preferences/webosbrew_failsafe ] || { say "failsafe"; return 0; }
  own_hook || stop "boot hook replaced"
  APP=/media/developer/apps/usr/palm/applications/$APP_ID/appinfo.json
  i=0
  while [ ! -f "$APP" ] && [ "$i" -lt 10 ]; do
    sleep 2
    i=$((i + 1))
  done
  [ -f "$APP" ] || stop "launcher unavailable after bounded retry"
  [ -f "$TARGET" ] && [ ! -L "$TARGET" ] || stop "invalid stock target"
  count=$(mount_count)
  if [ "$count" != 0 ]; then
    own_mount && { say "own mapping already active"; return 0; }
    stop "foreign or stacked Home mount"
  fi
  [ "$(hash "$TARGET")" = "$STOCK_SHA" ] || stop "stock Home differs"
  mount --bind "$BASE/patched-systemUi.js" "$TARGET" || stop "bind mount failed"
  if own_mount; then say "Home mapping active"; return 0; fi
  say "post-mount verification failed"
  if [ "$(mount_count)" = 1 ] &&
     [ "$(stat -c '%d:%i' "$TARGET")" = "$(stat -c '%d:%i' "$BASE/patched-systemUi.js")" ]; then
    umount "$TARGET" || stop "CRITICAL: restore umount failed"
  else
    stop "CRITICAL: unknown mount; cannot safely restore"
  fi
  [ "$(mount_count)" = 0 ] && [ "$(hash "$TARGET")" = "$STOCK_SHA" ] ||
    stop "CRITICAL: stock Home not restored"
  stop "invalid mapping (stock restored)"
}
usage() {
  say "Usage: $0 status | prepare STOCK_FILE SHA256 APP_ID | enable | disable | rollback | boot"
  exit 2
}
cmd=${1-}
case "$cmd" in
  status)
    if [ -e "$BASE" ] || [ -L "$BASE" ]; then
      root; parent_ok; state_ok
      printf 'app=%s\nstock=%s\npatch=%s\n' "$APP_ID" "$STOCK_SHA" "$PATCH_SHA"
    else echo unconfigured; fi
    printf 'hook=%s\nmount_count=%s\n' "$([ -f "$INIT" ] && echo present || echo absent)" "$(mount_count)"
    ;;
  prepare)
    root; acquire_lock
    [ "$#" = 4 ] || usage
    STOCK=$2; EXPECTED=$3; APP_ID=$4
    valid_hash "$EXPECTED" && valid_app "$APP_ID" || stop "bad digest or app ID"
    [ ! -e "$BASE" ] && [ ! -L "$BASE" ] || stop "state exists; never overwrite"
    [ -f "$STOCK" ] && [ ! -L "$STOCK" ] || stop "stock backup invalid"
    [ "$(hash "$STOCK")" = "$EXPECTED" ] || stop "original SHA mismatch"
    grep -Fq "$STOCK_ID" "$STOCK" || stop "stock Home ID absent"
    [ -f "/media/developer/apps/usr/palm/applications/$APP_ID/appinfo.json" ] ||
      stop "launcher not installed"
    if [ "$(mount_count)" != 0 ]; then
      say "WARNING: active Home overlay; original file MUST be independently verified"
    fi
    source_tree_ok
    STAGE=$PARENT/.native-home-stage-$$
    (umask 077; mkdir "$STAGE") || stop "cannot create unique staging directory"
    cp "$STOCK" "$STAGE/original-systemUi.js"
    [ "$(hash "$STAGE/original-systemUi.js")" = "$EXPECTED" ] ||
      stop "stock changed during copy"
    sed 's/com\.webos\.app\.home/'"$APP_ID"'/g' \
      "$STAGE/original-systemUi.js" > "$STAGE/patched-systemUi.js"
    PATCH_SHA=$(hash "$STAGE/patched-systemUi.js")
    [ "$PATCH_SHA" != "$EXPECTED" ] || stop "no substitutions"
    grep -Fq "$APP_ID" "$STAGE/patched-systemUi.js" || stop "missing patched ID"
    cp "$SELF" "$STAGE/manager.sh"
    cp "$HOOK_SOURCE" "$STAGE/boot-hook.sh"
    [ "$(hash "$SELF")" = "$(hash "$STAGE/manager.sh")" ] ||
      stop "manager changed during copy"
    [ "$(hash "$HOOK_SOURCE")" = "$(hash "$STAGE/boot-hook.sh")" ] ||
      stop "hook changed during copy"
    printf 'APP_ID=%s\nSTOCK_SHA=%s\nPATCH_SHA=%s\n' \
      "$APP_ID" "$EXPECTED" "$PATCH_SHA" > "$STAGE/manifest"
    : > "$STAGE/disabled"
    chown 0:0 "$STAGE" "$STAGE"/*
    chmod 700 "$STAGE" "$STAGE/manager.sh" "$STAGE/boot-hook.sh"
    chmod 600 "$STAGE/original-systemUi.js" "$STAGE/manifest" "$STAGE/disabled"
    chmod 644 "$STAGE/patched-systemUi.js"
    [ ! -e "$BASE" ] && [ ! -L "$BASE" ] || stop "concurrent state appeared"
    mv "$STAGE" "$BASE" || stop "atomic activation failed"
    STAGE=
    state_ok
    say "PREPARED DISABLED; no reboot or mount"
    ;;
  enable)
    root; acquire_lock; state_ok
    [ "$#" = 1 ] || usage
    trusted_dir "$PARENT/init.d" || stop "untrusted Homebrew init.d"
    [ ! -e "$INIT" ] && [ ! -L "$INIT" ] || stop "hook occupied"
    [ -e "$BASE/disabled" ] || stop "already enabled"
    cp "$BASE/boot-hook.sh" "$INIT"
    chown 0:0 "$INIT"; chmod 700 "$INIT"
    own_hook || stop "installed hook differs"
    rm "$BASE/disabled"
    say "ENABLED for next boot only; did not reboot"
    ;;
  disable|rollback)
    root; acquire_lock; state_ok
    [ "$#" = 1 ] || usage
    if [ ! -e "$BASE/disabled" ]; then
      : > "$BASE/disabled"; chown 0:0 "$BASE/disabled"; chmod 600 "$BASE/disabled"
    fi
    if [ -e "$INIT" ] || [ -L "$INIT" ]; then
      own_hook || stop "foreign/modified hook left untouched"
      rm "$INIT"
    fi
    # Never hot-unmount without proving the hidden stock file is still valid.
    say "DISABLED; live mount unchanged. Controlled reboot after verified SSH recovery."
    ;;
  boot) boot ;;
  *) usage ;;
esac
