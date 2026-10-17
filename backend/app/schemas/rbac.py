from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator


class RoleCreate(BaseModel):
    name: str
    code: str
    description: str | None = None


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class RoleOut(BaseModel):
    id: int
    org_id: int
    name: str
    code: str
    description: str | None
    is_active: bool
    created_at: datetime
    permission_ids: list[int] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_permission_ids(cls, v: Any):
        if hasattr(v, "permissions"):
            return {
                "id": v.id,
                "org_id": v.org_id,
                "name": v.name,
                "code": v.code,
                "description": v.description,
                "is_active": v.is_active,
                "created_at": v.created_at,
                "permission_ids": [jn.permission_id for jn in (v.permissions or [])],
            }
        return v


class PermissionOut(BaseModel):
    id: int
    name: str
    code: str
    resource: str
    action: str
    description: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class AssignPermissionBody(BaseModel):
    permission_id: int


class AssignRoleBody(BaseModel):
    role_id: int


class UserPermissionsOut(BaseModel):
    user_id: int
    roles: list[str]
    permissions: list[str]


class HierarchyCreate(BaseModel):
    parent_role_id: int
    child_role_id: int


class HierarchyOut(BaseModel):
    id: int
    parent_role_id: int
    child_role_id: int

    model_config = {"from_attributes": True}


class OrgMemberOut(BaseModel):
    id: int
    email: str
    is_active: bool
    created_at: datetime
    role_id: int | None
    role_code: str | None
    role_name: str | None
