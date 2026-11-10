# Changelog

## 0.1.0 — First unreleased milestone

### Browser WebUI
- Browse and search saved vocabulary JSONL and highlighted passages, grouped by book and author.
- View saved definitions/highlights; sort, filter and paginate.
- Save New/Learning/Mastered word statuses and reversible hide/restore flags to a separate versioned state file without rewriting source exports.
- Preserve legacy Vocabulary Builder state through a safe read-only fallback and migration on the first successful edit.
- Support compatible firmware through the standard browser plugin API.

### Optional native UI (`ui.local-notes.v1`)
- Device-side offline browser for both SD exports, including book/entry navigation, sorting and saved detail display.
- Native word statuses and reversible word/highlight hiding, sharing the same state file with the browser.
- Keep hidden-only books accessible on-device for recovery; native book totals count stored entries.
- Retain bounded memory and state file limits; hosts without native integration show the plugin README on-device.

### Plugin Hub release preparation (Milestone 5)
- Reorganize the single installable payload as `vocabulary-highlights.crosspoint-plugin/`, matching Plugin Hub's automatic discovery convention while preserving installed ID `vocabulary-highlights`.
- Keep runtime files explicitly declared in `manifest.json`; move no development files into the installed payload.
- Add contract checks, update docs and provide a repeatable manual-install archive generator.
- Keep version `0.1.0` because this plugin has not yet been publicly released.
