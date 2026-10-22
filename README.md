# Native Home for LG webOS (rooted TVs)

**SECURITY HOLD — DO NOT INSTALL OR ENABLE THIS VERSION.** Independent Codex review on 2026-10-22 identified a Critical root-level symlink/config trust flaw plus High-severity rollback/mount-validation defects. The scripts remain available for code review only until fixed and re-reviewed. This is NOT firmware and will NOT root your TV.

Rooted LG webOS Home-key redirect to a custom launcher (default: com.gathin.tvhome) via a reversible bind mount. No PC watcher, no firmware flash, and no overwrite of the signed system file.

Inspired by [OpenLauncher](https://github.com/Shantil-K/OpenLauncher) for webOS 6–24. Requires separately installed [webos-vibehack](https://github.com/OmkarK97/webos-vibehack).

## Requirements

- Rooted LG webOS TV with working [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel), including its init.d boot hooks.
- A custom launcher installed AND verified to open after migration away from LG Developer Mode.
- Verified key-only SSH root access AND a reliable fallback recovery channel.
- A SHA-256-verified copy of your TV's **original** /usr/lib/qml/KeyFilters/systemUi.js.
- Firmware that actually maps com.webos.app.home through this KeyFilters file. Not verified on webOS 25/26.

**Never reuse another person's stock systemUi.js. Never flash unsigned LG firmware.**

## Prepare and enable (root shell on TV)

Audit the scripts and transfer them to a **root-owned, non-group-writable and non-world-writable** directory (including all ancestor directories). The manager refuses insecure source paths, symlinks and unsafe modes. Example, from a verified root shell with the two audited scripts already transferred:

~~~sh
mkdir -p /home/root/native-home-release
chmod 700 /home/root/native-home-release
chown 0:0 /home/root/native-home-release
cp native-home.sh native-home-hook.sh /home/root/native-home-release/
chown 0:0 /home/root/native-home-release/*.sh
chmod 700 /home/root/native-home-release/*.sh
cd /home/root/native-home-release
~~~

**Critical trust boundary:** copying files into a root-owned directory does not by itself prove they are genuine. Before executing either script as root, compare the SHA-256 of BOTH copied scripts against trusted release checksums obtained independently from the published GitHub commit/release. If no trustworthy checksum is available, STOP. **Never directly invoke a shell script as root from Downloads, /tmp, SMB shares, or another user-writable location; a script cannot authenticate its own content before its first instruction executes.** The internal source/permissions checks are defense in depth, not a substitute for this staging procedure.

Run the commands below as the root owner, from that trusted source directory. If a power cut leaves a stale /var/lib/webosbrew/.native-home-lock, **never delete it while another operation is running**; investigate and then manually remove the empty lock directory only if the operation has stopped.

When the stock file is not already bind-mounted, save the original before modifying anything:

~~~sh
cp /usr/lib/qml/KeyFilters/systemUi.js /tmp/systemUi.original.js
sha256sum /tmp/systemUi.original.js
~~~

If another launcher is already bind-mounted onto systemUi.js, this copy is NOT original. Instead use an independently verified stock backup. If unavailable, STOP.

Replace STOCK_HASH with the actual SHA-256 of your ORIGINAL backup:

~~~sh
sh native-home.sh status
sh native-home.sh prepare /tmp/systemUi.original.js STOCK_HASH com.gathin.tvhome
# Prepared, but DISABLED. No Home changes, no reboot.
sh native-home.sh enable
# Hook staged for the next boot; does not reboot or restart the GUI.
~~~

**Do not reboot until Developer Mode/root persistence is safely migrated and root SSH recovery is tested.** On reboot the hook checks root ownership and permissions, cryptographic hashes, presence of the app, Homebrew root and that the stock KeyFilters file is unmodified. If a precondition fails it exits without changing the mapping.

## Rollback

~~~sh
sh native-home.sh status
sh native-home.sh disable
# Prevent next-boot remapping; does not change the current session.
sh native-home.sh rollback
# Disables future boot mapping; does NOT unmount live Home.
~~~

This tool deliberately does not hot-unmount a running Home mapping: while a file bind mount is active, the underlying stock file cannot be reliably pre-verified. After disable/rollback, verify your secure root recovery channel, then conduct a controlled reboot to restore stock Home. Other launchers' mounts are never removed.

## Important limitations

- Mapping Home does NOT remove LG's stock Home process or prove reduced RAM/lag.
- Tested statically, NOT yet fully validated by real power-cycle, standby and app/HDMI E2E tests.
- Custom Home launcher can disappear when LG Developer Mode is uninstalled. Reinstall and verify app persistence before enabling reboot hook.
- A root script can impact TV stability. Have a tested rollback route.

## Tiếng Việt

Đây là công cụ thử nghiệm cho TV **đã root**, không phải firmware. Phải cài và kiểm tra giao diện webos-vibehack riêng. Cần sao lưu đúng file Home gốc của TV, kiểm tra SHA-256 và có SSH root an toàn. Lệnh prepare chỉ tạo bản vá chưa kích hoạt. Lệnh enable cài hook khởi động nhưng **không reboot**. Chỉ reboot sau khi có phương án khôi phục và xử lý xung đột LG Developer Mode. Lệnh disable và rollback chỉ tắt hook lần khởi động sau, không tháo bind mount nóng. Cần kiểm chứng SSH root/khả năng khôi phục trước khi reboot để trở lại Home LG gốc.

## Credits

- [OmkarK97/webos-vibehack](https://github.com/OmkarK97/webos-vibehack), MIT.
- [Gathin/tv-vibehack](https://github.com/Gathin/tv-vibehack).
- [Shantil-K/OpenLauncher](https://github.com/Shantil-K/OpenLauncher).
- [webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

Original scripts in this repository use the MIT license; no LG proprietary firmware or user configuration is included.
