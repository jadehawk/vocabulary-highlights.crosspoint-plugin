# Milestone 5 — Plugin Hub release-readiness checklist

## Contract source

The authoritative publishing rules are [PLUGIN_HUB_CONTRACT.md](https://github.com/crosspoint-reader/crosspoint-plugin-hub/blob/main/PLUGIN_HUB_CONTRACT.md) and its [agent guide](https://github.com/crosspoint-reader/crosspoint-plugin-hub/blob/main/PLUGIN_HUB_AGENT_GUIDE.md). The firmware can manually load plugins without these repository constraints; Plugin Hub automatic discovery requires them.

## Repository and packaged files

- [x] Exactly one direct-child `vocabulary-highlights.crosspoint-plugin/` payload directory
- [x] Directory stem and `manifest.json` name both equal `vocabulary-highlights`
- [x] `manifest.json` uses numeric `0.1.0` and declares every installed runtime file
- [x] Contains `manifest.json` and both `plugin.js` and `device.json`
- [x] Tests, build helpers and developer documents live **outside** the payload
- [x] No hard native-only capability requirement in the manifest; stock CrossPoint WebUI remains installable
- [x] Reproducible **optional manual-install ZIP** at `dist/vocabulary-highlights-0.1.0.zip`, with the **device install folder** `vocabulary-highlights/` as ZIP root
- [x] Existing on-device state paths remain unchanged

## Verification before first stable release

- [x] Device-tested native milestones 2–4 reported successful on Razor-Crest
- [x] Browser WebUI tests, including reversible hides and legacy-state handling
- [x] Tested isolated duplicate highlight identity and independent tombstones in browser parser
- [x] Corrected README, installable README, rich details and CHANGELOG
- [ ] Physically validate native X3 with no PSRAM
- [ ] Physically validate two **identical** highlights in one book, hide one and restore it without changing the other
- [ ] Exercise a library larger than native book/entry caps; confirm the UI reports its limits
- [ ] Test oversized valid native state (>8 KiB on X3, >24 KiB elsewhere) leaves browser editing usable
- [ ] Confirm native/WebUI round trip with state written by either interface on the target device

The browser and packaging checks are not substitutes for unperformed hardware tests.

## Publishing — NOT DONE

- [ ] Create one **public** GitHub repository (ideally name contains `crosspoint-plugin`)
- [ ] Add repository topic `crosspoint-plugin` for discovery
- [ ] Commit and push the verified payload and development files
- [ ] Publish the first **non-draft, non-prerelease** Release tagged `v0.1.0`, matching the payload manifest
- [ ] Wait for the scheduled Hub catalog refresh (every three hours) or trigger a maintainer refresh
- [ ] Confirm the plugin is visible in **Community Plugins**, installs all declared files, and displays optional DETAILS content
- [ ] Check updates preserve separately stored `/.crosspoint/vocabulary-highlights/state-v1.json`

**Important:** For the standard standalone layout, Plugin Hub pulls the declared loose files from the immutable Release tag. It **does not require a ZIP asset**. A ZIP is only provided for convenient manual sideloading. Do not reuse a published version tag for changed runtime bytes; publish a new version instead.

## User-visible behavior

Razor-Crest intentionally retains a book with its only entry hidden, showing its *stored total* and allowing **Show deleted → Restore entry**. WebUI hides such books by default, but **Show hidden** brings them back. Consider a clearer count label later, after hardware checks; do not remove the only on-device restoration path.
