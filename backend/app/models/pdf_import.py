from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PdfImport(Base):
    __tablename__ = "pdf_imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    r2_key: Mapped[str] = mapped_column(String(500), unique=True)
    file_name: Mapped[str] = mapped_column(String(300))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    booth_id: Mapped[int | None] = mapped_column(ForeignKey("booths.id", ondelete="SET NULL"))
    # uploaded -> processing -> done | review | failed
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    total_voters: Mapped[int | None]
    errors: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project | None"] = relationship(back_populates="pdf_imports")
