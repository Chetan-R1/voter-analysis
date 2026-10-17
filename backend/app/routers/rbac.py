from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_db
from app.models import User
from app.schemas.rbac import (
    AssignPermissionBody,
    AssignRoleBody,
    HierarchyCreate,
    HierarchyOut,
    OrgMemberOut,
    PermissionOut,
    RoleCreate,
    RoleOut,
    RoleUpdate,
)
from app.services import rbac as svc
from app.services import organization as org_svc

router = APIRouter(prefix="/organizations/{org_id}/rbac", tags=["rbac"])
me_router = APIRouter(tags=["me"])


# ── Me ────────────────────────────────────────────────────────────────────────

@me_router.get("/me/permissions")
def get_my_permissions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.get_effective_permissions(db, user.id)


# ── Roles ─────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not org_svc.get_by_id(db, org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return svc.get_roles(db, org_id)


@router.post("/roles", response_model=RoleOut, status_code=201)
def create_role(
    org_id: int,
    body: RoleCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not org_svc.get_by_id(db, org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    from app.models import RbacRole
    if db.query(RbacRole).filter_by(org_id=org_id, code=body.code).first():
        raise HTTPException(status_code=409, detail="Role code already exists in this organization")
    role = RbacRole(org_id=org_id, name=body.name, code=body.code, description=body.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/roles/{role_id}", response_model=RoleOut)
def get_role(
    org_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole
    role = db.get(RbacRole, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(
    org_id: int,
    role_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole
    role = db.get(RbacRole, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name is not None:
        role.name = body.name
    if body.description is not None:
        role.description = body.description
    db.commit()
    db.refresh(role)
    return role


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    org_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole
    role = db.get(RbacRole, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()


@router.get("/roles/{role_id}/users")
def list_role_users(
    org_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole, RbacRoleUserJn, User as UserModel
    role = db.get(RbacRole, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    jns = db.query(RbacRoleUserJn).filter_by(role_id=role_id).all()
    result = []
    for jn in jns:
        u = db.get(UserModel, jn.user_id)
        if u:
            result.append({"id": u.id, "email": u.email, "is_active": u.is_active})
    return result


# ── Permissions ───────────────────────────────────────────────────────────────

@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return svc.get_permissions(db)


@router.post("/roles/{role_id}/permissions", status_code=201)
def assign_permission_to_role(
    org_id: int,
    role_id: int,
    body: AssignPermissionBody,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole
    role = db.get(RbacRole, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    jn = svc.assign_permission_to_role(db, role_id, body.permission_id)
    return {"role_id": jn.role_id, "permission_id": jn.permission_id}


@router.delete("/roles/{role_id}/permissions/{permission_id}", status_code=204)
def remove_permission_from_role(
    org_id: int,
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole
    role = db.get(RbacRole, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if not svc.remove_permission_from_role(db, role_id, permission_id):
        raise HTTPException(status_code=404, detail="Assignment not found")


# ── Members (users in org) ────────────────────────────────────────────────────

@router.get("/members", response_model=list[OrgMemberOut])
def list_members(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not org_svc.get_by_id(db, org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    return svc.get_org_members(db, org_id)


@router.post("/users/{user_id}/roles", status_code=201)
def assign_role_to_user(
    org_id: int,
    user_id: int,
    body: AssignRoleBody,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole
    role = db.get(RbacRole, body.role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found in this organization")
    # Remove existing roles first (one role per user per org)
    from app.models import RbacRoleUserJn
    existing_jns = (
        db.query(RbacRoleUserJn)
        .join(RbacRole, RbacRoleUserJn.role_id == RbacRole.id)
        .filter(RbacRoleUserJn.user_id == user_id, RbacRole.org_id == org_id)
        .all()
    )
    for jn in existing_jns:
        db.delete(jn)
    db.flush()
    jn = svc.assign_role_to_user(db, user_id, body.role_id)
    return {"user_id": jn.user_id, "role_id": jn.role_id}


@router.delete("/users/{user_id}/roles/{role_id}", status_code=204)
def remove_role_from_user(
    org_id: int,
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not svc.remove_role_from_user(db, user_id, role_id):
        raise HTTPException(status_code=404, detail="Assignment not found")


# ── Hierarchies ───────────────────────────────────────────────────────────────

@router.get("/hierarchies", response_model=list[HierarchyOut])
def list_hierarchies(
    org_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole, RbacRoleHierarchy
    roles = db.query(RbacRole).filter_by(org_id=org_id).all()
    role_ids = {r.id for r in roles}
    rows = (
        db.query(RbacRoleHierarchy)
        .filter(RbacRoleHierarchy.parent_role_id.in_(role_ids))
        .all()
    )
    return rows


@router.post("/hierarchies", response_model=HierarchyOut, status_code=201)
def create_hierarchy(
    org_id: int,
    body: HierarchyCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole, RbacRoleHierarchy
    parent = db.get(RbacRole, body.parent_role_id)
    child = db.get(RbacRole, body.child_role_id)
    if not parent or parent.org_id != org_id:
        raise HTTPException(status_code=404, detail="Parent role not found")
    if not child or child.org_id != org_id:
        raise HTTPException(status_code=404, detail="Child role not found")
    if body.parent_role_id == body.child_role_id:
        raise HTTPException(status_code=400, detail="A role cannot inherit from itself")
    existing = db.query(RbacRoleHierarchy).filter_by(
        parent_role_id=body.parent_role_id, child_role_id=body.child_role_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Hierarchy already exists")
    h = RbacRoleHierarchy(parent_role_id=body.parent_role_id, child_role_id=body.child_role_id)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/hierarchies/{hierarchy_id}", status_code=204)
def delete_hierarchy(
    org_id: int,
    hierarchy_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from app.models import RbacRole, RbacRoleHierarchy
    h = db.get(RbacRoleHierarchy, hierarchy_id)
    if not h:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    parent = db.get(RbacRole, h.parent_role_id)
    if not parent or parent.org_id != org_id:
        raise HTTPException(status_code=403, detail="Not in this organization")
    db.delete(h)
    db.commit()


@router.get("/users/{user_id}/permissions")
def get_user_permissions(
    org_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return svc.get_effective_permissions(db, user_id)
