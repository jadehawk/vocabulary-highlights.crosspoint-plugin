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

Experimental Razor-Crest firmware with ui.local-notes.v1 can launch
an offline native vocabulary/highlights reader from device.json, with
basic book and entry sorting and saved definition/passage viewing.
Native editing and unbounded indexing are not yet implemented.
