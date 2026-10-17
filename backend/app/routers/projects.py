from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db
from app.models import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services import project as svc
from app.services import organization as org_svc

router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["projects"])


def _booth_out(b) -> dict:
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


@router.get("", response_model=list[ProjectOut])
def list_projects(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not org_svc.get_by_id(db, org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return svc.get_all(db, org_id)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    org_id: int,
    body: ProjectCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not org_svc.get_by_id(db, org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return svc.create(db, org_id, body)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    org_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project = svc.get_by_id(db, project_id)
    if not project or project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    org_id: int,
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project = svc.get_by_id(db, project_id)
    if not project or project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return svc.update(db, project, body)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    org_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project = svc.get_by_id(db, project_id)
    if not project or project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    svc.delete(db, project)


@router.get("/{project_id}/booths")
def get_project_booths(
    org_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project = svc.get_by_id(db, project_id)
    if not project or project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    booths = svc.get_booths(db, project_id)
    return [_booth_out(b) for b in booths]


@router.get("/{project_id}/imports")
def get_project_imports(
    org_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    project = svc.get_by_id(db, project_id)
    if not project or project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    imports = svc.get_imports(db, project_id)
    return [
        {
            "id": imp.id,
            "file_name": imp.file_name,
            "status": imp.status,
            "total_voters": imp.total_voters,
            "issues": len(imp.errors) if imp.errors else 0,
            "imported_at": imp.imported_at.isoformat() if imp.imported_at else None,
        }
        for imp in imports
    ]
