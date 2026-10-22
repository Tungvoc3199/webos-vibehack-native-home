"""Offline security regression checks. These tests NEVER contact a TV."""
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
MANAGER = (ROOT / "native-home.sh").read_text(encoding="utf-8")
HOOK = (ROOT / "native-home-hook.sh").read_text(encoding="utf-8")
TARGET = "/usr/lib/qml/KeyFilters/systemUi.js"

class SecurityRegressions(unittest.TestCase):
    def test_shell_syntax(self):
        for name in ("native-home.sh", "native-home-hook.sh"):
            p = subprocess.run(["sh", "-n", str(ROOT / name)], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr)

    def test_no_source_untrusted_manifest(self):
        self.assertNotIn('. "$BASE/manifest"', MANAGER)
        self.assertNotIn('. "$CONFIG"', HOOK)
        self.assertIn("invalid manifest lines", MANAGER)
        self.assertIn("valid_app", MANAGER)
        self.assertIn("valid_hash", MANAGER)

    def test_root_permissions_are_checked(self):
        for snippet in ('[ ! -L "$1" ]', 'stat -c %u', 'stat -c %a',
                        'trusted_file "$BASE/manifest" 600',
                        'trusted_file "$BASE/manager.sh" 700',
                        'trusted_file "$BASE/patched-systemUi.js" 644'):
            self.assertIn(snippet, MANAGER)

    def test_rollback_requires_no_init_directory(self):
        body = MANAGER.split("disable|rollback)")[1].split("boot) boot")[0]
        self.assertNotIn("trusted_dir \"$PARENT/init.d\"", body)
        self.assertIn("state_ok", body)

    def test_rollback_never_hot_unmounts_unverifiable_stock(self):
        body = MANAGER.split("disable|rollback)")[1].split("boot) boot")[0]
        self.assertNotIn('umount "$TARGET"', body)
        self.assertIn("controlled", body.lower())

    def test_foreign_hook_not_removed(self):
        body = MANAGER.split("disable|rollback)")[1].split("boot) boot")[0]
        self.assertRegex(body, r'own_hook\s*\|\|\s*stop.*foreign')
        self.assertLess(body.index("own_hook || stop"), body.index('rm "$INIT"'))

    def test_mount_identity_not_path_suffix(self):
        self.assertIn("stat -c '%d:%i'", MANAGER)
        self.assertIn("mount_count", MANAGER)
        self.assertNotIn('*/native-home/patched-systemUi.js)', MANAGER)

    def test_homebrew_failsafe_flag_is_not_a_normal_boot_blocker(self):
        # Homebrew startup sets the failsafe marker before run-parts and
        # clears it *after* init.d hooks; its failsafe branch skips run-parts.
        # A hook-side marker check would therefore skip every normal boot.
        boot = MANAGER.split("boot() {", 1)[1].split("usage() {", 1)[0]
        self.assertNotIn('[ ! -e /var/luna/preferences/webosbrew_failsafe ]', boot)
        self.assertIn('own_hook || stop', boot)

    def test_bounded_boot_retry(self):
        self.assertIn('"$i" -lt 10', MANAGER)
        self.assertIn('sleep 2', MANAGER)
        self.assertIn('launcher unavailable after bounded retry', MANAGER)

    def test_fail_closed_on_failed_unmount(self):
        self.assertIn('umount "$TARGET" || stop "CRITICAL:', MANAGER)
        self.assertIn('unknown mount; cannot safely restore', MANAGER)
        self.assertIn('stock Home not restored', MANAGER)

    def test_transactional_no_backup_overwrite(self):
        self.assertIn('state exists; never overwrite', MANAGER)
        self.assertIn('.native-home-stage-$$', MANAGER)
        self.assertIn('trap ', MANAGER)
        self.assertIn('mv "$STAGE" "$BASE"', MANAGER)
        self.assertIn('concurrent state appeared', MANAGER)

    def test_literal_replacement_distinguishes_regex_wildcards(self):
        raw = "com.webos.app.home and comXwebosYappZhome and com.webos.app.home"
        pattern = r"s/com\.webos\.app\.home/com.gathin.tvhome/g"
        res = subprocess.run(["sed", pattern], input=raw, text=True, capture_output=True)
        self.assertEqual(res.returncode, 0)
        self.assertEqual(res.stdout.count("com.gathin.tvhome"), 2)
        self.assertIn("comXwebosYappZhome", res.stdout)
        self.assertIn("s/com\\.webos\\.app\\.home/", MANAGER)

    def test_mountinfo_counts_stack_and_ignores_other_mounts(self):
        mountinfo = "\n".join([
            f"713 54 179:59 /foo {TARGET} rw - ext4 /dev/mmcblk0p59 rw",
            f"714 713 179:59 /bar {TARGET} rw - ext4 /dev/mmcblk0p59 rw",
            "715 54 179:59 /foo /unrelated/file rw - ext4 /dev/mmcblk0p59 rw",
        ]) + "\n"
        awk = '$5==t{n++} END{print n+0}'
        proc = subprocess.run(["awk", "-v", f"t={TARGET}", awk],
                              input=mountinfo, text=True, capture_output=True)
        self.assertEqual(proc.stdout.strip(), "2")
        self.assertIn('count=$(mount_count)', MANAGER)
        self.assertIn('foreign or stacked Home mount', MANAGER)

    def test_boot_hook_uses_root_owned_manager_without_eval(self):
        self.assertIn('stat -c %u', HOOK)
        self.assertIn('stat -c %a', HOOK)
        self.assertIn('[ ! -L "$MANAGER" ]', HOOK)
        self.assertIn('exec "$MANAGER" boot', HOOK)

    def test_no_actual_tv_addresses_or_owners_keys(self):
        for name in ("native-home.sh", "native-home-hook.sh", "README.md", "SAFETY.md"):
            s = (ROOT / name).read_text(encoding="utf-8")
            self.assertNotIn("192.168.1.", s)
            self.assertNotIn("BEGIN OPENSSH PRIVATE KEY", s)
            self.assertNotIn("sk-proj-", s)

if __name__ == "__main__":
    unittest.main()
