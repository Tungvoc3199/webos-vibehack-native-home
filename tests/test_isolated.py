"""Run manager in a private fake-root filesystem; NEVER touch a real TV."""
import hashlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parent.parent
REAL = (REPO / "native-home.sh").read_text()
HOOK = (REPO / "native-home-hook.sh").read_text()

class IsolatedManagerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path.home())
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.parent = self.base / "homebrew"
        self.parent.mkdir(mode=0o755)
        self.init = self.parent / "init.d"
        self.init.mkdir(mode=0o755)
        self.app = self.base / "apps" / "com.gathin.tvhome"
        self.app.mkdir(parents=True)
        (self.app / "appinfo.json").write_text('{"id":"com.gathin.tvhome"}')
        self.target = self.base / "KeyFilters" / "systemUi.js"
        self.target.parent.mkdir()
        self.stock = self.base / "stock.js"
        self.stock.write_text('var HOME_APP_ID = "com.webos.app.home";\n'
                              'var irrelevant = "comXwebosYappZhome";\n')
        self.stock_hash = hashlib.sha256(self.stock.read_bytes()).hexdigest()
        self.target.write_bytes(self.stock.read_bytes())
        # Only this disposable test copy bypasses owner/root verification;
        # production files are never patched. No mount or real root is used.
        fixture = REAL.replace("PARENT=/var/lib/webosbrew", f"PARENT={self.parent}")
        fixture = fixture.replace("TARGET=/usr/lib/qml/KeyFilters/systemUi.js",
                                  f"TARGET={self.target}")
        fixture = fixture.replace(
            "/media/developer/apps/usr/palm/applications/$APP_ID/appinfo.json",
            str(self.base / "apps") + "/$APP_ID/appinfo.json"
        )
        fixture = fixture.replace(
            'root() { [ "$(id -u)" = 0 ] || stop "root required"; }',
            'root() { :; }'
        )
        fixture = fixture.replace("stat -c %u", "printf 0")
        fixture = fixture.replace("chown 0:0", ":")
        # This simulated environment has non-root-owned ancestors; bypass
        # only the ancestor owner test, not source-file checks or production.
        fixture = fixture.replace(
            '    trusted_dir "$CURRENT" || stop "untrusted source directory: $CURRENT"',
            '    : # test fixture has non-root home ancestors'
        )
        self.bin = self.base / "bin"
        self.bin.mkdir()
        self.manager = self.bin / "native-home.sh"
        self.manager.write_text(fixture)
        self.hook = self.bin / "native-home-hook.sh"
        self.hook.write_text(HOOK)

    def runmanager(self, *args):
        return subprocess.run(["sh", str(self.manager), *args],
                              text=True, capture_output=True)

    def prepare(self):
        return self.runmanager("prepare", str(self.stock),
                               self.stock_hash, "com.gathin.tvhome")

    def test_prepare_enable_disable_rollback(self):
        p = self.prepare()
        self.assertEqual(p.returncode, 0, p.stderr)
        state = self.parent / "native-home"
        self.assertEqual((state / "original-systemUi.js").read_bytes(),
                         self.stock.read_bytes())
        patched = (state / "patched-systemUi.js").read_text()
        self.assertIn("com.gathin.tvhome", patched)
        self.assertIn("comXwebosYappZhome", patched)
        self.assertTrue((state / "disabled").exists())
        self.assertEqual(self.runmanager("enable").returncode, 0)
        self.assertTrue((self.init / "90-native-home").exists())
        self.assertFalse((state / "disabled").exists())
        d = self.runmanager("rollback")
        self.assertEqual(d.returncode, 0, d.stderr)
        self.assertFalse((self.init / "90-native-home").exists())
        self.assertTrue((state / "disabled").exists())
        self.assertEqual(self.target.read_bytes(), self.stock.read_bytes())

    def test_second_prepare_never_overwrites_backup(self):
        self.assertEqual(self.prepare().returncode, 0)
        original = (self.parent / "native-home" / "original-systemUi.js").read_bytes()
        again = self.prepare()
        self.assertNotEqual(again.returncode, 0)
        self.assertEqual((self.parent / "native-home" / "original-systemUi.js").read_bytes(), original)

    def test_existing_symlink_state_is_not_followed(self):
        external = self.base / "valuable"
        external.mkdir()
        (external / "keep").write_text("safe")
        (self.parent / "native-home").symlink_to(external)
        r = self.prepare()
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((external / "keep").read_text(), "safe")

    def test_foreign_hook_is_not_deleted(self):
        self.assertEqual(self.prepare().returncode, 0)
        self.assertEqual(self.runmanager("enable").returncode, 0)
        hook = self.init / "90-native-home"
        hook.write_text("#!/bin/sh\nexit 79\n")
        r = self.runmanager("disable")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("foreign/modified hook", r.stderr)
        self.assertTrue(hook.exists())
        self.assertTrue((self.parent / "native-home" / "disabled").exists())

    def test_tampered_manifest_is_rejected_without_execution(self):
        self.assertEqual(self.prepare().returncode, 0)
        manifest = self.parent / "native-home" / "manifest"
        bad = self.base / "should-not-exist"
        manifest.write_text(f'APP_ID=$(touch {bad})\n'
                            f'STOCK_SHA={self.stock_hash}\n'
                            f'PATCH_SHA={"0" * 64}\n')
        r = self.runmanager("enable")
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse(bad.exists())

    def test_rollback_does_not_require_init_directory(self):
        self.assertEqual(self.prepare().returncode, 0)
        self.init.rmdir()
        r = self.runmanager("rollback")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue((self.parent / "native-home" / "disabled").exists())

    def test_two_parallel_prepare_attempts_single_winner(self):
        with ThreadPoolExecutor(max_workers=2) as workers:
            futures = [workers.submit(self.prepare) for _ in range(2)]
            results = [f.result() for f in futures]
        self.assertEqual(sum(r.returncode == 0 for r in results), 1,
                         [r.stderr for r in results])
        state = self.parent / "native-home"
        self.assertTrue((state / "manifest").exists())
        self.assertFalse(list(self.parent.glob(".native-home-stage-*")))
        self.assertFalse((self.parent / ".native-home-lock").exists())

    def test_disable_and_boot_share_atomic_lock(self):
        self.assertEqual(self.prepare().returncode, 0)
        self.assertEqual(self.runmanager("enable").returncode, 0)
        lock = self.parent / ".native-home-lock"
        lock.mkdir(mode=0o700)
        try:
            boot = self.runmanager("boot")
            disable = self.runmanager("disable")
            self.assertNotEqual(boot.returncode, 0)
            self.assertNotEqual(disable.returncode, 0)
            self.assertEqual(self.target.read_bytes(), self.stock.read_bytes())
        finally:
            lock.rmdir()
        self.assertEqual(self.runmanager("disable").returncode, 0)
        self.assertEqual(self.runmanager("boot").returncode, 0)
        self.assertEqual(self.target.read_bytes(), self.stock.read_bytes())

    def test_true_disable_wins_boot_race(self):
        self.assertEqual(self.prepare().returncode, 0)
        self.assertEqual(self.runmanager("enable").returncode, 0)
        # This disposable fixture holds the same real atomic lock during
        # disable; launch boot while disable owns it, not sequentially.
        text = self.manager.read_text()
        text = text.replace(
            '  disable|rollback)\n    root; acquire_lock; state_ok',
            '  disable|rollback)\n    root; acquire_lock; sleep 1; state_ok'
        )
        self.manager.write_text(text)
        process = subprocess.Popen(
            ["sh", str(self.manager), "disable"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        lock = self.parent / ".native-home-lock"
        import time
        for _ in range(100):
            if lock.exists():
                break
            if process.poll() is not None:
                break
            time.sleep(.01)
        self.assertTrue(lock.exists(), "disable did not acquire lock")
        boot = self.runmanager("boot")
        self.assertNotEqual(boot.returncode, 0)
        out, err = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 0, err)
        self.assertEqual(self.target.read_bytes(), self.stock.read_bytes())
        self.assertTrue((self.parent / "native-home" / "disabled").exists())

    def test_untrusted_manager_source_mode_is_rejected(self):
        self.manager.chmod(0o666)
        r = self.prepare()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("untrusted manager source", r.stderr)

    def test_untrusted_hook_source_is_rejected(self):
        self.hook.chmod(0o666)
        r = self.prepare()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("untrusted hook source", r.stderr)
        self.assertFalse((self.parent / "native-home").exists())

    def test_source_symlink_is_rejected(self):
        self.hook.unlink()
        self.hook.symlink_to(self.manager)
        r = self.prepare()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("untrusted hook source", r.stderr)
        self.assertFalse((self.parent / "native-home").exists())

if __name__ == "__main__":
    unittest.main()
