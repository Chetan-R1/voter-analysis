"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { me, listOrganizations, listProjects, createProject } from "@/lib/api";
import type { Organization, Project } from "@/lib/types";
import { ELECTION_TYPE_LABELS } from "@/lib/types";
import Navbar from "@/app/components/Navbar";

const ELECTION_TYPES = Object.keys(ELECTION_TYPE_LABELS);

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    election_type: "gram_panchayat",
    state: "",
    district: "",
    constituency: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    me()
      .then((u) => setEmail(u.email))
      .catch(() => router.replace("/login"));

    listOrganizations()
      .then(async (orgs) => {
        if (!orgs.length) return;
        const o = orgs[0];
        setOrg(o);
        const ps = await listProjects(o.id);
        setProjects(ps);
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setCreating(true);
    setError("");
    try {
      const p = await createProject(org.id, {
        name: form.name,
        election_type: form.election_type,
        state: form.state || undefined,
        district: form.district || undefined,
        constituency: form.constituency || undefined,
      });
      setProjects((prev) => [p, ...prev]);
      setShowCreate(false);
      setForm({ name: "", election_type: "gram_panchayat", state: "", district: "", constituency: "" });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar email={email} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            {org && (
              <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">{org.name}</p>
            )}
            <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl py-20 text-center bg-white">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">No projects yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Create a project to start importing voter rolls</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  {!p.is_active && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium">Inactive</span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{ELECTION_TYPE_LABELS[p.election_type] ?? p.election_type}</p>

                {(p.district || p.constituency) && (
                  <p className="text-xs text-slate-400 mt-3 truncate">
                    {[p.district, p.constituency].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-5">New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Project Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. GP Election 2024"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Election Type *</label>
                <select
                  value={form.election_type}
                  onChange={(e) => setForm((f) => ({ ...f, election_type: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {ELECTION_TYPES.map((t) => (
                    <option key={t} value={t}>{ELECTION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">State</label>
                  <input
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    placeholder="e.g. Rajasthan"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">District</label>
                  <input
                    value={form.district}
                    onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                    placeholder="e.g. Alwar"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Constituency</label>
                <input
                  value={form.constituency}
                  onChange={(e) => setForm((f) => ({ ...f, constituency: e.target.value }))}
                  placeholder="e.g. Samer"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(""); }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {creating ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
