"""Parse the PDF's own text layer for cross-checking the LLM.

The Hindi in these PDFs uses a legacy font, so extracted Devanagari is garbled (नाम -> "नरम")
and names can't be recovered. But the garbling is consistent, and the Latin/numeric parts
(EPIC, serial, age, house no.) come out exactly, so we use them to verify the LLM output.
"""

import re
from dataclasses import dataclass

EPIC_PATTERN = r"RJ/\d{2}/\d{3}/\d{6}|[A-Z]{3}\d{7}"

# Each voter box ends with: EPIC, "Photo is Available", then the serial (optionally "E 28").
RECORD_END_RE = re.compile(
    rf"(?P<epic>{EPIC_PATTERN})\s*Photo is\s*Available\s*(?:(?P<mark>[ESR])\s+)?(?P<serial>\d+)"
)
AGE_RE = re.compile(r"आजच:\s*(?P<age>\d+)\s*(?P<gender>\S+)?")
DIGITS_ONLY_RE = re.compile(r"^[0-9०-९]+$")

# Garbled forms of the printed labels.
FATHER_LABEL = "नपतर कर नरम"  # पिता का नाम
HUSBAND_LABEL = "पनत कर नरम"  # पति का नाम

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


@dataclass
class TextRecord:
    serial_no: int
    epic_no: str
    deletion_mark: str | None
    age: int | None
    gender: str | None
    relation_type: str | None
    house_no: str | None


def normalize_digits(value: str) -> str:
    return value.translate(DEVANAGARI_DIGITS).strip()


def _gender(token: str | None) -> str | None:
    if not token:
        return None
    if token.startswith("पच"):  # पुरुष
        return "male"
    if token in ("सल", "सस"):  # स्त्री
        return "female"
    if token.startswith("ततत"):  # तृतीय लिंग
        return "third"
    return None


def _parse_chunk(chunk: str) -> tuple[int | None, str | None, str | None, str | None]:
    age = gender = relation = house = None

    if FATHER_LABEL in chunk:
        relation = "father"
    elif HUSBAND_LABEL in chunk:
        relation = "husband"

    lines = [line.strip() for line in chunk.splitlines()]
    age_idx = None
    for i, line in enumerate(lines):
        m = AGE_RE.search(line)
        if m:
            age, gender, age_idx = int(m["age"]), _gender(m["gender"]), i

    # House number is the first digits-only line after the age line.
    search_from = age_idx + 1 if age_idx is not None else 0
    for line in lines[search_from:]:
        if DIGITS_ONLY_RE.match(line):
            house = normalize_digits(line)
            break

    return age, gender, relation, house


def parse_voter_page(text: str) -> dict[int, TextRecord]:
    """Return text-layer records keyed by serial number."""
    records: dict[int, TextRecord] = {}
    start = 0
    for m in RECORD_END_RE.finditer(text):
        age, gender, relation, house = _parse_chunk(text[start:m.start()])
        serial = int(m["serial"])
        records[serial] = TextRecord(
            serial_no=serial,
            epic_no=m["epic"],
            deletion_mark=m["mark"],
            age=age,
            gender=gender,
            relation_type=relation,
            house_no=house,
        )
        start = m.end()
    return records
