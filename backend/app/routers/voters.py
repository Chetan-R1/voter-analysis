from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db
from app.models import Booth, User, Voter

router = APIRouter(prefix="/voters", tags=["voters"])


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


@router.get("/{epic_no}")
def get_voter(
    epic_no: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    voter = (
        db.query(Voter)
        .filter(Voter.epic_no == epic_no.upper(), Voter.status == "active")
        .first()
    )
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    return _voter_out(voter)


def _normalize(s: str | None) -> str:
    return "".join((s or "").split())  # strip ALL whitespace for fuzzy compare


def _names_match(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return _normalize(a) == _normalize(b)


def _reverse_relation(relation_type: str, gender: str) -> str:
    if relation_type in ("father", "mother"):
        return "daughter" if gender == "female" else "son"
    if relation_type == "husband":
        return "wife"
    return "relative"


def _infer_housemate_relation(voter: Voter, other: Voter) -> str:
    # other is voter's parent (voter's relative_name matches other's name)
    if _names_match(voter.relative_name, other.name):
        return voter.relation_type or "relative"
    # other is voter's child or spouse (other's relative_name matches voter's name)
    if _names_match(other.relative_name, voter.name):
        return _reverse_relation(other.relation_type or "", other.gender or "")
    # siblings: both have the same relative_name (same parent)
    if voter.relative_name and other.relative_name and _names_match(voter.relative_name, other.relative_name):
        return "sibling"
    return "relative"


@router.get("/{voter_id}/relationships")
def get_voter_relationships(
    voter_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    voter = db.query(Voter).filter(Voter.id == voter_id, Voter.status == "active").first()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")

    result = []
    seen_ids: set[int] = {voter.id}

    # Primary: same house number in same booth — most reliable family signal
    if voter.house_no:
        housemates = (
            db.query(Voter)
            .filter(
                Voter.booth_id == voter.booth_id,
                Voter.house_no == voter.house_no,
                Voter.status == "active",
                Voter.id != voter.id,
            )
            .all()
        )
        for h in housemates:
            seen_ids.add(h.id)
            relation = _infer_housemate_relation(voter, h)
            result.append({"relation": relation, "confidence": 0.95, "voter": _voter_out(h)})

    # Fallback: name matching for relatives possibly in a different house (e.g. parent registered elsewhere)
    if voter.relative_name:
        for p in (
            db.query(Voter)
            .filter(
                Voter.booth_id == voter.booth_id,
                Voter.status == "active",
                Voter.id.not_in(seen_ids),
            )
            .all()
        ):
            if _names_match(p.name, voter.relative_name):
                seen_ids.add(p.id)
                result.append({
                    "relation": voter.relation_type or "relative",
                    "confidence": 0.7,
                    "voter": _voter_out(p),
                })

    if voter.name:
        for c in (
            db.query(Voter)
            .filter(
                Voter.booth_id == voter.booth_id,
                Voter.status == "active",
                Voter.id.not_in(seen_ids),
            )
            .all()
        ):
            if _names_match(c.relative_name, voter.name):
                seen_ids.add(c.id)
                result.append({
                    "relation": _reverse_relation(c.relation_type or "", c.gender or ""),
                    "confidence": 0.7,
                    "voter": _voter_out(c),
                })

    return result
