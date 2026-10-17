"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listOrganizations,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from "@/lib/api";
import type { Organization, RbacRole } from "@/lib/types";

export default function RolesPage() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirm
  const [deletingRole, setDeletingRole] = useState<RbacRole | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listOrganizations().then(async (orgs) => {
      if (!orgs.length) return;
      const o = orgs[0];
      setOrg(o);
      setRoles(await getRoles(o.id));
    }).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditingRole(null);
    setForm({ name: "", code: "", description: "" });
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(role: RbacRole) {
    setEditingRole(role);
    setForm({ name: role.name, code: role.code, description: role.description ?? "" });
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setFormSaving(true);
    setFormError("");
    try {
      if (editingRole) {
        await updateRole(org.id, editingRole.id, {
          name: form.name,
          description: form.description || undefined,
        });
      } else {
        await createRole(org.id, {
          name: form.name,
          code: form.code,
          description: form.description || undefined,
        });
      }
      setRoles(await getRoles(org.id));
      setDialogOpen(false);
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? "Failed to save role");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete() {
    if (!org || !deletingRole) return;
    setDeleting(true);
    try {
      await deleteRole(org.id, deletingRole.id);
      setRoles(await getRoles(org.id));
      setDeleteConfirm(false);
      setDeletingRole(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  }

  // Auto-fill code from name
  function handleNameChange(name: string) {
    const code = editingRole
      ? form.code
      : name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setForm((f) => ({ ...f, name, code }));
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Roles</h2>
          <p className="text-xs text-slate-400 mt-0.5">{roles.length} role{roles.length !== 1 ? "s" : ""} in {org?.name}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Role
        </button>
      </div>

      {/* Roles table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {roles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">No roles yet</p>
            <button onClick={openCreate} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              Create your first role
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Code</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Permissions</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {roles.map((role) => (
                <tr
                  key={role.id}
                  onClick={() => router.push(`/rbac/roles/${role.id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{role.name}</p>
                        {role.description && (
                          <p className="text-xs text-slate-400 truncate max-w-48">{role.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{role.code}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-slate-500">
                      {role.code === "admin" ? "All" : role.permission_ids.length}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(role)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeletingRole(role); setDeleteConfirm(true); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {editingRole ? "Edit Role" : "New Role"}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              {editingRole ? "Update the role name and description." : "Create a role and assign permissions to it."}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Field Worker"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              {!editingRole && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Role code *</label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                    placeholder="e.g. field_worker"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers and underscores only. Cannot be changed later.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What can this role do?"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                />
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {formSaving ? "Saving…" : editingRole ? "Save changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && deletingRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Delete "{deletingRole.name}"?</h3>
            <p className="text-sm text-slate-500 mb-5">
              This role will be permanently deleted. Users assigned to it will lose its permissions.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteConfirm(false); setDeletingRole(null); }}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
