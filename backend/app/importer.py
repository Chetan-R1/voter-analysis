import tempfile
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import storage
from app.extraction.pipeline import extract_pdf
from app.models import Booth, PdfImport, Voter

BOOTH_FIELDS = (
    "tehsil", "main_village", "assembly_constituency", "zp_constituency",
    "ps_constituency", "booth_no", "booth_name", "ward_boundary",
)


def _upsert_booth(session: Session, cover, project_id: int | None = None) -> Booth:
    key = dict(
        project_id=project_id,
        district=cover.district.strip(),
        panchayat_samiti=cover.panchayat_samiti.strip(),
        gram_panchayat=cover.gram_panchayat.strip(),
        ward_no=cover.ward_no,
    )
    booth = session.scalar(select(Booth).filter_by(**key))
    if booth is None:
        booth = Booth(**key)
        session.add(booth)
    for name in BOOTH_FIELDS:
        setattr(booth, name, getattr(cover, name))
    session.flush()
    return booth


def import_pdf(session: Session, imp: PdfImport) -> PdfImport:
    """Download one PDF from R2, extract it, and replace that ward's voters in Postgres."""
    imp.status = "processing"
    session.commit()
    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ward.pdf"
            storage.download_file(imp.r2_key, path)
            result = extract_pdf(path, imp.sha256)

        if result.cover is None:
            raise ValueError("cover page not found; is this a ward roll PDF?")

        booth = _upsert_booth(session, result.cover, project_id=imp.project_id)
        # Re-importing a ward replaces its voters (their relationships cascade away and get rebuilt).
        session.execute(delete(Voter).where(Voter.booth_id == booth.id))
        session.add_all(Voter(booth_id=booth.id, import_id=imp.id, **asdict(v)) for v in result.voters)
        session.flush()

        issues = list(result.issues)
        epics = [v.epic_no for v in result.voters]
        for epic, ward_no, gp in session.execute(
            select(Voter.epic_no, Booth.ward_no, Booth.gram_panchayat)
            .join(Booth)
            .where(Voter.epic_no.in_(epics), Voter.booth_id != booth.id)
        ):
            issues.append(f"EPIC {epic} also appears in {gp} ward {ward_no}")

        imp.booth_id = booth.id
        imp.total_voters = result.active_count
        imp.errors = issues
        imp.status = "review" if issues else "done"
        imp.imported_at = datetime.now(timezone.utc)
        session.commit()
    except Exception as e:
        session.rollback()
        imp.status = "failed"
        imp.errors = [f"{type(e).__name__}: {e}"]
        session.commit()
    return imp
