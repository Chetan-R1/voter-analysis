from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RbacRole(Base):
    __tablename__ = "rabc_roles"
    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_rabc_role_org_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(100))  # admin | leader | karkarta
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    permissions: Mapped[list["RbacRolePermissionJn"]] = relationship(back_populates="role", cascade="all, delete-orphan")
    users: Mapped[list["RbacRoleUserJn"]] = relationship(back_populates="role", cascade="all, delete-orphan")
    parent_hierarchies: Mapped[list["RbacRoleHierarchy"]] = relationship(
        back_populates="child_role", foreign_keys="RbacRoleHierarchy.child_role_id", cascade="all, delete-orphan"
    )
    child_hierarchies: Mapped[list["RbacRoleHierarchy"]] = relationship(
        back_populates="parent_role", foreign_keys="RbacRoleHierarchy.parent_role_id", cascade="all, delete-orphan"
    )


class RbacPermission(Base):
    __tablename__ = "rabc_permissions"
    __table_args__ = (
        UniqueConstraint("resource", "action", name="uq_rabc_permission_resource_action"),
        UniqueConstraint("code", name="uq_rabc_permission_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(100))  # voter:read, booth:write
    resource: Mapped[str] = mapped_column(String(100))  # voter, booth, project, import, rbac
    action: Mapped[str] = mapped_column(String(50))   # read, write, delete, manage
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RbacRolePermissionJn(Base):
    __tablename__ = "rabc_role_permission_jn"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_rabc_role_permission"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("rabc_roles.id", ondelete="CASCADE"), index=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("rabc_permissions.id", ondelete="CASCADE"), index=True)

    role: Mapped["RbacRole"] = relationship(back_populates="permissions")
    permission: Mapped["RbacPermission"] = relationship()


class RbacRoleUserJn(Base):
    __tablename__ = "rabc_role_user_jn"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_rabc_user_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("rabc_roles.id", ondelete="CASCADE"), index=True)

    role: Mapped["RbacRole"] = relationship(back_populates="users")


class RbacUserPermissionJn(Base):
    """Direct permission override for a user (bypasses role assignment)."""

    __tablename__ = "rabc_user_permission_jn"
    __table_args__ = (
        UniqueConstraint("user_id", "permission_id", name="uq_rabc_user_permission"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("rabc_permissions.id", ondelete="CASCADE"), index=True)

    permission: Mapped["RbacPermission"] = relationship()


class RbacRoleHierarchy(Base):
    """Parent role inherits all permissions of child roles."""

    __tablename__ = "rabc_role_hierarchies"
    __table_args__ = (
        UniqueConstraint("parent_role_id", "child_role_id", name="uq_rabc_role_hierarchy"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_role_id: Mapped[int] = mapped_column(ForeignKey("rabc_roles.id", ondelete="CASCADE"), index=True)
    child_role_id: Mapped[int] = mapped_column(ForeignKey("rabc_roles.id", ondelete="CASCADE"), index=True)

    parent_role: Mapped["RbacRole"] = relationship(back_populates="child_hierarchies", foreign_keys=[parent_role_id])
    child_role: Mapped["RbacRole"] = relationship(back_populates="parent_hierarchies", foreign_keys=[child_role_id])
