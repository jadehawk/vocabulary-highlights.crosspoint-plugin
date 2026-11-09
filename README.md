# Vocabulary & Highlights for CrossPoint

An SD-card plugin for browsing previously looked-up words and saved highlights. Version **0.1.0** is a **browser-based WebUI plugin**, compatible with stock CrossPoint and Razor-Crest. Native on-device screens are planned separately and are **not** implemented by this version.

## Installation

Copy the complete **vocabulary-highlights/** payload folder to **/.crosspoint/plugins/vocabulary-highlights/** (recommended) or **/plugins/vocabulary-highlights/**.

Enable **Settings → Connectivity → Plugins** on the reader. Start the device's Wi-Fi File Transfer / WebUI mode and open **Plugins → Vocabulary & Highlights** in your phone or desktop browser. The on-device Plugins list displays the bundled README, because stock firmware cannot execute browser JavaScript as a native e-ink screen.

The plugin requires the normal CrossPoint WebUI endpoints. It needs no Internet service, API token or account; your browser communicates directly with the reader over the local network.

## Source files

The firmware writes both files to the **SD root**; the plugin does not copy or alter them:

| Path | Format | Parsed fields |
| --- | --- | --- |
| /Vocabulary.txt | v1 JSON Lines | Unique ID, timestamp, headword, saved definition, book/author/series, chapter, page, spine, offset |
| /My Clippings.txt | Kindle-style text blocks | Book/author, highlight body, chapter, page, optional local date |

The browser reads them through the existing /download endpoint. Missing files are reported but do not prevent viewing the other tab. Use **Refresh from SD** to see changes made since you opened the page.

## Features

- Separate Vocabulary and Highlights tabs, grouped by book (title **and** author).
- Book sorting A–Z, Z–A or **Recently added** (latest recorded item).
- Vocabulary sorting A–Z, Z–A, reading order (spine/chapter/page/offset), newest or oldest.
- Highlight sorting by reading order, newest or oldest.
- Search by book/title/author, word/definition or highlighted text.
- Per-word statuses: **New** (default), **Learning** and **Mastered**.
- Delete from list (soft delete) and **Show deleted → Restore entry**.
- Paginated lists and responsive desktop/mobile layout, using the firmware's light/dark theme variables.
- Handles UTF-8 and multiline definitions/highlights without interpreting their text as HTML.

## Storage and safety

The plugin stores status changes and hidden-entry IDs in **/.crosspoint/vocabulary-highlights/state-v1.json**, separate from the installed plugin. It never stores copies of source definitions or highlights. Writes use the firmware's temporary-file replacement endpoint, refuse to overwrite unreadable or unsupported state, and stay below the 256 KiB endpoint limit.

"Delete from list" **does not delete** data from /Vocabulary.txt, /My Clippings.txt, or the native clipping store. If the original export is regenerated or appended, stable IDs preserve existing status/hidden flags. Removing or upgrading the plugin does not intentionally remove the separate state directory. Back up the state file before resetting the SD card.

### Updating from the pre-release Vocabulary Builder test plugin

The new plugin has a different install-folder identity. Copy **vocabulary-highlights/** into the SD plugin root and, after confirming it appears, remove the **old plugin install directory** at **/.crosspoint/plugins/vocabulary-builder/** (or **/plugins/vocabulary-builder/** if that is where it was installed) to avoid duplicate entries.

**Do not delete** the previous learning-state directory **/.crosspoint/vocabulary-builder/**. If the new state file is absent, the renamed plugin reads the previous state automatically and carries those statuses and deleted-entry flags forward. The first successful status change or deletion saves a copy to **/.crosspoint/vocabulary-highlights/state-v1.json**; the previous state is retained as a backup. An existing new state always takes priority, including when it is unreadable, so it cannot be silently overwritten by the old state.

The export tracks **lookup time**, not synchronization time. **Recently added** is accurate; **Last sync** is intentionally not shown.

## Development and verification

The repo intentionally has no firmware build. Requires Node 20+ only for testing:

    npm test
    npm run check

To run optional tests against local export files without adding them to Git, set VOCAB_SAMPLES_DIR to the folder containing Vocabulary.txt, Vocabulary (5).txt, and My Clippings.txt, then run npm test. Never commit personal vocabulary or clipping exports.

## Roadmap

Razor-Crest's native offline e-ink browser requires a **new capability-gated firmware activity** that can read the same exports and the plugin's state file. It must be designed and verified independently on X3 / X4Pro. Stock CrossPoint's device.json does not support arbitrary local SD-file browsing or native JavaScript execution. The future native adapter will use the same file schema and avoid changing the web plugin experience.
