Vocabulary & Highlights

Browser WebUI:
Enable File Transfer / WebUI and open Plugins ->
Vocabulary & Highlights. This works on stock CrossPoint.
On stock firmware, this README appears in the on-device
plugin list; browser JavaScript does not run on the reader.

Razor-Crest native viewer (supported firmware):
Browse Vocabulary and Highlights without Wi-Fi. Open a book,
select a saved word or highlight, and view the saved details.
Long-press an entry (or hold Select on button-only readers)
to change a word's New/Learning/Mastered status, hide a
word/highlight, or restore a hidden entry. Use the book-list
sorting menu -> Show deleted to find hidden entries.

A book containing only hidden entries remains listed on
the device so its entries can be restored. Book counts
include both visible and hidden records. In the WebUI,
books with no visible entries are hidden by default until
Show hidden is enabled.

Source files (read-only):
  /Vocabulary.txt
  /My Clippings.txt

Progress and hidden IDs are saved separately in:
  /.crosspoint/vocabulary-highlights/state-v1.json

If no new state file exists, previous progress from
/.crosspoint/vocabulary-builder/state-v1.json can be read
and copied on the first successful change. Keep the old
state file as a backup; only remove the obsolete installed
Vocabulary Builder plugin directory if it remains installed.
Deleting from a list never edits the original export files.

Native memory limits: X3 displays up to 64 books and 192
entries per selected book. Other targets display up to
128 books and 512 entries. The native state reader accepts
up to 8 KiB on X3 or 24 KiB elsewhere; larger valid state
can still be edited from the browser WebUI.

No cloud service or account is required. Version 0.1.0.
