# LG TV Home V3.3.4 — live weather + cleaner left layout

**LATEST SOURCE PREVIEW. NOT A COMPLETE INSTALLABLE IPK.**

## Changes
- Removed left marketing/promo copy and redundant greeting; clock/date, navigation, dock, image galleries retained.
- Compact Open-Meteo HTTPS weather widget: current temperature, condition, humidity, hourly precipitation probability; updates every 20 minutes, no continuous animation.
- Location can be changed under **Cài đặt > Thời tiết · chọn địa phương**: Hưng Yên (default), Hà Nội, Hải Phòng, Đà Nẵng, TP. Hồ Chí Minh.
- One request timeout after 9 s. If offline, cached values are **explicitly labeled** with their timestamp; older than 3 hours is not displayed as live.
- Settings include **Thời tiết · cập nhật ngay**. No API key, no GPS, no rooted service and no new always-on process. Open-Meteo provider license applies.
- Dock continuous reorder from V3.3.3 is preserved.

## Verification / install status
- 11/11 local Playwright regression suites PASS, including live-weather JSON schema, offline/cache cases and Dock.
- Actual TV successfully reached Open-Meteo API over HTTPS. Node.js 12 local receiver E2E PASS and official webOS SDK package check PASS.
- Privately packaged and **successfully installed V3.3.4 on the owner's LG TV** via one official Homebrew Channel transaction. Source/IPK/live app/service SHA check all PASS, photo and both YouTube apps unchanged.
- Owner has not yet confirmed how weather renders on the physical TV panel; no claim of visual acceptance or zero-flash.

## Deliberately excluded
Third-party icon images, nature JPG binaries, fonts, private photos, vendored binary dependencies, root scripts, compiled IPK, and TV-specific install credentials. This repo is a **source preview only**, not a one-click app download. The native Home interception project at root is separately marked **SECURITY HOLD**.

Provider: https://open-meteo.com/ (use consistent with its non-commercial API terms).
