import hashlib
from pathlib import Path

import pymupdf


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def render_pages(path: Path, dpi: int) -> list[bytes]:
    with pymupdf.open(path) as doc:
        return [page.get_pixmap(dpi=dpi).tobytes("png") for page in doc]


def page_texts(path: Path) -> list[str]:
    with pymupdf.open(path) as doc:
        return [page.get_text("text") for page in doc]
