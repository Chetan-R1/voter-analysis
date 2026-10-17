from sqlalchemy.orm import Session

from app.models import Booth, PdfImport, Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def get_all(db: Session, org_id: int) -> list[Project]:
    return db.query(Project).filter_by(org_id=org_id).order_by(Project.created_at.desc()).all()


def get_by_id(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


def create(db: Session, org_id: int, body: ProjectCreate) -> Project:
    project = Project(org_id=org_id, **body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update(db: Session, project: Project, body: ProjectUpdate) -> Project:
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()


def get_booths(db: Session, project_id: int) -> list[Booth]:
    return (
        db.query(Booth)
        .filter_by(project_id=project_id)
        .order_by(Booth.gram_panchayat, Booth.ward_no)
        .all()
    )


def get_imports(db: Session, project_id: int) -> list[PdfImport]:
    return (
        db.query(PdfImport)
        .filter_by(project_id=project_id)
        .order_by(PdfImport.id.desc())
        .all()
    )
