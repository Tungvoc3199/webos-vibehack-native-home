# LG TV Home V3.3.3 — continuous Dock reorder (source preview)

**LATEST SOURCE CANDIDATE. NOT INSTALLABLE AS-IS. NOT LIVE-TV ACCEPTED.**

## Simple TV remote workflow
1. Focus an app in the Dock and **hold OK (~0.65 seconds)** to pick it up.
2. Press **Left / Right repeatedly** to move across as many positions as desired. No need to reopen a menu or press OK after each step.
3. Press **OK once** to save. **Back** cancels and restores the original order.
4. A short OK press in ordinary mode **still launches the application**.

For Magic Remote pointer users, the app context menu also offers a single **Sắp xếp icon trên Dock** action.

## Changes from V3.3.2
- Replaced one-step left/right context menu actions with persistent reorder mode, visual amber selection border and transactional OK/Back behavior.
- Home re-entry/visibility cancellation restores uncommitted layout, preventing accidental order saves.
- Old settings, app launching, YouTube Stock + AdFree icons, wallpaper gallery, QR/PIN protections, Dock wave and app IDs retained.
- Synced app/service version 3.3.3 to preserve version-gated wallpaper upload health checks.

## Verification
- 10/10 local UI and security regression suites PASS on 2026-10-30, including repeated remote arrows, commit/cancel, reload persistence, both YouTube IDs, image gallery, QR pairing, stale health/race and relaunch.
- Independent Node.js 12 service integration PASS; official webOS SDK package static check PASS.
- The real LG TV remains installed at **V3.3.1**. V3.3.2 prior install was interrupted by TV Suspend and never succeeded; **V3.3.3 is NOT installed**.
- Physical preview, TV remote, YouTube playback and performance measurements not yet accepted. Native zero-flash Home/Input Hook remains blocked and untouched.

## Deliberately excluded
This source-only GitHub preview does NOT include third-party branded icon binaries, unverified images, nature JPEGs, font binary, vendored binary dependencies, compiled IPK, SSH secrets, private photo, or any TV-specific root installer. It cannot be built as-is without separately supplying reviewed, correctly licensed assets. Do not distribute it as an app release.

Includes application/service text source, upstream license notices, wallpaper attribution manifest, and test references only. The wallpaper receiver package is marked UNLICENSED; public availability does not grant redistribution rights.

The repository native Home hook remains a separate **SECURITY HOLD — DO NOT INSTALL** component.
