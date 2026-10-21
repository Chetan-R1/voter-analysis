from sqlalchemy.orm import Session

from app.models import (
    RbacPermission,
    RbacRole,
    RbacRoleHierarchy,
    RbacRolePermissionJn,
    RbacRoleUserJn,
    RbacUserPermissionJn,
)

DEFAULT_PERMISSIONS = [
    ("Voter View",    "voter:read",    "voter",   "read",   "Search and view voter records"),
    ("Import Upload", "import:create", "import",  "create", "Upload PDF voter lists"),
    ("Import View",   "import:read",   "import",  "read",   "View import history and status"),
    ("Import Delete", "import:delete", "import",  "delete", "Delete imports"),
    ("RBAC Manage",   "rbac:manage",   "rbac",    "manage", "Manage roles, users and permissions"),
]


def seed_permissions(db: Session) -> list[RbacPermission]:
    """Create default permissions if they don't exist yet."""
    perms = []
    for name, code, resource, action, desc in DEFAULT_PERMISSIONS:
        existing = db.query(RbacPermission).filter_by(code=code).first()
        if not existing:
            p = RbacPermission(name=name, code=code, resource=resource, action=action, description=desc)
            db.add(p)
            perms.append(p)
    db.flush()
    return perms


def seed_default_roles(db: Session, org_id: int) -> dict[str, RbacRole]:
    """Create admin/leader/karkarta roles for an org if they don't exist."""
    role_defs = [
        ("Admin",     "admin",     "Full access to all features"),
        ("Leader",    "leader",    "Manage voters and imports, view reports"),
        ("Karkarta",  "karkarta",  "View voter data only"),
    ]
    roles: dict[str, RbacRole] = {}
    for name, code, desc in role_defs:
        existing = db.query(RbacRole).filter_by(org_id=org_id, code=code).first()
        if not existing:
            role = RbacRole(org_id=org_id, name=name, code=code, description=desc)
            db.add(role)
            db.flush()
            roles[code] = role
        else:
            roles[code] = existing
    return roles


def assign_default_permissions(db: Session, roles: dict[str, RbacRole]) -> None:
    """Assign permissions to default roles."""
    all_perms = {p.code: p for p in db.query(RbacPermission).all()}

    role_perms = {
        "admin":    list(all_perms.keys()),
        "leader":   ["voter:read", "import:create", "import:read", "import:delete"],
        "karkarta": ["voter:read", "import:read"],
    }

    for role_code, perm_codes in role_perms.items():
        role = roles.get(role_code)
        if not role:
            continue
        for code in perm_codes:
            perm = all_perms.get(code)
            if not perm:
                continue
            exists = db.query(RbacRolePermissionJn).filter_by(role_id=role.id, permission_id=perm.id).first()
            if not exists:
                db.add(RbacRolePermissionJn(role_id=role.id, permission_id=perm.id))

    # Hierarchy: admin > leader > karkarta
    hierarchy = [("admin", "leader"), ("leader", "karkarta")]
    for parent_code, child_code in hierarchy:
        parent = roles.get(parent_code)
        child = roles.get(child_code)
        if parent and child:
            exists = db.query(RbacRoleHierarchy).filter_by(
                parent_role_id=parent.id, child_role_id=child.id
            ).first()
            if not exists:
                db.add(RbacRoleHierarchy(parent_role_id=parent.id, child_role_id=child.id))


def get_roles(db: Session, org_id: int) -> list[RbacRole]:
    return db.query(RbacRole).filter_by(org_id=org_id, is_active=True).all()


def get_permissions(db: Session) -> list[RbacPermission]:
    return db.query(RbacPermission).filter_by(is_active=True).order_by(RbacPermission.resource, RbacPermission.action).all()


def get_org_members(db: Session, org_id: int) -> list[dict]:
    from app.models import User
    users = db.query(User).filter_by(org_id=org_id).order_by(User.created_at).all()
    result = []
    for user in users:
        jn = db.query(RbacRoleUserJn).filter_by(user_id=user.id).first()
        role = jn.role if jn else None
        result.append({
            "id": user.id,
            "email": user.email,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "role_id": role.id if role else None,
            "role_code": role.code if role else None,
            "role_name": role.name if role else None,
        })
    return result


def get_effective_permissions(db: Session, user_id: int) -> dict:
    role_jns = db.query(RbacRoleUserJn).filter_by(user_id=user_id).all()
    perm_codes: set[str] = set()
    role_codes = []
    for jn in role_jns:
        role_codes.append(jn.role.code)
        for perm_jn in jn.role.permissions:
            perm_codes.add(perm_jn.permission.code)
    direct = db.query(RbacUserPermissionJn).filter_by(user_id=user_id).all()
    for jn in direct:
        perm_codes.add(jn.permission.code)
    return {
        "user_id": user_id,
        "roles": role_codes,
        "permissions": sorted(perm_codes),
    }


def get_user_permissions(db: Session, user_id: int) -> dict:
    role_rows = db.query(RbacRoleUserJn).filter_by(user_id=user_id).all()
    roles = [row.role for row in role_rows]

    perm_codes: set[str] = set()
    for role in roles:
        for jn in role.permissions:
            perm_codes.add(jn.permission.code)

    direct = db.query(RbacUserPermissionJn).filter_by(user_id=user_id).all()
    for jn in direct:
        perm_codes.add(jn.permission.code)

    return {
        "user_id": user_id,
        "roles": [r.code for r in roles],
        "permissions": sorted(perm_codes),
    }


def assign_role_to_user(db: Session, user_id: int, role_id: int) -> RbacRoleUserJn:
    existing = db.query(RbacRoleUserJn).filter_by(user_id=user_id, role_id=role_id).first()
    if existing:
        return existing
    jn = RbacRoleUserJn(user_id=user_id, role_id=role_id)
    db.add(jn)
    db.commit()
    db.refresh(jn)
    return jn


def remove_role_from_user(db: Session, user_id: int, role_id: int) -> bool:
    jn = db.query(RbacRoleUserJn).filter_by(user_id=user_id, role_id=role_id).first()
    if not jn:
        return False
    db.delete(jn)
    db.commit()
    return True


def assign_permission_to_role(db: Session, role_id: int, permission_id: int) -> RbacRolePermissionJn:
    existing = db.query(RbacRolePermissionJn).filter_by(role_id=role_id, permission_id=permission_id).first()
    if existing:
        return existing
    jn = RbacRolePermissionJn(role_id=role_id, permission_id=permission_id)
    db.add(jn)
    db.commit()
    db.refresh(jn)
    return jn


def remove_permission_from_role(db: Session, role_id: int, permission_id: int) -> bool:
    jn = db.query(RbacRolePermissionJn).filter_by(role_id=role_id, permission_id=permission_id).first()
    if not jn:
        return False
    db.delete(jn)
    db.commit()
    return True
