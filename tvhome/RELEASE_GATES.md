# V3.2.6 release gates — SECURITY BLOCK

**Independent read-only verdict 29 October 2026: BLOCK (P0=0, P1=6).** See `V326_SECURITY_REVIEW_VI.md`.

| Gate | Status | Evidence |
|---|---|---|
| Official SDK check/build | PASS offline | LG `ares-package --check` + `--no-minify` |
| 117 files match the private IPK | PASS offline | SHA256 `ecefbd13453f0fa1d539d708b390740abef30d9cd2bc3b7a3e0d12934ef7aa01` |
| Four original bundled 1920x1080 backgrounds | PASS offline | `app/wallpapers/presets/manifest.json` |
| Owner family photo omitted | PASS offline | No `wallpapers/custom.jpg` in IPK |
| Preset selection/reload | PASS offline | Four Playwright tests |
| LAN IP, QR and PIN expiry mock | PASS offline | Gallery and 15-minute QR expiry |
| IPK file mode hardening | **P1 BLOCK** | directories 0777, executable source/assets 0666 |
| Rights & license provenance | **P1 BLOCK** | confidential candidate in private IPK, logos/icons/banner rights unverified, service UNLICENSED |
| LAN photo confidentiality | **P1 BLOCK** | HTTP carries PIN/photo without transport encryption |
| Photo deletion/data retention UX | **P1 BLOCK** | no delete-one/delete-all and data policy |
| Health/version attestation | **P1 BLOCK** | health says 3.1-candidate, IPK 3.2.6 |
| Physical webOS22, LS2, rollback, signing and UX | **P1 BLOCK** | not demonstrated |
| LG Content Store certification | NOT SUBMITTED | LG approval not implied |
| Installable public GitHub Release / commercial sale | **NO-GO** | do not publish binary |

The public PR is a **source-only draft**, not a commercial distribution. Rooted native Home/InputHook/KeyFilters system changes are completely out of scope.
