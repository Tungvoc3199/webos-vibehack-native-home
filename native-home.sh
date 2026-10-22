#!/bin/sh
# Provision a reversible Home-key redirect on a ROOTED LG webOS TV.
# Requires a verified stock systemUi.js backup copied onto the TV.
set -eu
BASE=/var/lib/webosbrew/native-home
TARGET=/usr/lib/qml/KeyFilters/systemUi.js
INIT=/var/lib/webosbrew/init.d/90-native-home
STOCK_ID=com.webos.app.home
usage() {
  echo "Usage: $0 status | prepare STOCK_FILE STOCK_SHA256 APP_ID | enable HOOK_FILE | disable | rollback" >&2
  exit 2
}
die(){ echo "STOP: $*" >&2; exit 1; }
hash(){ sha256sum "$1" | cut -d ' ' -f1; }
mounted_root(){
  awk -v tgt="$TARGET" '$5==tgt{print $4}' /proc/self/mountinfo | tail -n 1
}
check_root() {
  [ "$(id -u)" = 0 ] || die "requires root (use Homebrew service securely)"
  [ -d /var/lib/webosbrew/init.d ] || die "Homebrew root init.d absent"
}
valid_digest(){
  case "$1" in *[!a-f0-9]*|"") return 1;; esac
  [ "${#1}" = 64 ]
}
cmd="${1:-}"
case "$cmd" in
  status)
    echo "App root: $BASE"
    if [ -f "$BASE/config" ]; then
      # Config is root-owned and is created by prepare only.
      . "$BASE/config"
      echo "Configured app: $APP_ID"
      echo "Patched source: $([ -f "$BASE/patched-systemUi.js" ] && echo present || echo absent)"
    else echo "Unconfigured"; fi
    echo "Boot hook: $([ -f "$INIT" ] && echo installed || echo absent)"
    echo "Disabled: $([ -f "$BASE/disabled" ] && echo yes || echo no)"
    echo "Mount root: $(mounted_root)"
    ;;
  prepare)
    check_root
    [ "$#" = 4 ] || usage
    STOCK="$2"; EXPECTED="$3"; APP_ID="$4"
    valid_digest "$EXPECTED" || die "invalid expected SHA-256"
    case "$APP_ID" in ""|*[!a-zA-Z0-9._-]*) die "invalid app ID";; esac
    [ -r "$STOCK" ] || die "stock backup missing"
    [ "$(hash "$STOCK")" = "$EXPECTED" ] || die "stock backup SHA-256 mismatch"
    grep -q "$STOCK_ID" "$STOCK" || die "stock Home app ID missing"
    [ -f "/media/developer/apps/usr/palm/applications/$APP_ID/appinfo.json" ] || die "target app missing"
    [ -z "$(mounted_root)" ] || echo "NOTICE: current Home is already bind-mounted; supplied STOCK file must be independently verified" >&2
    if [ -e "$BASE/config" ]; then die "existing config; use disable and inspect before replacing"; fi
    umask 077
    mkdir -p "$BASE"
    chmod 700 "$BASE"
    cp "$STOCK" "$BASE/original-systemUi.js"
    [ "$(hash "$BASE/original-systemUi.js")" = "$EXPECTED" ] || die "copy failed"
    sed "s|$STOCK_ID|$APP_ID|g" "$BASE/original-systemUi.js" > "$BASE/patched-systemUi.js"
    PATCH_SHA="$(hash "$BASE/patched-systemUi.js")"
    [ "$PATCH_SHA" != "$EXPECTED" ] || die "no mappings replaced"
    grep -q "$APP_ID" "$BASE/patched-systemUi.js" || die "patch missing target app"
    printf "APP_ID='%s'\nSTOCK_SHA='%s'\nPATCH_SHA='%s'\n" "$APP_ID" "$EXPECTED" "$PATCH_SHA" > "$BASE/config"
    chown root:root "$BASE" "$BASE"/*
    chmod 600 "$BASE/config" "$BASE/original-systemUi.js"
    chmod 644 "$BASE/patched-systemUi.js"
    touch "$BASE/disabled"
    chmod 600 "$BASE/disabled"
    echo "PREPARED (disabled). Original $EXPECTED | patched $PATCH_SHA"
    ;;
  enable)
    check_root
    [ "$#" = 2 ] || usage
    HOOK="$2"
    [ -r "$HOOK" ] || die "hook file missing"
    [ -f "$BASE/config" ] || die "first run prepare"
    [ ! -L "$INIT" ] || die "init hook path is a symlink"
    [ ! -e "$INIT" ] || die "an init hook already exists; inspect first"
    cp "$HOOK" "$INIT"
    chown root:root "$INIT"
    chmod 700 "$INIT"
    rm -f "$BASE/disabled"
    echo "ENABLED for next boot. No reboot performed."
    ;;
  disable|rollback)
    check_root
    [ -d "$BASE" ] || die "not configured"
    touch "$BASE/disabled"
    rm -f "$INIT"
    if [ "$cmd" = rollback ]; then
      # Don't unmount another person's mapping.
      root="$(mounted_root)"
      case "$root" in
        */native-home/patched-systemUi.js)
          umount "$TARGET" || die "unmount failed"
          . "$BASE/config"
          [ "$(hash "$TARGET")" = "$STOCK_SHA" ] || die "stock hash mismatch after unmount"
          echo "RESTORED stock Home in live session" ;;
        "") echo "No active override mounted" ;;
        *) die "other mapping active ($root). Not unmounting it." ;;
      esac
    fi
    echo "DISABLED: boot hook removed, backups retained; no reboot."
    ;;
  *) usage;;
esac
