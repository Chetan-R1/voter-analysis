import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, booths, imports, search, voters, organizations, projects, rbac
from app.routers.rbac import me_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.models import Base, PdfImport
    from app.db import engine, SessionLocal
    Base.metadata.create_all(bind=engine)
    _run_column_migrations(engine)

    with SessionLocal() as db:
        _migrate_existing_data(db)

        # Reset imports stuck in "processing" from a previous crashed run
        stuck = db.query(PdfImport).filter(PdfImport.status == "processing").all()
        for imp in stuck:
            imp.status = "failed"
            imp.errors = (imp.errors or []) + ["Server restarted during processing — please retry"]
        if stuck:
            db.commit()
    yield


def _run_column_migrations(engine):
    """Add new columns to existing tables — safe to run multiple times (IF NOT EXISTS)."""
    from sqlalchemy import text
    migrations = [
        # users: add org_id
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL",
        # booths: add project_id
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE",
        # booths: voter count columns
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS total_voter_count INTEGER",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS total_male_voters INTEGER",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS total_female_voters INTEGER",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS total_third_gender_voters INTEGER",
        # pdf_imports: add project_id
        "ALTER TABLE pdf_imports ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL",
        # booths unique constraint: drop old one, add new one with project_id
        "ALTER TABLE booths DROP CONSTRAINT IF EXISTS uq_booth_ward",
        """DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_booth_ward'
            ) THEN
                ALTER TABLE booths ADD CONSTRAINT uq_booth_ward
                UNIQUE (project_id, district, panchayat_samiti, gram_panchayat, ward_no);
            END IF;
        END $$""",
        # rename relationships → family (safe: only if relationships exists and family doesn't)
        """DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'relationships')
               AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'family') THEN
                ALTER TABLE relationships RENAME TO family;
            END IF;
        END $$""",
        # rename old unique constraint on family table (safe: only if it still has the old name)
        """DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_relationship'
                  AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'family')
            ) THEN
                ALTER TABLE family RENAME CONSTRAINT uq_relationship TO uq_family;
            END IF;
        END $$""",
    ]
    with engine.begin() as conn:
        for sql in migrations:
            conn.execute(text(sql))


def _migrate_existing_data(db):
    """One-time: seed a default org + project for existing data."""
    from app.models import Organization, Project, User, Booth, PdfImport
    from app.services.rbac import seed_permissions, seed_default_roles, assign_default_permissions

    # Seed global permissions
    seed_permissions(db)

    # Remove stale booth/project permissions replaced by voter: and import: ones
    from sqlalchemy import text
    db.execute(text("DELETE FROM rabc_permissions WHERE code IN ('booth:read','booth:write','project:read','project:write')"))

    # Create default org if none exists
    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Default Organization", slug="default")
        db.add(org)
        db.flush()

    # Assign org to all users that don't have one
    for user in db.query(User).filter(User.org_id == None).all():
        user.org_id = org.id

    # Seed default roles for the org
    roles = seed_default_roles(db, org.id)
    assign_default_permissions(db, roles)

    # Create default project if none exists
    project = db.query(Project).filter_by(org_id=org.id).first()
    if not project:
        project = Project(org_id=org.id, name="Default Project", election_type="gram_panchayat")
        db.add(project)
        db.flush()

    # Assign project_id to orphan booths and imports
    for booth in db.query(Booth).filter(Booth.project_id == None).all():
        booth.project_id = project.id
    for imp in db.query(PdfImport).filter(PdfImport.project_id == None).all():
        imp.project_id = project.id

    db.commit()


app = FastAPI(title="Voter Analysis API", version="0.2.0", lifespan=lifespan)

_frontend = os.getenv("FRONTEND_URL", "")
_origins = ["http://localhost:3000"]
if _frontend:
    _origins.append(_frontend.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me_router)
app.include_router(organizations.router)
app.include_router(projects.router)
app.include_router(rbac.router)
app.include_router(search.router)   # before voters — /voters/search must not be caught by /voters/{epic}
app.include_router(voters.router)
app.include_router(booths.router)
app.include_router(imports.router)


@app.get("/health")
def health():
    return {"ok": True}
