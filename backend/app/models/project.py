from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

ELECTION_TYPES = (
    "loksabha",
    "vidhan_sabha",
    "nagar_nigam",
    "nagar_palika",
    "nagar_panchayat",
    "gram_panchayat",
    "block",
)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    election_type: Mapped[str] = mapped_column(String(50))
    state: Mapped[str | None] = mapped_column(String(100))
    district: Mapped[str | None] = mapped_column(String(100))
    constituency: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped["Organization"] = relationship(back_populates="projects")
    pdf_imports: Mapped[list["PdfImport"]] = relationship(back_populates="project")
    booths: Mapped[list["Booth"]] = relationship(back_populates="project")
