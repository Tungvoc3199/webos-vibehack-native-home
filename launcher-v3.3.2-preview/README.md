# LG TV Home — V3.3.2 source candidate (NOT A RELEASE)

**Status: SOURCE-ONLY PREVIEW / UNVERIFIED ON REAL TV. DO NOT INSTALL DIRECTLY.**

This directory contains the application/service text source for the private TV Home V3.3.2 candidate developed on 2026-10-30. It is separate from the repository's rooted **native Home hook** and does not modify or activate those scripts.

## Changes
- Dock background blur reduced from 32px to 8px; navigation from 28px to 6px.
- Lower-cost full-screen library backdrop and wallpaper presentation.
- Focus labels wrap to preserve the independent AdFree YouTube name.
- Hardened QR/PIN pairing with exact app/service V3.3.2 version check, epoch/sequence invalidation against stale/late requests, and a fail-closed health gate.
- Existing saved-image gallery preview, wallpaper upload controls and Dock reordering logic retained in source.

## Evidence and limitations
- Full private candidate on THADC: **10/10 offline test suites PASS**, independent Codex source review R5 **APPROVE (P0=0, P1=0)**.
- The full candidate private IPK SHA-256 is `57082b6eb4cd4cfd2e26c839465378e274f26ee464aabf6137a25e6a0dee9670`; **that IPK is not included here**.
- On 2026-10-30, one owner-approved Homebrew install attempt ended without a confirmed final event when the television entered Suspend. After wake and read-only SHA256 inventory: **TV still runs V3.3.1**, all 113 app and 11 service files intact, private photo preserved, two YouTube apps present. **V3.3.2 is NOT installed on TV.**
- Real panel image preview, QR upload, remote use and actual performance are not independently accepted; native zero-flash Home remains unresolved. No Home/KeyFilters/SAM/boot/inputhook changes.
- This preview intentionally **excludes third-party brand icons, images, nature photographs, Outfit font binary, vendored dependencies, IPK binaries, local logs, SSH credentials and personal photos**. It is **not a self-contained build**. Do not use it as an installable package or claim byte-for-byte equivalence with the private IPK.

## Structure
- `app/`: text source for webOS launcher, style, wallpaper UI and third-party license notices
- `service/`: app-specific LAN wallpaper receiver source (the receiver is marked UNLICENSED in its own manifest)
- `tests/`: local offline regression harnesses (require development fixtures, Playwright, and licensed assets)
- `app/wallpapers/presets/manifest.json`: references and stated licenses for the four wallpapers; the actual images are not distributed here

## Privacy and safety
- Do not expose receiver HTTP port 8765 to the public internet.
- No private photo, pairing secret, password, SSH key, LAN host-specific deployment script, device serial, or root-level operating system content is published in this tree.
- Use Homebrew Channel and a version/hash-checked installer only after a safe live preflight and exact previous-version rollback plan.
- **Do not** install Input Hook HOME773 or modify native Home as part of this application update.

The original `main` branch and native-home security branch are deliberately unchanged by this preview.
