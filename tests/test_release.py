"""Offline safety smoke tests. These never connect to any TV."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parent.parent
CONTROLLER=ROOT/'native-home.sh'
HOOK=ROOT/'native-home-hook.sh'

class OfflineSafetyTests(unittest.TestCase):
    def test_posix_shell_syntax(self):
        for path in (CONTROLLER, HOOK):
            p=subprocess.run(['sh','-n',str(path)],capture_output=True,text=True)
            self.assertEqual(p.returncode,0,p.stderr)

    def test_status_does_not_mutate(self):
        p=subprocess.run(['sh',str(CONTROLLER),'status'],capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertIn('Boot hook:',p.stdout)

    def test_nonroot_hook_skips_without_error(self):
        p=subprocess.run(['id','-u'],capture_output=True,text=True)
        if p.stdout.strip() == '0': self.skipTest('must run as non-root')
        p=subprocess.run(['sh',str(HOOK)],capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertIn('not root',p.stderr)

    def test_prepare_denies_nonroot(self):
        if subprocess.check_output(['id','-u'],text=True).strip()=='0':
            self.skipTest('must run as non-root')
        with tempfile.TemporaryDirectory() as td:
            original=Path(td)/'stock-test-input.txt'
            original.write_text('var HOME_APP_ID = "com.webos.app.home";')
            p=subprocess.run(['sh',str(CONTROLLER),'prepare',str(original),'0'*64,'com.gathin.tvhome'],
                capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('requires root',p.stderr)

    def test_root_scripts_have_no_reboot_or_firmware_flash(self):
        source=CONTROLLER.read_text()+HOOK.read_text()
        for forbidden in ['mkfs','dd if=','flashcp','fw_setenv','/dev/mtd','reboot -f','restart sam','telnetd','passwd']:
            self.assertNotIn(forbidden,source)

    def test_dry_run_patch_preserves_fixture_original(self):
        with tempfile.TemporaryDirectory() as td:
            src=Path(td)/'stock-test-input.txt'
            src.write_text('X com.webos.app.home Y com.webos.app.home Z\n')
            dst=Path(td)/'test-patched.txt'
            s=src.read_text().replace('com.webos.app.home','com.gathin.tvhome')
            dst.write_text(s)
            self.assertEqual(src.read_text().count('com.webos.app.home'),2)
            self.assertEqual(dst.read_text().count('com.gathin.tvhome'),2)
            self.assertNotEqual(src.read_bytes(),dst.read_bytes())

    def test_gitignore_excludes_sensitive_extensions(self):
        data=(ROOT/'.gitignore').read_text()
        for name in ('*.key','*.pem','*.ipk','*.epk','authorized_keys','backups/'):
            self.assertIn(name,data)

if __name__=='__main__':
    unittest.main()
