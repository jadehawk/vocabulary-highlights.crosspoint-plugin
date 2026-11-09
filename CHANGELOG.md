# Changelog

## 0.1.0 — First unreleased milestone

- Tested successfully on stock CrossPoint X4 and Razor-Crest Picco.
- Renamed the user-visible plugin, manifest identity, and SD folder to `vocabulary-highlights` before the first release.
- Preserve learning progress from the earlier test folder with a safe legacy-state read fallback.
- Add an optional device.json and Home shortcut for an experimental Razor-Crest native read-only viewer; stock CrossPoint keeps the README fallback.
- Initial browser milestone:

- Browse SD-root vocabulary JSONL and Kindle-style clipping exports by book.
- View saved definitions and highlights; filter, search and sort.
- Persist New / Learning / Mastered statuses and reversible deletions.
- Use atomic firmware plugin-fs writes; leave both source exports untouched.
- Support stock CrossPoint and Razor-Crest WebUI without firmware changes.
