"""Dry-run extraction on a local PDF (no R2, no database) and write the result to JSON.

Usage: python -m scripts.extract_local <file.pdf> [-o output/ward.json]
"""

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from app.extraction.pipeline import extract_pdf


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    args = parser.parse_args()

    result = extract_pdf(args.pdf)
    output = args.output or Path("output") / f"{args.pdf.stem}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "cover": result.cover.model_dump() if result.cover else None,
        "summary": result.summary.model_dump() if result.summary else None,
        "issues": result.issues,
        "voters": [asdict(v) for v in result.voters],
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    c = result.cover
    if c:
        print(f"{c.district} / {c.panchayat_samiti} / {c.gram_panchayat} / ward {c.ward_no} (booth {c.booth_no})")
    print(f"{result.page_count} pages, {len(result.voters)} voters, {result.active_count} active")
    print(f"{len(result.issues)} issue(s)")
    for issue in result.issues:
        print(f"  - {issue}")
    print(f"written to {output}")


if __name__ == "__main__":
    main()
