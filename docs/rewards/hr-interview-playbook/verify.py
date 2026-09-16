"""Checks on the rendered PDF, plus PNG proofs for visual review.

The text checks exist because v1 shipped defects that look fine on screen and
only show up in the file: a headline that copied out doubled, an index pointing
at moved pages, an empty stage label.

Run: python docs/rewards/hr-interview-playbook/verify.py
"""
import pathlib
import re
import sys

import fitz

HERE = pathlib.Path(__file__).parent
PDF = HERE / "dist" / "HR-Interview-Cheat-Code-v2.pdf"
PREVIEW = HERE / "dist" / "preview"


def main() -> int:
    if not PDF.exists():
        print(f"missing {PDF}")
        return 1

    doc = fitz.open(PDF)
    problems: list[str] = []
    PREVIEW.mkdir(parents=True, exist_ok=True)
    for old in PREVIEW.glob("page-*.png"):
        old.unlink()

    pages_text = []
    for number, page in enumerate(doc, start=1):
        text = page.get_text()
        pages_text.append(text)
        page.get_pixmap(dpi=110).save(PREVIEW / f"page-{number:02d}.png")

        # A run of doubled characters is the signature of v1's stacked-outline
        # headline: "CHEATCODE" extracted as "CCHHEEAATTCCOODDEE".
        for match in re.finditer(r"(?:([A-Za-z])\1){4,}", text):
            problems.append(f"page {number}: doubled text {match.group(0)!r}")

        for token in ("undefined", "NaN", "[object Object]", "&amp;", "&middot;"):
            if token in text:
                problems.append(f"page {number}: raw token {token!r} leaked into the text")

        # Every page but the covers carries a footer counter.
        if number not in (1, len(doc)) and f"{number:02d} / {len(doc):02d}" not in text.replace("\n", " "):
            problems.append(f"page {number}: footer page counter missing")

    # A repeated line is how stroked or stacked text betrays itself in the file
    # even when it looks right on screen — v1's cover headline copied twice.
    for number, text in enumerate(pages_text, start=1):
        # Long lines only: short labels legitimately repeat (a card's tag and its
        # heading), while a doubled body line never does.
        lines = [line.strip() for line in text.splitlines() if len(line.strip()) > 12]
        for first, second in zip(lines, lines[1:]):
            if first == second:
                problems.append(f"page {number}: line printed twice in the text layer: {first!r}")

    # The index must point at the page each blueprint actually landed on. Its
    # rows are laid out in columns, so rebuild each row from word coordinates.
    middle = doc[1].rect.width / 2
    words = [(x0, y0, word) for x0, y0, _x1, _y1, word, *_ in doc[1].get_text("words")]
    ids = re.compile(r"^(Q\d\d|R\d|B\d|WS|FIN)$")
    index_rows = []
    for x0, y0, word in words:
        if not ids.match(word):
            continue
        same_row = [
            (wx, ww)
            for wx, wy, ww in words
            if abs(wy - y0) < 5 and wx > x0 and (wx < middle) == (x0 < middle)
        ]
        same_row.sort()
        title = " ".join(ww for _, ww in same_row if not re.fullmatch(r"\d{2}", ww))
        numbers = [ww for _, ww in same_row if re.fullmatch(r"\d{2}", ww)]
        if numbers:
            index_rows.append((word, title, int(numbers[-1])))
    listed = 0
    for target, title, page_no in index_rows:
        listed += 1
        if not 1 <= page_no <= len(doc):
            problems.append(f"index: {target} points at page {page_no}, outside the book")
        elif title.split()[0].lower() not in pages_text[page_no - 1].lower():
            problems.append(f"index: {target} points at page {page_no}, which does not contain {title!r}")
    if listed < 16:
        problems.append(f"index lists {listed} entries, expected at least 16")

    # Fonts, read from the spans that actually carry text. A fallback font or a
    # Type3 font means glyphs the book asked for were not embedded.
    used, stray_glyphs = set(), set()
    allowed = re.compile("[\x20-\x7e\u00a0-\u024f\u2000-\u206f\u20a0-\u20bf\\s]*$")
    for number, page in enumerate(doc, start=1):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    used.add(span["font"])
                    if span["font"].startswith("Type3"):
                        problems.append(f"page {number}: text rendered as Type3 font (not embedded properly)")
                    if not allowed.match(span["text"]):
                        stray_glyphs.add((number, "".join(c for c in span["text"] if not allowed.match(c))))

    for family in ("Manrope", "JetBrains", "Jakarta"):
        if not any(family.lower() in name.lower() for name in used):
            problems.append(f"font not embedded: {family}")
    for name in used:
        if any(fallback in name for fallback in ("Consolas", "SegoeUI", "Arial", "TimesNewRoman")):
            problems.append(f"system fallback font in use: {name}")
    for number, glyphs in sorted(stray_glyphs):
        problems.append(f"page {number}: glyph outside the embedded subsets: {glyphs!r}")

    problems = list(dict.fromkeys(problems))
    fonts = used

    print(f"pages: {len(doc)}  size: {PDF.stat().st_size / 1024:.0f} KB")
    print(f"fonts embedded: {', '.join(sorted(fonts))}")
    print(f"previews: {PREVIEW}")
    if problems:
        print(f"\nPROBLEMS ({len(problems)}):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("\nall checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
