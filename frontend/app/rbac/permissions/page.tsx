"use client";

import { useEffect, useState } from "react";
import { listOrganizations, getPermissions } from "@/lib/api";
import type { Organization, RbacPermission } from "@/lib/types";

const ACTION_ORDER = ["read", "write", "create", "manage", "delete"];

const ACTION_COLOR: Record<string, string> = {
  read:    "bg-sky-50 text-sky-700 border-sky-200",
  write:   "bg-amber-50 text-amber-700 border-amber-200",
  create:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  manage:  "bg-purple-50 text-purple-700 border-purple-200",
  delete:  "bg-red-50 text-red-700 border-red-200",
};

export default function PermissionsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    listOrganizations().then(async (orgs) => {
      if (!orgs.length) return;
      const o = orgs[0];
      setOrg(o);
      setPermissions(await getPermissions(o.id));
    }).finally(() => setLoading(false));
  }, []);

  const resources = [...new Set(permissions.map((p) => p.resource))].sort();
  const actions = [...new Set(permissions.map((p) => p.action))].sort(
    (a, b) => (ACTION_ORDER.indexOf(a) ?? 99) - (ACTION_ORDER.indexOf(b) ?? 99)
  );

  const filtered = permissions.filter((p) => {
    if (resourceFilter && p.resource !== resourceFilter) return false;
    if (actionFilter && p.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.code.includes(q) || p.name.toLowerCase().includes(q) || p.resource.includes(q);
    }
    return true;
  });

  // Group by resource for display
  const grouped: Record<string, RbacPermission[]> = {};
  for (const p of filtered) (grouped[p.resource] ??= []).push(p);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Permissions</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {permissions.length} permissions across {resources.length} modules
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-slate-400 w-52"
          />
        </div>
        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
        >
          <option value="">All modules</option>
          {resources.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {(search || resourceFilter || actionFilter) && (
          <button
            onClick={() => { setSearch(""); setResourceFilter(""); setActionFilter(""); }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors px-2 py-1.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Permissions table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 text-center text-sm text-slate-400">
          No permissions match your filters
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Module</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <code className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.code}</code>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 font-medium">{p.name}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">
                      {p.resource}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded border capitalize font-medium ${ACTION_COLOR[p.action] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {p.action}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs ${p.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Permissions are system-defined. Assign them to roles from the{" "}
        <a href="/rbac/roles" className="text-indigo-600 hover:underline">Roles</a> tab.
      </p>
    </div>
  );
}
