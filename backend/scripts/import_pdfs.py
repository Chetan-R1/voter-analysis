"""Extract uploaded PDFs from R2 into Postgres.

Usage:
  python -m scripts.import_pdfs              # new uploads only
  python -m scripts.import_pdfs --retry      # also retry failed ones
  python -m scripts.import_pdfs --all        # re-import everything
"""

import argparse

from sqlalchemy import select

from app.db import SessionLocal
from app.importer import import_pdf
from app.models import PdfImport


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retry", action="store_true", help="also retry failed imports")
    parser.add_argument("--all", action="store_true", help="re-import every PDF")
    args = parser.parse_args()

    statuses = ["uploaded"] + (["failed"] if args.retry else [])
    with SessionLocal() as session:
        query = select(PdfImport).order_by(PdfImport.id)
        if not args.all:
            query = query.where(PdfImport.status.in_(statuses))
        imports = session.scalars(query).all()
        if not imports:
            print("Nothing to import.")
            return

        for imp in imports:
            print(f"importing {imp.file_name} ...", flush=True)
            import_pdf(session, imp)
            print(f"  -> {imp.status}, {imp.total_voters or 0} active voters, {len(imp.errors)} issue(s)")
            for issue in imp.errors[:20]:
                print(f"     - {issue}")
            if len(imp.errors) > 20:
                print(f"     ... {len(imp.errors) - 20} more (see pdf_imports.errors)")


if __name__ == "__main__":
    main()
