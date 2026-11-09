Vocabulary & Highlights

This plugin works in the browser-based CrossPoint WebUI.
Open the device's File Transfer / WebUI mode, then choose Plugins
and Vocabulary & Highlights. It does not create a native reader screen
on stock CrossPoint.

It reads these files from the root of the SD card:
  /Vocabulary.txt
  /My Clippings.txt

You can browse by book, sort by title, word, chapter/page or date,
view saved definitions and highlighted text, mark words New,
Learning or Mastered, and hide or restore entries.

Settings and hidden-item flags are saved in
/.crosspoint/vocabulary-highlights/state-v1.json. If upgrading from
the earlier Vocabulary Builder test build, the previous state under
/.crosspoint/vocabulary-builder/ is read until the first edit migrates it.
Keep that old state folder as a backup. Remove only the old plugin
install folder to prevent duplicate plugin entries. The original
export files are never edited or deleted.

Use "Refresh from SD" after recording new words or highlights.
If a source file is absent, that tab will have no entries.
No Internet service or account is required.
