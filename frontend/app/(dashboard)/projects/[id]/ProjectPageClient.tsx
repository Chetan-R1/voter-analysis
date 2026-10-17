"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { me, listOrganizations, getProject, getProjectBooths, getProjectImports, updateProject } from "@/lib/api";
import type { Booth, ImportRecord, Organization, Project } from "@/lib/types";
import { ELECTION_TYPE_LABELS } from "@/lib/types";
import Navbar from "@/app/components/Navbar";
import ImportPanel from "@/app/components/project/ImportPanel";
import SearchPanel from "@/app/components/project/SearchPanel";
import BrowsePanel from "@/app/components/project/BrowsePanel";

export default function ProjectPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = Number(id);

  const [email, setEmail] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    me().then((u) => setEmail(u.email)).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!projectId) return;
    listOrganizations().then(async (orgs) => {
      if (!orgs.length) return;
      const o = orgs[0];
      setOrg(o);
      const [p, b, i] = await Promise.all([
        getProject(o.id, projectId),
        getProjectBooths(o.id, projectId),
        getProjectImports(o.id, projectId),
      ]);
      setProject(p);
      setBooths(b);
      setImports(i);
    }).finally(() => setLoading(false));
  }, [projectId]);

  function startEditName() {
    if (!project) return;
    setNameInput(project.name);
    setEditingName(true);
  }

  async function saveProjectName() {
    if (!org || !project || !nameInput.trim() || nameInput.trim() === project.name) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    try {
      const updated = await updateProject(org.id, projectId, { name: nameInput.trim() });
      setProject(updated);
    } finally {
      setNameSaving(false);
      setEditingName(false);
    }
  }

  async function refreshImports() {
    if (!org) return;
    const [b, i] = await Promise.all([
      getProjectBooths(org.id, projectId),
      getProjectImports(org.id, projectId),
    ]);
    setBooths(b);
    setImports(i);
  }

  useEffect(() => {
    const hasActive = imports.some((i) => i.status === "processing" || i.status === "uploaded");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(refreshImports, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [imports]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar email={email} />

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 h-12 flex items-center gap-2">
          {/* Back */}
          <button
            onClick={() => router.push("/")}
            className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors shrink-0"
          >
            Projects
          </button>
          <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Project name — inline edit */}
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveProjectName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                onBlur={saveProjectName}
                className="text-sm font-semibold text-slate-900 bg-transparent border-b border-slate-400 outline-none py-0.5 w-40"
                autoFocus
              />
              {nameSaving && (
                <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin shrink-0" />
              )}
            </div>
          ) : (
            <button
              onClick={startEditName}
              className="group flex items-center gap-1 min-w-0"
              title="Click to rename"
            >
              <span className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                {project?.name ?? "Project"}
              </span>
              <svg className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          {/* Meta */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {project && (
              <span className="text-xs text-slate-400 hidden sm:block">
                {ELECTION_TYPE_LABELS[project.election_type] ?? project.election_type}
                {project.district ? ` · ${project.district}` : ""}
              </span>
            )}
            <span className="text-xs text-slate-400">{booths.length} ward{booths.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] gap-5 items-start">
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-0.5">Import PDFs</h2>
            <ImportPanel projectId={projectId} imports={imports} onRefresh={refreshImports} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-0.5">Search Voters</h2>
            <SearchPanel />
          </div>
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-0.5">Browse by Ward</h2>
            <BrowsePanel booths={booths} />
          </div>
        </div>
      </div>
    </div>
  );
}
