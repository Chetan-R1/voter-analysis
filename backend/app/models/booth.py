from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Booth(Base):
    __tablename__ = "booths"
    __table_args__ = (
        UniqueConstraint("project_id", "district", "panchayat_samiti", "gram_panchayat", "ward_no", name="uq_booth_ward"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
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
    total_voter_count: Mapped[int | None]
    total_male_voters: Mapped[int | None]
    total_female_voters: Mapped[int | None]
    total_third_gender_voters: Mapped[int | None]

    project: Mapped["Project"] = relationship(back_populates="booths")
    voters: Mapped[list["Voter"]] = relationship(back_populates="booth")
