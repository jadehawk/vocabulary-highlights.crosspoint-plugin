# Vocabulary & Highlights

Review saved dictionary lookups and highlights without changing original exports.

- **Vocabulary:** Open saved definitions, group by book, sort entries, and track **New**, **Learning**, or **Mastered**.
- **Highlights:** Open saved passages and browse by book or reading order.
- **Reversible hiding:** Hide or restore words and highlights; the original `Vocabulary.txt` and `My Clippings.txt` files remain untouched.
- **WebUI:** Full search, filtering, sorting and paginated lists on compatible firmware in File Transfer/WebUI mode.
- **Optional native UI:** If the host firmware implements `ui.local-notes.v1`, browse offline and change statuses or hide/restore entries directly on the reader.

## On-device recovery

When the optional native viewer is available, books containing only hidden items remain listed, and their displayed totals include hidden entries. Select **Show deleted** from the book-list menu, open the book, then **Restore entry**. The WebUI hides such books until **Show hidden** is selected.

## Data and compatibility

Reads `/Vocabulary.txt` and `/My Clippings.txt` at the SD root. Saves status and hide flags in `/.crosspoint/vocabulary-highlights/state-v1.json` with a legacy-state migration fallback. Native indexing is bounded to 64 books/192 entries on X3 and 128/512 elsewhere. Large native state files may be editable only through WebUI. No online service or account is required.
