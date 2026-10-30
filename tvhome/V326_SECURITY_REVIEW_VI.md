# V3.2.6 — Independent security review (29/10/2026)

**VERDICT: BLOCK (P0=0, P1=6).** This is a read-only review of the **local private IPK** and source, not an approval to distribute/install it. The public GitHub tree is a *subset* without its private binary media.

## Blocking findings

1. **Package Unix modes:** The local IPK's `data.tar.gz` records directories with mode `0777` and HTML/JS with `0666` (including the private wallpaper JS Service). Rebuild with safe modes; verify what the actual LG installer applies.
2. **IP/branding/media provenance:** The local IPK contains `app/keyfilters-candidate.txt` marked LG confidential, plus unverified third-party app icons/banners. This file and those binary assets are **not present in this GitHub preview**, but they block any binary release. User-facing strings still mention Apple TV Lite; title/trademark clearance needed. `service/package.json` is `UNLICENSED`.
3. **LAN photo privacy:** `service/wallpaper_receiver.js` and `service/phone.js` transfer JPEG and six-digit PIN over ordinary HTTP on the local network. Origin/Host/PIN help prevent unauthorized upload, **not passive LAN interception**.
4. **Stored photo lifecycle:** Users can choose stored images, but there is no exposed delete-one/delete-all flow, retention policy or fully verified uninstall/rollback data-removal behavior.
5. **Version attestation mismatch:** `/tv/health` reports `3.1-candidate` from `service/wallpaper_receiver.js`, while IPK metadata says `3.2.6`, so the health endpoint cannot prove installed release generation.
6. **Unclosed release gates:** No independent hardware-backed rollback, service process/permission attestation, physical iPhone/Magic Remote testing or verified distribution-signing evidence.

### Additional P2 concerns
- Five incorrect PINs from another LAN client may invalidate an active upload session.
- Service stop watchdog 6.5 s could time out before the receiver socket timeout 20 s.

### Verified strengths
- IPK SHA-256 `ecefbd13453f0fa1d539d708b390740abef30d9cd2bc3b7a3e0d12934ef7aa01` matches audit; 117 package files; original four wallpaper hashes verified.
- Fixed preset whitelist prevents arbitrary stored background URLs.
- Receiver restricts certain addresses/origins and uses a private control capability; JPEG sizes, decoded bytes and session limits have guards.
- **None** of the above proves safe webOS22 runtime on the owner's TV.

## Distribution decision
- Public *GitHub source-only draft PR*: visible solely for peer review, **not approved for an end-user installer or commercial code release**. Note that drafts in a public repo are publicly readable.
- V3.2.6 IPK: **BLOCK**, do not attach as an installer or GitHub Release.
- Stable/commercial launch: **BLOCK** until all P1 are fixed and physical release gates pass.

The public source-only folder deliberately excludes `keyfilters-candidate.txt`, unlicensed binary app art, and the owner's photos. This reduces exposed artifacts but does not close the IPK release findings.
