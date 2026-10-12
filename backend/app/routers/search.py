"""Flexible voter search + ward listing with filters and sorting."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db
from app.models import Booth, User, Voter

router = APIRouter(tags=["search"])


def _booth_out(b: Booth) -> dict:
    return {
        "id": b.id,
        "district": b.district,
        "panchayat_samiti": b.panchayat_samiti,
        "gram_panchayat": b.gram_panchayat,
        "ward_no": b.ward_no,
        "booth_no": b.booth_no,
        "booth_name": b.booth_name,
        "assembly_constituency": b.assembly_constituency,
    }


def _voter_out(v: Voter) -> dict:
    return {
        "id": v.id,
        "serial_no": v.serial_no,
        "epic_no": v.epic_no,
        "name": v.name,
        "name_en": v.name_en,
        "relative_name": v.relative_name,
        "relative_name_en": v.relative_name_en,
        "relation_type": v.relation_type,
        "house_no": v.house_no,
        "age": v.age,
        "gender": v.gender,
        "hamlet": v.hamlet,
        "status": v.status,
        "booth": _booth_out(v.booth),
    }


# ── List all wards (for dropdown) ────────────────────────────────────────────
@router.get("/booths")
def list_booths(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    booths = db.query(Booth).order_by(Booth.district, Booth.gram_panchayat, Booth.ward_no).all()
    return [_booth_out(b) for b in booths]


# ── Name / EPIC search ────────────────────────────────────────────────────────
@router.get("/voters/search")
def search_voters(
    q: str = Query("", description="Name (Hindi or English) or EPIC number"),
    booth_id: int | None = Query(None, description="Filter by ward/booth"),
    gender: str | None = Query(None, description="male | female | third"),
    age_min: int | None = Query(None),
    age_max: int | None = Query(None),
    sort: str = Query("name", description="name | age_asc | age_desc | serial"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    qry = db.query(Voter).filter(Voter.status == "active")

    # Text search — name (Hindi), name_en, relative_name, EPIC
    q = q.strip()
    if q:
        like = f"%{q}%"
        qry = qry.filter(
            or_(
                Voter.name.ilike(like),
                Voter.name_en.ilike(like),
                Voter.relative_name.ilike(like),
                Voter.relative_name_en.ilike(like),
                Voter.epic_no.ilike(like),
            )
        )

    if booth_id:
        qry = qry.filter(Voter.booth_id == booth_id)
    if gender:
        qry = qry.filter(Voter.gender == gender)
    if age_min is not None:
        qry = qry.filter(Voter.age >= age_min)
    if age_max is not None:
        qry = qry.filter(Voter.age <= age_max)

    # Sorting
    if sort == "age_asc":
        qry = qry.order_by(Voter.age.asc().nullslast())
    elif sort == "age_desc":
        qry = qry.order_by(Voter.age.desc().nullslast())
    elif sort == "serial":
        qry = qry.order_by(Voter.booth_id, Voter.serial_no)
    else:
        qry = qry.order_by(Voter.name_en)

    total = qry.count()
    voters = qry.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "voters": [_voter_out(v) for v in voters],
    }


# ── Ward summary (counts + breakdown) ────────────────────────────────────────
@router.get("/booths/{booth_id}/voters")
def ward_voters(
    booth_id: int,
    gender: str | None = Query(None),
    age_min: int | None = Query(None),
    age_max: int | None = Query(None),
    sort: str = Query("serial", description="serial | age_asc | age_desc | name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    booth = db.get(Booth, booth_id)
    if not booth:
        from fastapi import HTTPException
        raise HTTPException(404, "Ward not found")

    qry = db.query(Voter).filter(Voter.booth_id == booth_id, Voter.status == "active")

    if gender:
        qry = qry.filter(Voter.gender == gender)
    if age_min is not None:
        qry = qry.filter(Voter.age >= age_min)
    if age_max is not None:
        qry = qry.filter(Voter.age <= age_max)

    if sort == "age_asc":
        qry = qry.order_by(Voter.age.asc().nullslast())
    elif sort == "age_desc":
        qry = qry.order_by(Voter.age.desc().nullslast())
    elif sort == "name":
        qry = qry.order_by(Voter.name_en)
    else:
        qry = qry.order_by(Voter.serial_no)

    total = qry.count()
    voters = qry.offset((page - 1) * page_size).limit(page_size).all()

    # Summary counts (ignoring pagination filters for totals)
    base = db.query(Voter).filter(Voter.booth_id == booth_id, Voter.status == "active")
    male   = base.filter(Voter.gender == "male").count()
    female = base.filter(Voter.gender == "female").count()
    third  = base.filter(Voter.gender == "third").count()

    # Age buckets
    buckets = [
        ("18-25", 18, 25), ("26-35", 26, 35), ("36-45", 36, 45),
        ("46-60", 46, 60), ("61-75", 61, 75), ("76+", 76, 150),
    ]
    age_groups = {
        label: base.filter(Voter.age >= lo, Voter.age <= hi).count()
        for label, lo, hi in buckets
    }

    return {
        "booth": _booth_out(booth),
        "summary": {
            "total": male + female + third,
            "male": male,
            "female": female,
            "third": third,
            "age_groups": age_groups,
        },
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "voters": [_voter_out(v) for v in voters],
    }
