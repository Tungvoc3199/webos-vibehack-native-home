# V3.2.6 release status

| Gate | Status | Evidence |
|---|---|---|
| Official LG SDK package check/build | PASS offline | `ares-package --check`, `--no-minify` |
| Source vs IPK exact inventory | PASS offline | 117/117 files, SHA-256 `ecefbd13453f0fa1d539d708b390740abef30d9cd2bc3b7a3e0d12934ef7aa01` |
| Four built-in wallpaper images | PASS offline | 1920×1080 JPEG, SHA hashes in `app/wallpapers/presets/manifest.json` |
| Personal family photo excluded | PASS offline | No `wallpapers/custom.jpg` in 117 IPK files |
| Preset selection + reload | PASS offline | Four Playwright browser cases |
| Manual IP/QR and 15-minute PIN mock | PASS offline | QR expiry / gallery mock |
| Security review V3.2.6 | **PENDING** | No independent APPROVE |
| webOS22 LS2 service, UID/ACL and rollback | **BLOCKED** | No authorized on-device runtime evidence |
| Physical TV/iPhone/Magic Remote/CEC | **NOT TESTED** | No V3.2.6 physical canary |
| Third-party icon/banner/font licenses | **UNKNOWN** | Media binaries excluded from GitHub preview |
| Official LG Content Store approval | **NOT SUBMITTED** | Requires Seller Lounge QA |
| GitHub public installable release | **NO-GO** | Do not attach IPK or recommend installation |

The test wallpaper assets in this tree were locally generated *alternatives* following the same four visual themes. They are **not byte-identical** to the AI images previously rendered in ChatGPT.

Prior verified installed version on owner's TV remains V3.2.0 (historical; not newly read). Native Home, boot, KeyFilters, SAM and InputHook remain NO-GO and outside this app.
