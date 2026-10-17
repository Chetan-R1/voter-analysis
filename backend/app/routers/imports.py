"""PDF upload + import status endpoints."""

import hashlib
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.auth import get_current_user, get_db
from app.models import PdfImport, User, Booth

router = APIRouter(prefix="", tags=["imports"])


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _r2_configured() -> bool:
    from app.config import get_settings
    s = get_settings()
    return bool(s.r2_account_id and s.r2_access_key_id and s.r2_secret_access_key)


@router.post("/imports/presign")
def presign_upload(
    file_name: str,
    project_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return a presigned R2 PUT URL so the browser can upload directly."""
    if not _r2_configured():
        raise HTTPException(status_code=400, detail="R2 not configured")
    if not file_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    from app import storage
    import uuid
    key = f"pdfs/{uuid.uuid4().hex[:12]}-{file_name}"
    url = storage.presigned_put_url(key, expires=900)
    return {"upload_url": url, "key": key, "project_id": project_id}


@router.post("/imports/register")
def register_upload(
    body: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Called after browser finishes uploading to R2. Registers import and starts extraction."""
    key: str = body.get("key", "")
    file_name: str = body.get("file_name", key.split("/")[-1])
    project_id: int | None = body.get("project_id")

    if not key:
        raise HTTPException(status_code=400, detail="key required")

    existing = db.scalar(select(PdfImport).where(PdfImport.r2_key == key))
    if existing:
        return {"id": existing.id, "skipped": True}

    imp = PdfImport(project_id=project_id, r2_key=key, file_name=file_name, sha256="")
    db.add(imp); db.commit(); db.refresh(imp)
    background_tasks.add_task(_run_import, imp.id)
    return {"id": imp.id, "file_name": file_name, "status": imp.status, "skipped": False}


def _run_import(import_id: int):
    """Background task: download from R2 and extract."""
    from app.db import SessionLocal
    from app.importer import import_pdf

    with SessionLocal() as session:
        imp = session.get(PdfImport, import_id)
        if imp:
            import_pdf(session, imp)


@router.post("/imports/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    data = await file.read()
    sha = _sha256(data)

    # Skip if already uploaded
    existing = db.scalar(select(PdfImport).where(PdfImport.sha256 == sha))
    if existing:
        return {
            "id": existing.id,
            "file_name": existing.file_name,
            "status": existing.status,
            "skipped": True,
            "message": "Already uploaded",
        }

    # Save to temp and upload to R2
    try:
        from app import storage
        from app.config import get_settings
        s = get_settings()

        key = f"pdfs/{sha[:12]}-{file.filename}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)

        storage.upload_file(tmp_path, key)
        tmp_path.unlink(missing_ok=True)

        imp = PdfImport(project_id=project_id, r2_key=key, file_name=file.filename, sha256=sha)
        db.add(imp)
        db.commit()
        db.refresh(imp)

        # Kick off extraction in background
        background_tasks.add_task(_run_import, imp.id)

        return {
            "id": imp.id,
            "file_name": imp.file_name,
            "status": imp.status,
            "skipped": False,
            "message": "Upload successful, processing started",
        }

    except RuntimeError as e:
        # R2 not configured — save locally and process directly
        if "R2 credentials missing" not in str(e):
            raise

        # Local fallback: save to pdfs/ folder
        local_dir = Path(__file__).resolve().parents[3] / "pdfs"
        local_dir.mkdir(exist_ok=True)
        local_path = local_dir / (file.filename or "upload.pdf")
        local_path.write_bytes(data)

        imp = PdfImport(project_id=project_id, r2_key=f"local/{file.filename}", file_name=file.filename or "upload.pdf", sha256=sha)
        db.add(imp)
        db.commit()
        db.refresh(imp)

        background_tasks.add_task(_run_local_import, imp.id, str(local_path))

        return {
            "id": imp.id,
            "file_name": imp.file_name,
            "status": imp.status,
            "skipped": False,
            "message": "Upload successful (local mode), processing started",
        }


def _run_local_import(import_id: int, pdf_path: str):
    """Background task: extract from local file (when R2 not configured)."""
    import json
    from dataclasses import asdict
    from datetime import datetime, timezone
    from sqlalchemy import delete

    from app.db import SessionLocal
    from app.extraction.pipeline import extract_pdf
    from app.extraction.pdf_utils import file_sha256
    from app.models import Voter, Booth
    from app.importer import _upsert_booth

    path = Path(pdf_path)
    with SessionLocal() as session:
        imp = session.get(PdfImport, import_id)
        if not imp:
            return
        imp.status = "processing"
        session.commit()
        try:
            result = extract_pdf(path, imp.sha256)
            if result.cover is None:
                raise ValueError("Cover page not found")

            booth = _upsert_booth(session, result.cover, project_id=imp.project_id)
            session.execute(delete(Voter).where(Voter.booth_id == booth.id))
            session.add_all(
                Voter(booth_id=booth.id, import_id=imp.id, **asdict(v))
                for v in result.voters
            )
            session.flush()

            imp.booth_id = booth.id
            imp.total_voters = result.active_count
            imp.errors = result.issues
            imp.status = "review" if result.issues else "done"
            imp.imported_at = datetime.now(timezone.utc)
            session.commit()
        except Exception as e:
            session.rollback()
            imp.status = "failed"
            imp.errors = [f"{type(e).__name__}: {e}"]
            session.commit()


@router.get("/imports")
def list_imports(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    imports = db.scalars(select(PdfImport).order_by(PdfImport.id.desc())).all()
    result = []
    for imp in imports:
        booth = db.get(Booth, imp.booth_id) if imp.booth_id else None
        result.append({
            "id": imp.id,
            "file_name": imp.file_name,
            "status": imp.status,
            "total_voters": imp.total_voters,
            "issues": len(imp.errors) if imp.errors else 0,
            "imported_at": imp.imported_at.isoformat() if imp.imported_at else None,
            "ward": f"{booth.gram_panchayat} - Ward {booth.ward_no}" if booth else None,
        })
    return result


@router.get("/imports/{import_id}")
def get_import(
    import_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    imp = db.get(PdfImport, import_id)
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    return {
        "id": imp.id,
        "file_name": imp.file_name,
        "status": imp.status,
        "total_voters": imp.total_voters,
        "errors": imp.errors,
        "imported_at": imp.imported_at.isoformat() if imp.imported_at else None,
    }


@router.post("/imports/{import_id}/retry")
def retry_import(
    import_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    imp = db.get(PdfImport, import_id)
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    if imp.status not in ("failed", "review", "processing", "uploaded"):
        raise HTTPException(status_code=400, detail=f"Cannot retry import with status '{imp.status}'")

    imp.status = "uploaded"
    imp.errors = []
    imp.total_voters = None
    db.commit()

    if imp.r2_key.startswith("local/"):
        local_path = Path(__file__).resolve().parents[3] / "pdfs" / imp.file_name
        background_tasks.add_task(_run_local_import, imp.id, str(local_path))
    else:
        background_tasks.add_task(_run_import, imp.id)

    return {"id": imp.id, "status": "uploaded", "message": "Retry started"}


@router.delete("/imports/{import_id}")
def delete_import(
    import_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    imp = db.get(PdfImport, import_id)
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    if imp.status in ("processing", "uploaded"):
        raise HTTPException(status_code=400, detail="Cannot delete an import that is currently processing")
    db.delete(imp)
    db.commit()
    return {"message": "Deleted"}
