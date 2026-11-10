"""Build the README screenshot contact sheet from preserved original screenshots.

Requires Pillow: python -m pip install Pillow
Run from any directory: python tools/make_screenshot_contact_sheet.py
Original image bytes are never rewritten.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "docs" / "screenshots"
ORIGINALS = SCREENSHOTS / "originals"
OUTPUT = SCREENSHOTS / "contact-sheet.jpg"

SECTIONS = (
    ("CrossPoint", "On-device plugin list and WebUI instructions", "crosspoint", 2, 1170, (
        ("Plugin list", "0.5 - Crosspoint Plugin List.jpg"),
        ("WebUI instructions", "0.6 - Crosspoint WEBUI Instructions.jpg"),
    )),
    ("Shared WebUI", "Same browser interface on CrossPoint and Razor-Crest", "webui", 2, 1080, (
        ("Vocabulary", "10 - WebUI Vocabulary.png"),
        ("Highlights", "11 - WebUI Highlights.png"),
    )),
    ("Razor-Crest", "Optional native on-device interface", "razor-crest", 4, 1130, (
        ("Plugin menu", "01 - Plugin Menu.jpg"),
        ("Catalogs", "02 - Catalogs.jpg"),
        ("Vocabulary books", "03 - Voc Book.jpg"),
        ("Saved words", "04 - Voc words.jpg"),
        ("Word options", "04.5 - Word Options.jpg"),
        ("Word definition", "05 - Word Def.jpg"),
        ("Highlight books", "06 - High Book.jpg"),
        ("Saved highlights", "07 - Saved High.jpg"),
        ("Highlight passage", "08 - High Passage.jpg"),
        ("Highlight options", "09 - High Options.jpg"),
    )),
)

WIDTH = 3200
MARGIN = 76
COLUMN_GAP = 34
ROW_GAP = 26
CARD_TOP = 70
CARD_BOTTOM = 26
HEADING_HEIGHT = 124
SECTION_GAP = 50
BG = (246, 247, 249)
WHITE = (255, 255, 255)
TEXT = (31, 41, 55)
MUTED = (95, 105, 118)
BORDER = (222, 227, 233)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
                 ("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def card_height(image_height: int) -> int:
    return CARD_TOP + image_height + CARD_BOTTOM


def total_height() -> int:
    result = 258
    for _title, _subtitle, _dir, cols, height, items in SECTIONS:
        rows = (len(items) + cols - 1) // cols
        result += HEADING_HEIGHT + rows * card_height(height) + (rows - 1) * ROW_GAP + SECTION_GAP
    return result + 50


def main() -> None:
    expected = [ORIGINALS / folder / filename
                for _title, _subtitle, folder, _cols, _height, items in SECTIONS
                for _label, filename in items]
    missing = [str(p) for p in expected if not p.is_file()]
    if missing:
        raise SystemExit("Missing original screenshot(s):\n" + "\n".join(missing))

    canvas = Image.new("RGB", (WIDTH, total_height()), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((MARGIN, 56), "Vocabulary & Highlights", fill=TEXT, font=font(79, True))
    draw.text((MARGIN, 161), "Screenshots grouped by interface", fill=MUTED, font=font(39))
    y = 258

    for title, subtitle, folder, cols, image_height, items in SECTIONS:
        draw.text((MARGIN, y), title, fill=TEXT, font=font(54, True))
        draw.text((MARGIN, y + 68), subtitle, fill=MUTED, font=font(30))
        y += HEADING_HEIGHT
        col_width = (WIDTH - 2 * MARGIN - (cols - 1) * COLUMN_GAP) // cols
        height = card_height(image_height)
        for index, (label, filename) in enumerate(items):
            row, col = divmod(index, cols)
            # Center the final incomplete row instead of leaving an empty right half.
            last_row_items = len(items) % cols
            if row == (len(items) - 1) // cols and last_row_items:
                x = MARGIN + col * (col_width + COLUMN_GAP)
                x += (cols - last_row_items) * (col_width + COLUMN_GAP) // 2
            else:
                x = MARGIN + col * (col_width + COLUMN_GAP)
            top = y + row * (height + ROW_GAP)
            draw.rounded_rectangle((x, top, x + col_width, top + height), radius=19,
                                   fill=WHITE, outline=BORDER, width=2)
            draw.text((x + 25, top + 16), label, fill=TEXT, font=font(38, True))
            with Image.open(ORIGINALS / folder / filename) as original:
                photo = ImageOps.exif_transpose(original).convert("RGB")
                photo.thumbnail((col_width - 34, image_height - 14), Image.Resampling.LANCZOS)
                px = x + (col_width - photo.width) // 2
                py = top + CARD_TOP + (image_height - photo.height) // 2
                canvas.paste(photo, (px, py))
        rows = (len(items) + cols - 1) // cols
        y += rows * height + (rows - 1) * ROW_GAP + SECTION_GAP

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.crop((0, 0, WIDTH, y - SECTION_GAP + 62)).save(OUTPUT, "JPEG", quality=88,
                                                             optimize=True, progressive=True,
                                                             subsampling=0)
    print(f"Created {OUTPUT} from {len(expected)} originals")


if __name__ == "__main__":
    main()
