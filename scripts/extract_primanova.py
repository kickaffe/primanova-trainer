from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DOCX_PATH = ROOT / "primanova-833.docx"
OUTPUT_PATH = ROOT / "data" / "primanova-data.js"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

MANUAL_LESSON_1 = {
    "lesson": 1,
    "title": "Treffpunkte im alten Rom",
    "cards": [
        {"latin": "senātor, senātōris m", "meaning": "Senator"},
        {"latin": "forum", "meaning": "Marktplatz, Forum, Oeffentlichkeit"},
        {"latin": "properāre, properat", "meaning": "eilen, sich beeilen"},
        {"latin": "nam", "meaning": "denn, naemlich"},
        {"latin": "ibī", "meaning": "dort"},
        {"latin": "cūria", "meaning": "Kurie, Rathaus"},
        {"latin": "esse, est", "meaning": "sein"},
        {"latin": "hīc", "meaning": "hier"},
        {"latin": "turba", "meaning": "Menschenmenge, Laerm, Verwirrung"},
        {"latin": "stāre, stat", "meaning": "stehen"},
        {"latin": "et", "meaning": "und, auch"},
        {"latin": "clāmāre, clāmat", "meaning": "laut rufen, schreien"},
        {"latin": "avē!", "meaning": "sei gegruesst"},
        {"latin": "gaudēre, gaudet", "meaning": "sich freuen"},
        {"latin": "salvē!", "meaning": "sei gegruesst"},
        {"latin": "salvēte!", "meaning": "seid gegruesst"},
        {"latin": "subitō", "meaning": "ploetzlich"},
        {"latin": "servus", "meaning": "Sklave"},
        {"latin": "adesse, adest", "meaning": "da sein"},
        {"latin": "rogāre, rogat", "meaning": "bitten, erbitten, fragen"},
        {"latin": "ubī?", "meaning": "wo?"},
        {"latin": "rīdēre, rīdet", "meaning": "lachen, auslachen"},
        {"latin": "tum", "meaning": "da, damals, darauf, dann"},
    ],
}


def read_docx_lines(path: Path) -> list[str]:
    with ZipFile(path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)

    lines: list[str] = []
    for para in root.findall(".//w:p", NS):
        text = "".join(node.text or "" for node in para.findall(".//w:t", NS)).strip()
        if text:
            lines.append(text)
    return lines


def lesson_title(raw: str) -> tuple[int, str]:
    match = re.match(r"^(\d+)\s*T\s*(.*)$", raw)
    if not match:
        raise ValueError(f"Unexpected lesson headline: {raw}")
    return int(match.group(1)), match.group(2).strip()


def normalize_ascii(text: str) -> str:
    replacements = {
        "ä": "ae",
        "ö": "oe",
        "ü": "ue",
        "Ä": "Ae",
        "Ö": "Oe",
        "Ü": "Ue",
        "ß": "ss",
        "’": "'",
        "„": '"',
        "“": '"',
        "…": "...",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def slugify(text: str) -> str:
    ascii_text = normalize_ascii(text)
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "card"


def parse_lessons(lines: list[str], max_lesson: int = 23) -> list[dict]:
    start_index = lines.index("Treffpunkte im alten Rom")
    active_lesson: dict | None = None
    lessons: list[dict] = [MANUAL_LESSON_1]
    pending_latin: str | None = None

    for raw in lines[start_index + 1 :]:
        line = raw.strip()
        if not line or line == "↑":
            continue

        if re.match(r"^\d+\s*T", line):
            lesson_no, title = lesson_title(line)
            if lesson_no > max_lesson:
                break
            active_lesson = {"lesson": lesson_no, "title": title, "cards": []}
            lessons.append(active_lesson)
            pending_latin = None
            continue

        if active_lesson is None:
            continue

        if pending_latin is None:
            pending_latin = line
        else:
            active_lesson["cards"].append(
                {
                    "latin": pending_latin,
                    "meaning": line,
                }
            )
            pending_latin = None

    for lesson in lessons:
        for index, card in enumerate(lesson["cards"], start=1):
            base = slugify(card["latin"])
            card["id"] = f"l{lesson['lesson']}-{index}-{base}"

    return lessons


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = read_docx_lines(DOCX_PATH)
    lessons = parse_lessons(lines)
    payload = "window.PRIMA_NOVA_DATA = " + json.dumps(
        lessons, ensure_ascii=False, indent=2
    ) + ";\n"
    OUTPUT_PATH.write_text(payload, encoding="utf-8")
    print(f"Wrote {len(lessons)} lessons to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
