# V3.2.5 release evidence and gates

| Gate | Status | Notes |
|---|---|---|
| Official LG `ares-package --check` and `--no-minify` | PASS (offline) | Source built into a private local IPK |
| Exact 112 source/package files | PASS (offline) | Original local IPK SHA-256: `510b071ffe6fb3d160313d5a9ef7117f86878af9460b71079f0fa1883f7faca1` |
| Four V3.2.5 browser UI tests | PASS (offline) | Dock, animation, gallery, wallpaper reload |
| Service offline source tests | PASS (previous V3.2.4 work) | 32 Python + 8 Node; not on-device service proof |
| Independent V3.2.5 reviewer verdict | **PENDING** | Prior attempt interrupted by an MCP 403; no APPROVE receipt |
| Rooted TV service LS2/UID/ACL and runtime | **BLOCKED** | Need authorized read-only verification on real device |
| App-only upgrade/rollback on TV | **BLOCKED** | Cannot reuse an unreviewed controller; independently tested recovery required |
| Physical iPhone + Magic Remote + HDMI/CEC + wake | **BLOCKED** | Not tested on V3.2.5 |
| Third-party icons/banners/fonts commercial rights | **UNKNOWN** | Excluded from this GitHub branch |
| Privacy policy, product name, trademark review | **PENDING** | No Apple/LG affiliation implied |
| LG Seller Lounge QA | **NOT SUBMITTED** | Approval cannot be inferred from successful IPK build |
| Public binary release or paid distribution | **NO-GO** | No installer or binary included in this branch |

## Rollback reference

Last previously verified production app: V3.2.0 (not recently rechecked). Pinned local rollback IPK SHA-256: `ada5856c9bcd2c9bcfad8ab8f9b7155c39e6dd09b221183eb228be8edb8cec63`. Its binary is **not** in this public repo.

Do **not** run unreviewed scripts on a rooted LG TV; do not change Home, SAM/compositor, KeyFilters, activity manager, boot/root access or firmware. A denied device-security operation must not be retried by switching transports.

The source branch is for review, not installation.
