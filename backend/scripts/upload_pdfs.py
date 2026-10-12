"""Upload every PDF in a folder to R2 and register it for import.

Usage: python -m scripts.upload_pdfs <folder>

Files whose content was already uploaded (same SHA-256) are skipped.
"""

import argparse
from pathlib import Path

from sqlalchemy import select

from app import storage
from app.db import SessionLocal
from app.extraction.pdf_utils import file_sha256
from app.models import PdfImport


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path)
    args = parser.parse_args()

    pdfs = sorted(args.folder.glob("*.pdf"))
    if not pdfs:
        raise SystemExit(f"No PDFs found in {args.folder}")

    with SessionLocal() as session:
        for path in pdfs:
            sha = file_sha256(path)
            if session.scalar(select(PdfImport).where(PdfImport.sha256 == sha)):
                print(f"skip (already uploaded)  {path.name}")
                continue
            key = f"pdfs/{sha[:12]}-{path.name}"
            storage.upload_file(path, key)
            session.add(PdfImport(r2_key=key, file_name=path.name, sha256=sha))
            session.commit()
            print(f"uploaded                 {path.name} -> {key}")


if __name__ == "__main__":
    main()
