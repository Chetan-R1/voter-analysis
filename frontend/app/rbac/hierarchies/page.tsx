"use client";

import { useEffect, useState } from "react";
import { listOrganizations, getRoles, listHierarchies, createHierarchy, deleteHierarchy } from "@/lib/api";
import type { Organization, RbacRole } from "@/lib/types";
import type { RoleHierarchy } from "@/lib/api/rbac";

type ViewMode = "list" | "tree";

export default function HierarchiesPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [hierarchies, setHierarchies] = useState<RoleHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [parentId, setParentId] = useState<number | "">("");
  const [childId, setChildId] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    listOrganizations().then(async (orgs) => {
      if (!orgs.length) return;
      const o = orgs[0];
      setOrg(o);
      const [r, h] = await Promise.all([getRoles(o.id), listHierarchies(o.id)]);
      setRoles(r);
      setHierarchies(h);
    }).finally(() => setLoading(false));
  }, []);

  async function refresh() {
    if (!org) return;
    const [r, h] = await Promise.all([getRoles(org.id), listHierarchies(org.id)]);
    setRoles(r);
    setHierarchies(h);
  }

  function roleName(id: number) {
    return roles.find((r) => r.id === id)?.name ?? `Role #${id}`;
  }

  async function handleCreate() {
    if (!org || !parentId || !childId) return;
    if (parentId === childId) { setCreateError("A role cannot inherit from itself."); return; }
    setCreating(true);
    setCreateError("");
    try {
      await createHierarchy(org.id, { parent_role_id: Number(parentId), child_role_id: Number(childId) });
      await refresh();
      setCreateOpen(false);
      setParentId("");
      setChildId("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(msg ?? "Failed to create hierarchy.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!org || !deletingId) return;
    setDeleteLoading(true);
    try {
      await deleteHierarchy(org.id, deletingId);
      await refresh();
      setDeletingId(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  // Build tree structure for tree view
  function buildTree() {
    const childrenOf: Record<number, number[]> = {};
    const hasParent = new Set<number>();
    for (const h of hierarchies) {
      (childrenOf[h.parent_role_id] ??= []).push(h.child_role_id);
      hasParent.add(h.child_role_id);
    }
    const roots = roles
      .filter((r) => !hasParent.has(r.id) && childrenOf[r.id]?.length)
      .map((r) => r.id);
    return { childrenOf, roots };
  }

  function TreeNode({ roleId, depth = 0, childrenOf }: { roleId: number; depth?: number; childrenOf: Record<number, number[]> }) {
    const children = childrenOf[roleId] ?? [];
    return (
      <div style={{ marginLeft: depth * 20 }}>
        <div className={`flex items-center gap-2 py-2 ${depth > 0 ? "border-l-2 border-slate-200 pl-4 ml-1" : ""}`}>
          {depth > 0 && (
            <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <span className={`text-sm font-medium text-slate-700 ${depth === 0 ? "text-slate-900" : ""}`}>
            {roleName(roleId)}
          </span>
          {depth > 0 && (
            <span className="text-xs text-slate-400 ml-1">inherits from parent</span>
          )}
        </div>
        {children.map((cId) => (
          <TreeNode key={cId} roleId={cId} depth={depth + 1} childrenOf={childrenOf} />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  const { childrenOf, roots } = buildTree();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Role Hierarchies</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Child roles inherit all permissions from their parent role
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === "list" ? "tree" : "list")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
          >
            {view === "list" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Tree view
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List view
              </>
            )}
          </button>
          <button
            onClick={() => { setCreateOpen(true); setCreateError(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New relationship
          </button>
        </div>
      </div>

      {/* Content */}
      {hierarchies.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl py-16 text-center">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600">No hierarchies defined</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Create parent–child relationships between roles so permissions cascade.</p>
          <button
            onClick={() => { setCreateOpen(true); setCreateError(""); }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Add first relationship
          </button>
        </div>
      ) : view === "list" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <ul className="divide-y divide-slate-50">
            {hierarchies.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-slate-800">{roleName(h.child_role_id)}</span>
                  <span className="text-xs text-slate-400">inherits from</span>
                  <span className="text-sm font-medium text-indigo-700">{roleName(h.parent_role_id)}</span>
                </div>
                <button
                  onClick={() => setDeletingId(h.id)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // Tree view
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          {roots.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No tree structure to display</p>
          ) : (
            roots.map((rootId) => (
              <TreeNode key={rootId} roleId={rootId} childrenOf={childrenOf} />
            ))
          )}
        </div>
      )}

      {/* Create dialog */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">New hierarchy relationship</h3>
            <p className="text-xs text-slate-400 mb-5">The child role will inherit all permissions of the parent role.</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Parent role</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:border-slate-400"
                >
                  <option value="">Select parent…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-px h-4 bg-slate-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Child role (inherits from parent)</label>
                <select
                  value={childId}
                  onChange={(e) => { setChildId(e.target.value ? Number(e.target.value) : ""); setCreateError(""); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:border-slate-400"
                >
                  <option value="">Select child…</option>
                  {roles
                    .filter((r) => r.id !== parentId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
              </div>
            </div>

            {createError && (
              <p className="text-xs text-red-600 mb-3">{createError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setCreateOpen(false); setParentId(""); setChildId(""); setCreateError(""); }}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!parentId || !childId || creating}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Remove relationship?</h3>
            <p className="text-sm text-slate-500 mb-5">
              The child role will no longer inherit permissions from the parent role.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleteLoading ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
