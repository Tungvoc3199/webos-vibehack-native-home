# TV Home — webOS launcher source snapshot (3.2.5 RC)

> **SOURCE REVIEW ONLY — NOT A DOWNLOAD, INSTALLER, APPROVED RELEASE OR LG CONTENT STORE APP.**

This folder contains the text-source snapshot of an independently developed webOS TV launcher and its private wallpaper receiver service. It combines a slim dock, keyboard/Magic Remote navigation, launcher UI, and LAN-only phone-to-TV wallpaper pairing.

**Status (29 October 2026):** the official LG packaging tool built V3.2.5 and the locally packaged 112 payload files matched the local source. Four offline browser UI regressions passed. Physical TV E2E, independently approved deployment/rollback, final security review, product licensing and LG certification **remain open**. The last independently verified installed TV build is V3.2.0.

## What is in GitHub

- `app/`: JavaScript, HTML, CSS, app metadata and MIT-licensed QR generator with its notice.
- `service/`: webOS JS Service wrapper, wallpaper receiver, phone upload form, service metadata. The service includes a private LS2 stop command for eventual bounded rollback.
- `test_v324_service_lifecycle_offline.js`: offline VM-only state-machine regression for start/stop behavior; run from this folder using Node.js.

## Intentionally excluded

The GitHub folder **does not contain** any owner/family wallpaper, actual downloaded app icons or banners, fonts, app package binary (IPK), third-party `node_modules`, device addresses, SSH material, pairing tokens, system Home hooks or on-device backups. Consequently **this source-only snapshot is not a reproducible installable IPK** until appropriately licensed replacement assets and dependencies are supplied.

**Important:** the experimental *native Home integration* code at the repository root is a separate, security-held root-device project. This application snapshot does not enable it, replace LG stock Home, bypass firmware protections, or claim a zero-flash hardware Home-key route.

Do not publish an installation command, redistribute an IPK or sell this build until `RELEASE_GATES.md` is cleared.

## Offline check

```sh
node test_v324_service_lifecycle_offline.js
```

This test does **not** exercise an actual LG TV, the native Home key, service jail permissions, or real iPhone uploads. See `RELEASE_GATES.md` for blocked evidence.

Product name and visuals are provisional. No affiliation with Apple or LG is claimed.
