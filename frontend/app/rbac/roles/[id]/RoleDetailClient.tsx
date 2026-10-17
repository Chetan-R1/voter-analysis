"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listOrganizations,
  getRole,
  getPermissions,
  getRoleUsers,
  getOrgMembers,
  assignPermissionToRole,
  removePermissionFromRole,
  assignRoleToUser,
  removeRoleFromUser,
  createUser,
} from "@/lib/api";
import type { OrgMember, Organization, RbacPermission, RbacRole, RoleUser } from "@/lib/types";

type Tab = "permissions" | "users";
const ACTION_ORDER = ["read", "write", "create", "manage", "delete"];

export default function RoleDetailClient({ id }: { id: string }) {
  const roleId = Number(id);
  const router = useRouter();

  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<RbacRole | null>(null);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [allMembers, setAllMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("permissions");
  const [saving, setSaving] = useState<number | null>(null);

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Remove confirm
  const [removingUser, setRemovingUser] = useState<RoleUser | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    listOrganizations().then(async (orgs) => {
      if (!orgs.length) return;
      const o = orgs[0];
      setOrg(o);
      const [r, p, u, m] = await Promise.all([
        getRole(o.id, roleId),
        getPermissions(o.id),
        getRoleUsers(o.id, roleId),
        getOrgMembers(o.id),
      ]);
      setRole(r);
      setPermissions(p);
      setRoleUsers(u);
      setAllMembers(m);
    }).finally(() => setLoading(false));
  }, [roleId]);

  async function refreshUsers() {
    if (!org) return;
    const [u, m] = await Promise.all([getRoleUsers(org.id, roleId), getOrgMembers(org.id)]);
    setRoleUsers(u);
    setAllMembers(m);
  }

  async function togglePermission(perm: RbacPermission, assigned: boolean) {
    if (!org || !role) return;
    setSaving(perm.id);
    try {
      if (assigned) await removePermissionFromRole(org.id, role.id, perm.id);
      else await assignPermissionToRole(org.id, role.id, perm.id);
      setRole(await getRole(org.id, roleId));
    } finally {
      setSaving(null);
    }
  }

  function resetAddDialog() {
    setAddOpen(false);
    setAddMode("existing");
    setSelectedUserId("");
    setNewEmail("");
    setNewPassword("");
    setAddError("");
  }

  async function handleAddMember() {
    if (!org) return;
    setAddSaving(true);
    setAddError("");
    try {
      let userId: number;
      if (addMode === "new") {
        if (!newEmail.trim() || !newPassword) {
          setAddError("Email and password are required.");
          return;
        }
        const created = await createUser(newEmail.trim(), newPassword);
        userId = created.id;
      } else {
        if (!selectedUserId) return;
        userId = Number(selectedUserId);
      }
      await assignRoleToUser(org.id, userId, roleId);
      await refreshUsers();
      resetAddDialog();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAddError(msg ?? "Something went wrong.");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleRemoveUser(user: RoleUser) {
    if (!org) return;
    setRemoveLoading(true);
    try {
      await removeRoleFromUser(org.id, user.id, roleId);
      await refreshUsers();
      setRemovingUser(null);
    } finally {
      setRemoveLoading(false);
    }
  }

  const assignedIds = new Set(roleUsers.map((u) => u.id));
  const unassignedMembers = allMembers.filter((m) => !assignedIds.has(m.id));

  const resources = [...new Set(permissions.map((p) => p.resource))].sort();
  const actions = [...new Set(permissions.map((p) => p.action))].sort(
    (a, b) => (ACTION_ORDER.indexOf(a) ?? 99) - (ACTION_ORDER.indexOf(b) ?? 99)
  );
  const permMap: Record<string, Record<string, RbacPermission>> = {};
  for (const p of permissions) (permMap[p.resource] ??= {})[p.action] = p;
  const assignedPermIds = new Set(role?.permission_ids ?? []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  if (!role) return <div className="py-20 text-center text-sm text-slate-400">Role not found</div>;

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div>
        <button
          onClick={() => router.push("/rbac/roles")}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors mb-3"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Roles
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              {role.name}
              <code className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{role.code}</code>
            </h2>
            {role.description && <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">Permissions</p>
          <p className="text-2xl font-bold text-slate-900">
            {role.code === "admin" ? "All" : role.permission_ids.length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">Members</p>
          <p className="text-2xl font-bold text-slate-900">{roleUsers.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(["permissions", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t === "permissions" ? "Permission Matrix" : `Users (${roleUsers.length})`}
          </button>
        ))}
      </div>

      {/* Permission Matrix */}
      {tab === "permissions" && (
        role.code === "admin" ? (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">Full Access</p>
            <p className="text-xs text-slate-400 mt-1">Admin has unrestricted access to all features.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {saving !== null && (
              <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                Saving…
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 w-32">Module</th>
                    {actions.map((action) => (
                      <th key={action} className="px-4 py-3 text-center text-xs font-medium text-slate-500 capitalize">
                        {action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resources.map((resource) => (
                    <tr key={resource} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-700 capitalize text-sm">{resource}</td>
                      {actions.map((action) => {
                        const perm = permMap[resource]?.[action];
                        if (!perm) return (
                          <td key={action} className="px-4 py-3.5 text-center text-slate-200 text-xs">—</td>
                        );
                        const assigned = assignedPermIds.has(perm.id);
                        const isSaving = saving === perm.id;
                        return (
                          <td key={action} className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => togglePermission(perm, assigned)}
                              disabled={saving !== null}
                              title={perm.name}
                              className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-all disabled:opacity-50
                                ${assigned ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300 hover:border-slate-500"}`}
                            >
                              {isSaving ? (
                                <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                              ) : assigned ? (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Users tab */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{roleUsers.length} member{roleUsers.length !== 1 ? "s" : ""} assigned to this role</p>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add member
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {roleUsers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">No members assigned to this role</p>
                <button
                  onClick={() => setAddOpen(true)}
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                >
                  Add the first member
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {roleUsers.map((user) => (
                  <li key={user.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-600">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.email}</p>
                      <p className="text-xs text-slate-400">{user.is_active ? "Active" : "Inactive"}</p>
                    </div>
                    <button
                      onClick={() => setRemovingUser(user)}
                      className="text-xs text-slate-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Add member dialog */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Add member to "{role.name}"</h3>
            <p className="text-xs text-slate-400 mb-4">Create a new account or assign an existing member.</p>

            <div className="flex bg-slate-100 rounded-lg p-0.5 mb-4">
              <button
                onClick={() => { setAddMode("existing"); setAddError(""); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all
                  ${addMode === "existing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Existing member
              </button>
              <button
                onClick={() => { setAddMode("new"); setAddError(""); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all
                  ${addMode === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Create new user
              </button>
            </div>

            {addMode === "existing" ? (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:border-slate-400 mb-3"
              >
                <option value="">Select member…</option>
                {unassignedMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email}{m.role_name ? ` (currently: ${m.role_name})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 mb-3">
                <input
                  type="email"
                  placeholder="Email address"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setAddError(""); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setAddError(""); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
                />
              </div>
            )}

            {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}

            <div className="flex gap-2">
              <button
                onClick={resetAddDialog}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={addSaving || (addMode === "existing" ? !selectedUserId : !newEmail || !newPassword)}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {addSaving ? (addMode === "new" ? "Creating…" : "Adding…") : (addMode === "new" ? "Create & assign" : "Add")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {removingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Remove member?</h3>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-medium">{removingUser.email}</span> will no longer have the {role.name} role.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRemovingUser(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveUser(removingUser)}
                disabled={removeLoading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {removeLoading ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
