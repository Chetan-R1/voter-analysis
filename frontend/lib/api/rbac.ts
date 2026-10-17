import api from "./client";
import type { MyPermissions, OrgMember, RbacPermission, RbacRole } from "@/lib/types";

export async function getMyPermissions(): Promise<MyPermissions> {
  const { data } = await api.get("/me/permissions");
  return data;
}

export async function getRoles(orgId: number): Promise<RbacRole[]> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/roles`);
  return data;
}

export async function createRole(
  orgId: number,
  body: { name: string; code: string; description?: string }
): Promise<RbacRole> {
  const { data } = await api.post(`/organizations/${orgId}/rbac/roles`, body);
  return data;
}

export async function getRole(orgId: number, roleId: number): Promise<RbacRole> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/roles/${roleId}`);
  return data;
}

export async function updateRole(
  orgId: number,
  roleId: number,
  body: { name?: string; description?: string }
): Promise<RbacRole> {
  const { data } = await api.patch(`/organizations/${orgId}/rbac/roles/${roleId}`, body);
  return data;
}

export async function deleteRole(orgId: number, roleId: number): Promise<void> {
  await api.delete(`/organizations/${orgId}/rbac/roles/${roleId}`);
}

export async function getRoleUsers(orgId: number, roleId: number): Promise<{ id: number; email: string; is_active: boolean }[]> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/roles/${roleId}/users`);
  return data;
}

export async function getPermissions(orgId: number): Promise<RbacPermission[]> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/permissions`);
  return data;
}

export async function assignPermissionToRole(
  orgId: number,
  roleId: number,
  permissionId: number
) {
  const { data } = await api.post(`/organizations/${orgId}/rbac/roles/${roleId}/permissions`, {
    permission_id: permissionId,
  });
  return data;
}

export async function removePermissionFromRole(
  orgId: number,
  roleId: number,
  permissionId: number
) {
  await api.delete(`/organizations/${orgId}/rbac/roles/${roleId}/permissions/${permissionId}`);
}

export async function getOrgMembers(orgId: number): Promise<OrgMember[]> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/members`);
  return data;
}

export async function assignRoleToUser(orgId: number, userId: number, roleId: number) {
  const { data } = await api.post(`/organizations/${orgId}/rbac/users/${userId}/roles`, {
    role_id: roleId,
  });
  return data;
}

export async function removeRoleFromUser(orgId: number, userId: number, roleId: number) {
  await api.delete(`/organizations/${orgId}/rbac/users/${userId}/roles/${roleId}`);
}

export async function getUserPermissions(orgId: number, userId: number): Promise<MyPermissions> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/users/${userId}/permissions`);
  return data;
}

export interface RoleHierarchy {
  id: number;
  parent_role_id: number;
  child_role_id: number;
}

export async function listHierarchies(orgId: number): Promise<RoleHierarchy[]> {
  const { data } = await api.get(`/organizations/${orgId}/rbac/hierarchies`);
  return data;
}

export async function createHierarchy(
  orgId: number,
  body: { parent_role_id: number; child_role_id: number }
): Promise<RoleHierarchy> {
  const { data } = await api.post(`/organizations/${orgId}/rbac/hierarchies`, body);
  return data;
}

export async function deleteHierarchy(orgId: number, hierarchyId: number): Promise<void> {
  await api.delete(`/organizations/${orgId}/rbac/hierarchies/${hierarchyId}`);
}
