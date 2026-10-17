from sqlalchemy.orm import Session

from app.models import Organization
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


def get_all(db: Session) -> list[Organization]:
    return db.query(Organization).order_by(Organization.name).all()


def get_by_id(db: Session, org_id: int) -> Organization | None:
    return db.get(Organization, org_id)


def get_by_slug(db: Session, slug: str) -> Organization | None:
    return db.query(Organization).filter_by(slug=slug).first()


def create(db: Session, body: OrganizationCreate) -> Organization:
    org = Organization(name=body.name, slug=body.slug, voter_symbol=body.voter_symbol)
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def update(db: Session, org: Organization, body: OrganizationUpdate) -> Organization:
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org


def delete(db: Session, org: Organization) -> None:
    db.delete(org)
    db.commit()
