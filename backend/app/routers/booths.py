from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db
from app.models import Booth, Project, User, Voter

router = APIRouter(prefix="/booths", tags=["booths"])

AGE_GROUPS = [(18, 25), (26, 35), (36, 45), (46, 60), (61, 75), (76, 120)]


def _age_label(lo: int, hi: int) -> str:
    return f"{lo}-{hi}"


@router.get("/{booth_id}/stats")
def booth_stats(
    booth_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booth = (
        db.query(Booth)
        .join(Project, Booth.project_id == Project.id)
        .filter(Booth.id == booth_id, Project.org_id == user.org_id)
        .first()
    )
    if not booth:
        raise HTTPException(status_code=404, detail="Booth not found")

    active = db.query(Voter).filter(Voter.booth_id == booth_id, Voter.status == "active").all()

    gender_counts = Counter(v.gender for v in active)
    age_groups: dict[str, int] = {_age_label(lo, hi): 0 for lo, hi in AGE_GROUPS}
    for v in active:
        if v.age:
            for lo, hi in AGE_GROUPS:
                if lo <= v.age <= hi:
                    age_groups[_age_label(lo, hi)] += 1
                    break

    hamlet_counts = Counter(v.hamlet for v in active if v.hamlet)

    return {
        "booth": {
            "id": booth.id,
            "district": booth.district,
            "panchayat_samiti": booth.panchayat_samiti,
            "gram_panchayat": booth.gram_panchayat,
            "ward_no": booth.ward_no,
            "booth_no": booth.booth_no,
            "booth_name": booth.booth_name,
            "assembly_constituency": booth.assembly_constituency,
        },
        "total": len(active),
        "male": gender_counts.get("male", 0),
        "female": gender_counts.get("female", 0),
        "third": gender_counts.get("third", 0),
        "age_groups": age_groups,
        "hamlets": [
            {"hamlet": h, "count": c}
            for h, c in hamlet_counts.most_common()
        ],
    }
