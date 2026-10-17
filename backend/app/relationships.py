"""Build family groups and pairwise voter relationships from booth data."""

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Voter, Family, VotersFamily, BoothVoterJn


def _normalize(s: str | None) -> str:
    return "".join((s or "").split()).lower()


def _names_match(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return _normalize(a) == _normalize(b)


def _reverse_relation(relation_type: str, gender: str) -> str:
    """Given voter B's relation to voter A (A is B's father/mother), return A's relation to B."""
    if relation_type == "father":
        return "son" if gender != "female" else "daughter"
    if relation_type == "mother":
        return "son" if gender != "female" else "daughter"
    if relation_type == "husband":
        return "wife"
    if relation_type == "wife":
        return "husband"
    return "not_specified"


def build_relationships(session: Session, booth_id: int) -> int:
    """
    Build Family groups and VotersFamily pairs for a booth.
    Returns total pairwise relationships created.
    """
    voters = (
        session.query(Voter)
        .filter(Voter.booth_id == booth_id, Voter.status == "active")
        .all()
    )
    if not voters:
        return 0

    voter_ids = [v.id for v in voters]

    # Wipe existing family data for this booth
    session.execute(delete(Family).where(Family.booth_id == booth_id))
    session.flush()

    # Group voters by house_no
    by_house: dict[str, list[Voter]] = {}
    for v in voters:
        key = (v.house_no or "").strip()
        if key:
            by_house.setdefault(key, []).append(v)

    total_pairs = 0

    for house_no, members in by_house.items():
        member_ids = [v.id for v in members]

        family = Family(
            booth_id=booth_id,
            house_no=house_no,
            member_count=len(members),
            member_list=member_ids,
            confidence=0.95,
            accuracy=0.95,
        )
        session.add(family)
        session.flush()  # get family.id

        # Build pairwise relationships within this family
        seen: set[tuple[int, int]] = set()

        for v1 in members:
            for v2 in members:
                if v1.id == v2.id:
                    continue
                # Avoid duplicate pairs (a,b) and (b,a) — keep canonical order (lower id first)
                pair = (min(v1.id, v2.id), max(v1.id, v2.id))
                if pair in seen:
                    continue
                seen.add(pair)

                relation = _infer_relation(v1, v2)

                vf = VotersFamily(
                    family_id=family.id,
                    voter_id=v1.id,
                    voter_id2=v2.id,
                    relation=relation,
                    voter1_identity=v1.name,
                    voter2_identity=v2.name,
                )
                session.add(vf)
                total_pairs += 1

    # Rebuild booth_voter_jn for this booth
    session.execute(delete(BoothVoterJn).where(BoothVoterJn.booth_id == booth_id))
    session.flush()
    for vid in voter_ids:
        session.add(BoothVoterJn(booth_id=booth_id, voter_id=vid))

    session.flush()
    return total_pairs


def _infer_relation(v1: Voter, v2: Voter) -> str:
    """
    Infer v1's relationship to v2.
    E.g. if v1's relative_name matches v2's name and v1's relation_type is 'father',
    then v1 is v2's father (v2 is v1's son/daughter).
    """
    # v1 explicitly lists v2 as relative
    if _names_match(v1.relative_name, v2.name) and v1.relation_type:
        return v1.relation_type  # e.g. "father" means v2 is v1's father

    # v2 explicitly lists v1 as relative → reverse
    if _names_match(v2.relative_name, v1.name) and v2.relation_type:
        return _reverse_relation(v2.relation_type, v1.gender or "")

    # Same relative name → siblings
    if (v1.relative_name and v2.relative_name
            and _names_match(v1.relative_name, v2.relative_name)):
        return "brother" if (v1.gender or "") != "female" else "sister"

    return "not_specified"
