# TV Home — webOS TV launcher V3.2.6 (public source preview)

> **EXPERIMENTAL SOURCE REVIEW SNAPSHOT. NOT A STABLE RELEASE OR CERTIFIED IPK.**

The `tvhome/` folder contains a proposed webOS TV launcher application and its private local-network wallpaper service, separate from the repository's native Home/root hooks.

## V3.2.6 improvements
- Four **included** original, 1920×1080 local wallpaper assets (Aurora Lake, Sunrise Ocean, Misty Mountains, Amber/Teal), selected offline without an Internet connection.
- On new installations the default choice is Aurora Lake; changes survive closing and reopening the app.
- A photo-upload interface on the TV shows a QR code and temporary 6-digit PIN with a TV-reported local IP address. On an iPhone on the same LAN, opening Safari at the shown address lets the user submit a photo, then accept it by choosing **Áp dụng** on the TV; previously applied pictures are listed in the TV's private gallery.
- Local-only UI mock tests passed for preset selection/persistence and the 15-minute pairing/QR expiry.
- Existing 25 icon/banner *references* remain in text source. **Their actual binary files are excluded** pending license clearance.

## Build limitations
The local privately packaged IPK SHA-256 was `ecefbd13453f0fa1d539d708b390740abef30d9cd2bc3b7a3e0d12934ef7aa01`, with 117 exact source-matching payload files. **That IPK is not uploaded to this repository** because independent security review, device E2E and distribution gates are still outstanding.

Source cannot reproduce the exact IPK without additional properly licensed app icon, banners, other media and JS dependencies. Do not publish or install a binary based only on this preview.

This project does not claim affiliation with Apple or LG; the native Home/InputHook/KeyFilters work at the repository root is a separate security-held track.

Read `USER_GUIDE_VI.md`, `RELEASE_GATES.md`, and `LICENSE_SCOPE.md` before evaluating the prototype.
