# Vocabulary & Highlights

Browser-based vocabulary and highlight library for CrossPoint and
compatible firmware.

- Reads `/Vocabulary.txt` (version 1 JSONL) and `/My Clippings.txt`.
- Browse by book and search text, with book, word, date and reading-order sorting.
- Saved word statuses: New, Learning and Mastered.
- Hide and restore individual vocabulary entries and highlights.
- Stores changes in /.crosspoint/vocabulary-highlights/state-v1.json without
  rewriting the firmware's append-only source exports.
- Reads legacy the earlier Vocabulary Builder test build status and deletion flags and
  copies them into the new state file on the first successful edit.
- Works offline within the device's local WebUI; no third-party service.

**Note:** Stock CrossPoint does not support this local browser as an
on-device plugin screen. To use it, open the device WebUI in a browser
while the firmware's WebUI/File Transfer mode is running.

Razor-Crest native on-device screens are a separate future integration
and are not included in this plugin version.
