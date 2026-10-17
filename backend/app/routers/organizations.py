from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db
from app.models import User
from app.schemas.organization import OrganizationCreate, OrganizationOut, OrganizationUpdate
from app.services import organization as svc

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationOut])
def list_organizations(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return svc.get_all(db)


@router.post("", response_model=OrganizationOut, status_code=201)
def create_organization(
    body: OrganizationCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if svc.get_by_slug(db, body.slug):
        raise HTTPException(status_code=409, detail="Slug already taken")
    return svc.create(db, body)


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    org = svc.get_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationOut)
def update_organization(
    org_id: int,
    body: OrganizationUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    org = svc.get_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return svc.update(db, org, body)


@router.delete("/{org_id}", status_code=204)
def delete_organization(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    org = svc.get_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    svc.delete(db, org)
