# Safety / Release Gate

This is a **root-only EXPERIMENTAL prototype**. It is NOT a firmware updater or a rooting tool.

- Never enable remote root with a factory/default password. Register and verify authorized_keys on the TV first, use key-only SSH, restrict LAN access.
- Root shells, private SSH keys, Wi-Fi credentials, passphrases, stock system files and serial numbers must not be published.
- LG Developer Mode can conflict with rooted Homebrew. Do not reboot or uninstall Developer Mode until alternative access is tested, and custom apps are backed up.
- Always preserve the stock Home file from **your exact firmware**, together with a SHA-256 and a full means to recover.
- Use only a root-owned validated patched copy for the bind mount; never mount a world-writable app payload.
- The startup hook checks root, fail-safe mode, app presence, stock hash and patched hash and skips if any do not match. It does not restart sam or reboot the TV.
- The tool never disables telemetry, automatic updates, modifies the bootloader, writes a firmware partition or changes the LG root filesystem contents.
- Device security and availability may still be affected by any Home remap.
- Test first on a spare/recoverable device: Home, Back, launcher input/HDMI, streaming apps, sound, standby/wake, boot loops, RAM and clean rollback.
- If the TV boots into Homebrew failsafe, **do not remove failsafe controls** without identifying cause and securing root access.
- Source files from the TV are copyrighted/proprietary: do NOT include them in Git commits or share backups.
- User-specific package names and shell samples are illustrative. No implied compatibility with every LG webOS 22 update.
