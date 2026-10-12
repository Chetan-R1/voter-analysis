from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Booth(Base):
    """One ward of a gram panchayat and its polling booth (one ward PDF = one row)."""

    __tablename__ = "booths"
    __table_args__ = (
        UniqueConstraint(
            "district", "panchayat_samiti", "gram_panchayat", "ward_no", name="uq_booth_ward"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    district: Mapped[str] = mapped_column(String(100))
    panchayat_samiti: Mapped[str] = mapped_column(String(100))
    gram_panchayat: Mapped[str] = mapped_column(String(100))
    ward_no: Mapped[int]
    tehsil: Mapped[str | None] = mapped_column(String(100))
    main_village: Mapped[str | None] = mapped_column(String(100))
    assembly_constituency: Mapped[str | None] = mapped_column(String(100))
    zp_constituency: Mapped[int | None]
    ps_constituency: Mapped[int | None]
    booth_no: Mapped[int | None]
    booth_name: Mapped[str | None] = mapped_column(Text)
    ward_boundary: Mapped[str | None] = mapped_column(Text)

    voters: Mapped[list["Voter"]] = relationship(back_populates="booth")


class PdfImport(Base):
    __tablename__ = "pdf_imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    r2_key: Mapped[str] = mapped_column(String(500), unique=True)
    file_name: Mapped[str] = mapped_column(String(300))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    booth_id: Mapped[int | None] = mapped_column(ForeignKey("booths.id", ondelete="SET NULL"))
    # uploaded -> processing -> done | review (imported with warnings) | failed
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    total_voters: Mapped[int | None]
    errors: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Voter(Base):
    __tablename__ = "voters"
    __table_args__ = (
        UniqueConstraint("booth_id", "serial_no", name="uq_voter_booth_serial"),
        UniqueConstraint("booth_id", "epic_no", name="uq_voter_booth_epic"),
        Index("ix_voters_epic_no", "epic_no"),
        Index("ix_voters_booth_house", "booth_id", "house_no"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booth_id: Mapped[int] = mapped_column(ForeignKey("booths.id", ondelete="CASCADE"))
    import_id: Mapped[int | None] = mapped_column(ForeignKey("pdf_imports.id", ondelete="SET NULL"))
    serial_no: Mapped[int]
    epic_no: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    relative_name: Mapped[str | None] = mapped_column(String(200))
    relative_name_en: Mapped[str | None] = mapped_column(String(200))
    relation_type: Mapped[str | None] = mapped_column(String(10))  # father | husband | mother | other
    house_no: Mapped[str | None] = mapped_column(String(20))
    age: Mapped[int | None]
    gender: Mapped[str | None] = mapped_column(String(10))  # male | female | third
    hamlet: Mapped[str | None] = mapped_column(String(200))
    # active | deleted_death | deleted_shifted | deleted_repeat
    status: Mapped[str] = mapped_column(String(20), default="active")
    page_no: Mapped[int | None]

    booth: Mapped[Booth] = relationship(back_populates="voters")


class VoterRelationship(Base):
    """Inferred link: `related_voter` is the `relation` of `voter` (e.g. father, wife, brother)."""

    __tablename__ = "relationships"
    __table_args__ = (
        UniqueConstraint("voter_id", "related_voter_id", "relation", name="uq_relationship"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    voter_id: Mapped[int] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"), index=True)
    related_voter_id: Mapped[int] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"))
    relation: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(50))


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
