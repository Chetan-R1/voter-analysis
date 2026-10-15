"""Turn one ward PDF into clean voter records.

LLM vision reads every page (names need it, the text layer is garbled); the text layer is then
used to verify serial/EPIC/age/house/gender/relation, and the cover + summary pages are used to
verify the counts. Everything suspicious ends up in `issues` for human review.
"""

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from app.config import get_settings
from app.extraction.llm import extract_pdf_direct
from app.extraction.pdf_utils import file_sha256, page_texts
from app.extraction.schemas import CoverInfo, SummaryInfo, VoterEntry
from app.extraction.text_layer import TextRecord, normalize_digits, parse_voter_page

STATUS_BY_CODE = {"E": "deleted_death", "S": "deleted_shifted", "R": "deleted_repeat"}
CHECKED_FIELDS = ("epic_no", "age", "house_no", "gender", "relation_type")


@dataclass
class ExtractedVoter:
    serial_no: int
    epic_no: str
    name: str
    name_en: str
    relative_name: str
    relative_name_en: str
    relation_type: str
    house_no: str
    age: int
    gender: str
    hamlet: str | None
    page_no: int
    status: str = "active"


@dataclass
class ExtractionResult:
    sha256: str
    page_count: int
    cover: CoverInfo | None
    summary: SummaryInfo | None
    voters: list[ExtractedVoter]
    issues: list[str] = field(default_factory=list)

    @property
    def active_count(self) -> int:
        return sum(v.status == "active" for v in self.voters)


def _to_voter(entry: VoterEntry, hamlet: str | None, page_no: int) -> ExtractedVoter:
    return ExtractedVoter(
        serial_no=entry.serial_no,
        epic_no=entry.epic_no.replace(" ", "").upper(),
        name=entry.name.strip(),
        name_en=entry.name_en.strip(),
        relative_name=entry.relative_name.strip(),
        relative_name_en=entry.relative_name_en.strip(),
        relation_type=entry.relation_type,
        house_no=normalize_digits(entry.house_no),
        age=entry.age,
        gender=entry.gender,
        hamlet=hamlet.strip() if hamlet else None,
        page_no=page_no,
    )


def _reconcile(v: ExtractedVoter, tr: TextRecord, issues: list[str]) -> None:
    """The text layer is exact for these fields, so it wins on disagreement."""
    for name in CHECKED_FIELDS:
        text_value = getattr(tr, name)
        if text_value is not None and getattr(v, name) != text_value:
            issues.append(
                f"page {v.page_no} #{v.serial_no}: {name} LLM={getattr(v, name)!r} "
                f"text={text_value!r} (using text)"
            )
            setattr(v, name, text_value)


def _check_counts(result: ExtractionResult) -> None:
    cover, summary, issues = result.cover, result.summary, result.issues
    serials = {v.serial_no for v in result.voters}

    if cover and cover.first_serial and cover.last_serial:
        missing = sorted(set(range(cover.first_serial, cover.last_serial + 1)) - serials)
        if missing:
            issues.append(f"missing serial numbers: {missing}")

    active = Counter(v.gender for v in result.voters if v.status == "active")
    expected_final = [
        (cover.male if cover else None, active["male"], "active male"),
        (cover.female if cover else None, active["female"], "active female"),
        (cover.total if cover else None, result.active_count, "active total"),
        (summary.final_total if summary else None, result.active_count, "summary final total"),
    ]
    original = [v for v in result.voters if not cover or not cover.last_serial or v.serial_no <= cover.last_serial]
    if summary:
        expected_final.append((summary.original_total, len(original), "original list total"))
    for expected, actual, label in expected_final:
        if expected is not None and expected != actual:
            issues.append(f"count mismatch ({label}): PDF says {expected}, extracted {actual}")


def extract_pdf(path: Path, sha256: str | None = None) -> ExtractionResult:
    s = get_settings()
    sha256 = sha256 or file_sha256(path)
    texts = page_texts(path)
    n = len(texts)

    # Send whole PDF to Gemini in one call — no image conversion needed
    pages = extract_pdf_direct(path, sha256[:16])

    result = ExtractionResult(
        sha256=sha256,
        page_count=n,
        cover=next((p.cover for p in pages if p.cover), None),
        summary=next((p.summary for p in reversed(pages) if p.summary), None),
        voters=[],
    )
    issues = result.issues
    if result.cover is None:
        issues.append("cover page not found")

    by_serial: dict[int, ExtractedVoter] = {}
    deletion_codes: dict[int, str] = {}
    hamlet: str | None = None

    for page_no, (page, text) in enumerate(zip(pages, texts), start=1):
        if page.page_type == "voters":
            text_records = parse_voter_page(text)
            for entry in page.voters:
                # A heading applies until the next one, including across page breaks.
                hamlet = entry.hamlet or hamlet
                v = _to_voter(entry, hamlet, page_no)
                tr = text_records.pop(v.serial_no, None)
                if tr:
                    _reconcile(v, tr, issues)
                else:
                    issues.append(f"page {page_no} #{v.serial_no}: not found in PDF text layer")
                if v.serial_no in by_serial:
                    issues.append(f"page {page_no} #{v.serial_no}: duplicate serial number")
                    continue
                mark = entry.deletion_mark or (tr.deletion_mark if tr else None)
                if mark:
                    deletion_codes[v.serial_no] = mark
                by_serial[v.serial_no] = v
            for tr in text_records.values():
                issues.append(f"page {page_no} #{tr.serial_no} ({tr.epic_no}): in PDF text but missed by LLM")

        elif page.page_type == "supplement":
            for d in page.deletions:
                deletion_codes[d.serial_no] = d.code
                listed = by_serial.get(d.serial_no)
                if listed and listed.epic_no != d.epic_no.replace(" ", "").upper():
                    issues.append(f"deletion #{d.serial_no}: EPIC {d.epic_no} doesn't match main list {listed.epic_no}")
            for entry in page.additions:
                v = _to_voter(entry, entry.hamlet, page_no)
                if v.serial_no in by_serial:
                    issues.append(f"addition #{v.serial_no} clashes with an existing serial number")
                    continue
                by_serial[v.serial_no] = v

    for serial, code in deletion_codes.items():
        if serial in by_serial:
            by_serial[serial].status = STATUS_BY_CODE[code]
        else:
            issues.append(f"deletion #{serial} ({code}) refers to a serial not in the list")

    result.voters = [by_serial[k] for k in sorted(by_serial)]
    _check_counts(result)
    return result
