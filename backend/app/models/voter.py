from sqlalchemy import Float, ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


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
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | deleted_death | deleted_shifted | deleted_repeat
    page_no: Mapped[int | None]
    data: Mapped[dict | None] = mapped_column(JSON)

    booth: Mapped["Booth"] = relationship(back_populates="voters")


class Family(Base):
    """One family group = one household (same house_no in a booth)."""
    __tablename__ = "family"
    __table_args__ = (
        UniqueConstraint("booth_id", "house_no", name="uq_family_booth_house"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booth_id: Mapped[int] = mapped_column(ForeignKey("booths.id", ondelete="CASCADE"), index=True)
    house_no: Mapped[str] = mapped_column(String(20))
    member_count: Mapped[int] = mapped_column(default=0)
    member_list: Mapped[list | None] = mapped_column(JSON)  # list of voter ids
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    accuracy: Mapped[float] = mapped_column(Float, default=0.0)

    members: Mapped[list["VotersFamily"]] = relationship(back_populates="family", cascade="all, delete-orphan")


# Relationship enum values
RELATIONSHIP_TYPES = [
    "father", "mother", "wife", "husband",
    "son", "daughter", "brother", "sister",
    "not_specified",
]


class VotersFamily(Base):
    """Pairwise relationship between two voters within a family."""
    __tablename__ = "voters_family"
    __table_args__ = (
        UniqueConstraint("family_id", "voter_id", "voter_id2", name="uq_voters_family"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id", ondelete="CASCADE"), index=True)
    voter_id: Mapped[int] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"), index=True)
    voter_id2: Mapped[int] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"), index=True)
    relation: Mapped[str] = mapped_column(String(20))  # see RELATIONSHIP_TYPES
    voter1_identity: Mapped[str | None] = mapped_column(Text)
    voter2_identity: Mapped[str | None] = mapped_column(Text)

    family: Mapped["Family"] = relationship(back_populates="members")


class BoothVoterJn(Base):
    """Explicit junction between booth and voter."""
    __tablename__ = "booth_voter_jn"
    __table_args__ = (
        UniqueConstraint("booth_id", "voter_id", name="uq_booth_voter"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booth_id: Mapped[int] = mapped_column(ForeignKey("booths.id", ondelete="CASCADE"), index=True)
    voter_id: Mapped[int] = mapped_column(ForeignKey("voters.id", ondelete="CASCADE"), index=True)
