"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  me, searchVoter, searchVoters, getRelationships, getWardStats,
  getWardVoters, listBooths, presignUpload, registerUpload,
} from "@/lib/api";
import type { Voter, Relation, WardStats, Booth, SearchResult, WardVotersResult } from "@/lib/api";
import api from "@/lib/api";
import { useLang } from "@/app/context/LanguageContext";
import Navbar from "./components/Navbar";
import VoterCard from "./components/VoterCard";
import RelationshipTree from "./components/RelationshipTree";
import WardStatsCard from "./components/WardStats";
import VoterTable from "./components/VoterTable";

type Section = "upload" | "search" | "browse";
type DetailTab = "voter" | "family" | "ward";

interface ImportRecord {
  id: number; file_name: string;
  status: "uploaded" | "processing" | "done" | "review" | "failed";
  total_voters: number | null; issues: number;
  imported_at: string | null; ward: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [section, setSection] = useState<Section>("upload");

  // ── Upload ──
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsgs, setUploadMsgs] = useState<{ text: string; ok: boolean }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Search ──
  const [query, setQuery] = useState("");
  const [nameResults, setNameResults] = useState<SearchResult | null>(null);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [wardStats, setWardStats] = useState<WardStats | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("voter");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ── Browse ──
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBooth, setSelectedBooth] = useState<number | "">("");
  const [filterGender, setFilterGender] = useState("");
  const [filterAgeMin, setFilterAgeMin] = useState("");
  const [filterAgeMax, setFilterAgeMax] = useState("");
  const [sortBy, setSortBy] = useState("serial");
  const [browsePage, setBrowsePage] = useState(1);
  const [wardResult, setWardResult] = useState<WardVotersResult | null>(null);
  const [browseStats, setBrowseStats] = useState<WardStats | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    me().then((u) => setEmail(u.email)).catch(() => router.replace("/login"));
    fetchImports();
    listBooths().then(setBooths).catch(() => {});
  }, [router]);

  useEffect(() => {
    const hasActive = imports.some((i) => i.status === "processing" || i.status === "uploaded");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchImports();
        listBooths().then(setBooths).catch(() => {});
      }, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [imports]);

  async function fetchImports() {
    try { const { data } = await api.get<ImportRecord[]>("/imports"); setImports(data); } catch {}
  }

  async function uploadFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { addMsg(t.upload.pdfOnly, false); return; }
    setUploading(true);
    for (const file of pdfs) {
      try {
        // Try presigned R2 upload first
        const presign = await presignUpload(file.name);
        if (presign) {
          // Upload directly to R2 from browser
          const r2res = await fetch(presign.upload_url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": "application/pdf" },
          });
          if (!r2res.ok) throw new Error(`R2 upload failed: ${r2res.status}`);
          // Register with backend to start extraction
          const reg = await registerUpload(presign.key, file.name);
          addMsg(reg.skipped ? t.upload.alreadyImported(file.name) : t.upload.uploadOk(file.name), true);
        } else {
          // Fallback: send through backend (local mode)
          const form = new FormData();
          form.append("file", file);
          const { data } = await api.post("/imports/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
          addMsg(data.skipped ? t.upload.alreadyImported(file.name) : t.upload.uploadOk(file.name), true);
        }
      } catch (e: any) {
        addMsg(t.upload.uploadFail(file.name, e?.response?.data?.detail ?? e?.message ?? "upload failed"), false);
      }
    }
    setUploading(false); fetchImports();
  }
  function addMsg(text: string, ok: boolean) {
    setUploadMsgs((p) => [{ text, ok }, ...p].slice(0, 8));
  }

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchError(""); setSearching(true);
    setSelectedVoter(null); setNameResults(null); setRelations([]); setWardStats(null);
    try {
      const exact = await searchVoter(trimmed);
      if (exact) {
        setSelectedVoter(exact); setDetailTab("voter");
        const [rels, stats] = await Promise.all([getRelationships(exact.id), getWardStats(exact.booth.id)]);
        setRelations(rels); setWardStats(stats);
      } else {
        const res = await searchVoters({ q: trimmed, page_size: 50 });
        if (res.total === 0) setSearchError(t.search.notFound(trimmed));
        else setNameResults(res);
      }
    } catch { setSearchError(t.search.failed); }
    finally { setSearching(false); }
  }, [t]);

  async function selectVoter(epic: string) {
    setSearching(true); setNameResults(null); setSelectedVoter(null);
    try {
      const v = await searchVoter(epic);
      if (!v) return;
      setSelectedVoter(v); setDetailTab("voter");
      const [rels, stats] = await Promise.all([getRelationships(v.id), getWardStats(v.booth.id)]);
      setRelations(rels); setWardStats(stats);
    } finally { setSearching(false); }
  }

  const loadWard = useCallback(async (boothId: number, page = 1) => {
    setBrowseLoading(true);
    try {
      const [res, stats] = await Promise.all([
        getWardVoters(boothId, {
          gender: filterGender || undefined,
          age_min: filterAgeMin ? Number(filterAgeMin) : undefined,
          age_max: filterAgeMax ? Number(filterAgeMax) : undefined,
          sort: sortBy as any,
          page,
          page_size: 50,
        }),
        page === 1 ? getWardStats(boothId) : Promise.resolve(null),
      ]);
      setWardResult(res); setBrowsePage(page);
      if (stats) setBrowseStats(stats);
    } finally { setBrowseLoading(false); }
  }, [filterGender, filterAgeMin, filterAgeMax, sortBy]);

  useEffect(() => {
    if (selectedBooth) loadWard(Number(selectedBooth), 1);
    else { setWardResult(null); setBrowseStats(null); }
  }, [selectedBooth, filterGender, filterAgeMin, filterAgeMax, sortBy, loadWard]);

  const doneCount = imports.filter((i) => i.status === "done" || i.status === "review").length;
  const processingCount = imports.filter((i) => i.status === "processing" || i.status === "uploaded").length;

  const STATUS_COLOR: Record<string, string> = {
    uploaded: "text-slate-400", processing: "text-amber-500",
    done: "text-emerald-600", review: "text-orange-500", failed: "text-red-500",
  };
  const STATUS_DOT: Record<string, string> = {
    uploaded: "bg-slate-300", processing: "bg-amber-400 animate-pulse",
    done: "bg-emerald-500", review: "bg-orange-400", failed: "bg-red-500",
  };
  const STATUS_LABEL = {
    uploaded: t.upload.statusQueued,
    processing: t.upload.statusProcessing,
    done: t.upload.statusComplete,
    review: t.upload.statusReview,
    failed: t.upload.statusFailed,
  };

  const TABS = [
    { key: "upload" as Section, label: t.tabs.upload, icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
    )},
    { key: "search" as Section, label: t.tabs.search, icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    )},
    { key: "browse" as Section, label: t.tabs.browse, icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar email={email} />

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setSection(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors
                ${section === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {tab.icon} {tab.label}
              {tab.key === "upload" && processingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ════════════ IMPORT PDFs ════════════ */}
        {section === "upload" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { step: "1", title: t.upload.step1Title, desc: t.upload.step1Desc, bg: "bg-indigo-50", border: "border-indigo-100", dot: "bg-indigo-600" },
                { step: "2", title: t.upload.step2Title, desc: t.upload.step2Desc, bg: "bg-violet-50", border: "border-violet-100", dot: "bg-violet-600" },
                { step: "3", title: t.upload.step3Title, desc: t.upload.step3Desc, bg: "bg-emerald-50", border: "border-emerald-100", dot: "bg-emerald-600" },
              ].map((s) => (
                <div key={s.step} className={`rounded-xl p-4 ${s.bg} border ${s.border}`}>
                  <div className={`w-7 h-7 rounded-full ${s.dot} text-white text-xs font-bold flex items-center justify-center mb-2.5`}>{s.step}</div>
                  <p className="font-semibold text-sm text-slate-700">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
              onClick={() => !uploading && fileInput.current?.click()}
              className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer py-16 px-8 text-center
                ${dragOver ? "border-indigo-400 bg-indigo-50/80 scale-[1.01]"
                : uploading ? "border-indigo-300 bg-indigo-50/50 cursor-wait"
                : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}`}
            >
              <input ref={fileInput} type="file" accept=".pdf" multiple className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                  <p className="text-indigo-600 font-semibold">{t.upload.uploading}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200">
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-700">{t.upload.dropTitle}</p>
                    <p className="text-sm text-slate-400 mt-1">{t.upload.dropSub}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">{t.upload.badgeType}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">{t.upload.badgeAuto}</span>
                  </div>
                </div>
              )}
            </div>

            {uploadMsgs.length > 0 && (
              <div className="space-y-1.5">
                {uploadMsgs.map((m, i) => (
                  <div key={i} className={`text-sm rounded-lg px-4 py-2.5 flex items-center gap-2
                    ${m.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"}`}>
                    <span className="font-bold text-base leading-none">{m.ok ? "✓" : "✗"}</span>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{t.upload.historyTitle}</h3>
                  {processingCount > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                      {t.upload.processingN(processingCount)}
                    </p>
                  )}
                </div>
                <button onClick={fetchImports} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{t.upload.refresh}</button>
              </div>

              {imports.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-slate-400 text-sm">{t.upload.noImports}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="text-left px-6 py-3 font-semibold">{t.upload.colFile}</th>
                      <th className="text-left px-4 py-3 font-semibold">{t.upload.colWard}</th>
                      <th className="text-right px-4 py-3 font-semibold">{t.upload.colVoters}</th>
                      <th className="text-right px-6 py-3 font-semibold">{t.upload.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {imports.map((imp) => (
                      <tr key={imp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-slate-700 truncate max-w-[200px]">{imp.file_name}</p>
                          {imp.issues > 0 && <p className="text-xs text-orange-500 mt-0.5">{t.upload.issuesBadge(imp.issues)}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-sm">{imp.ward ?? "—"}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-700">{imp.total_voters ?? "—"}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-3">
                            {(imp.status === "failed" || imp.status === "review") && (
                              <button
                                onClick={async () => {
                                  await api.post(`/imports/${imp.id}/retry`);
                                  fetchImports();
                                }}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                              >
                                Retry
                              </button>
                            )}
                            {imp.status === "failed" && (
                              <button
                                onClick={async () => {
                                  await api.delete(`/imports/${imp.id}`);
                                  fetchImports();
                                }}
                                className="text-xs font-semibold text-red-400 hover:text-red-600"
                              >
                                Delete
                              </button>
                            )}
                            <div className={`flex items-center gap-1.5 font-medium text-sm ${STATUS_COLOR[imp.status]}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[imp.status]}`} />
                              {STATUS_LABEL[imp.status as keyof typeof STATUS_LABEL]}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {doneCount > 0 && (
                <div className="px-6 py-3 bg-indigo-50 border-t border-indigo-100 flex gap-5">
                  <button onClick={() => setSection("search")}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                    {t.upload.linkSearch}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={() => setSection("browse")}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                    {t.upload.linkBrowse}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════ SEARCH VOTERS ════════════ */}
        {section === "search" && (
          <>
            {doneCount === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {t.search.noWardWarning}{" "}
                <button onClick={() => setSection("upload")} className="underline font-semibold">{t.search.importFirst}</button>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); doSearch(query); }}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.search.placeholder}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
                <button type="submit" disabled={searching || !query.trim()}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2">
                  {searching
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    : t.search.searchBtn}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 pl-1">{t.search.hint}</p>
            </form>

            {searchError && (
              <div className="bg-slate-100 border border-slate-200 text-slate-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                {searchError}
              </div>
            )}

            {nameResults && !selectedVoter && (
              <VoterTable voters={nameResults.voters} total={nameResults.total} onSelect={selectVoter} />
            )}

            {selectedVoter && (
              <div className="space-y-4">
                <button onClick={() => { setSelectedVoter(null); if (query) doSearch(query); }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  {t.search.back}
                </button>
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {([
                    { key: "voter" as DetailTab, label: t.search.tabVoter },
                    { key: "family" as DetailTab, label: t.search.tabFamily(relations.length) },
                    { key: "ward" as DetailTab, label: t.search.tabWard },
                  ]).map((tab) => (
                    <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all
                        ${detailTab === tab.key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {detailTab === "voter" && <VoterCard voter={selectedVoter} />}
                {detailTab === "family" && <RelationshipTree relations={relations} onSelect={selectVoter} />}
                {detailTab === "ward" && wardStats && <WardStatsCard stats={wardStats} />}
              </div>
            )}

            {!selectedVoter && !nameResults && !searching && !searchError && (
              <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">{t.search.emptyTitle}</p>
                <p className="text-slate-400 text-sm mt-1">{t.search.emptyHint}</p>
              </div>
            )}
          </>
        )}

        {/* ════════════ BROWSE BY WARD ════════════ */}
        {section === "browse" && (
          <>
            {/* Ward selector + filters — always full width at top */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t.browse.wardLabel}</label>
                  <select
                    value={selectedBooth}
                    onChange={(e) => { setSelectedBooth(e.target.value ? Number(e.target.value) : ""); setBrowsePage(1); }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">{t.browse.wardPlaceholder}</option>
                    {booths.map((b) => (
                      <option key={b.id} value={b.id}>
                        {t.browse.wardOption(b.ward_no, b.gram_panchayat, b.district)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBooth && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t.browse.genderLabel}</label>
                      <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                        <option value="">{t.browse.gAll}</option>
                        <option value="male">{t.browse.gMale}</option>
                        <option value="female">{t.browse.gFemale}</option>
                        <option value="third">{t.browse.gOther}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t.browse.ageFrom}</label>
                      <input type="number" min={18} max={120} value={filterAgeMin}
                        onChange={(e) => setFilterAgeMin(e.target.value)} placeholder="18"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t.browse.ageTo}</label>
                      <input type="number" min={18} max={120} value={filterAgeMax}
                        onChange={(e) => setFilterAgeMax(e.target.value)} placeholder="100"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t.browse.sortLabel}</label>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                        <option value="serial">{t.browse.sSerial}</option>
                        <option value="age_asc">{t.browse.sAgeAsc}</option>
                        <option value="age_desc">{t.browse.sAgeDesc}</option>
                        <option value="name">{t.browse.sName}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Two-column layout once a ward is selected */}
            {(wardResult || browseLoading) ? (
              <div className="flex gap-5 items-start">
                {/* LEFT: stats panel */}
                <div className="w-64 shrink-0 space-y-3">
                  {wardResult && (
                    <>
                      {/* Summary tiles */}
                      {[
                        { label: t.browse.statTotal, value: wardResult.summary.total, sub: t.browse.statTotalSub, cls: "border-indigo-100 bg-indigo-50 text-indigo-700" },
                        { label: t.browse.statMale, value: wardResult.summary.male, sub: `${wardResult.summary.total ? Math.round(wardResult.summary.male / wardResult.summary.total * 100) : 0}%`, cls: "border-sky-100 bg-sky-50 text-sky-700" },
                        { label: t.browse.statFemale, value: wardResult.summary.female, sub: `${wardResult.summary.total ? Math.round(wardResult.summary.female / wardResult.summary.total * 100) : 0}%`, cls: "border-rose-100 bg-rose-50 text-rose-700" },
                      ].map((c, i) => (
                        <div key={i} className={`rounded-xl border px-4 py-3 ${c.cls}`}>
                          <p className="text-2xl font-bold">{c.value}</p>
                          <p className="text-xs font-semibold mt-0.5 opacity-80">{c.label}</p>
                          <p className="text-xs opacity-50">{c.sub}</p>
                        </div>
                      ))}
                      {browseStats && <WardStatsCard stats={browseStats} compact />}
                    </>
                  )}
                </div>

                {/* RIGHT: voter table */}
                <div className="flex-1 min-w-0 space-y-4">
                  {browseLoading ? (
                    <div className="bg-white rounded-2xl border border-slate-200 py-14 flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
                      <p className="text-slate-400 text-sm">{t.browse.loading}</p>
                    </div>
                  ) : wardResult && (
                    <>
                      <VoterTable
                        voters={wardResult.voters}
                        total={wardResult.total}
                        onSelect={(epic) => { setQuery(epic); setSection("search"); selectVoter(epic); }}
                      />
                      {wardResult.pages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                          <button disabled={browsePage === 1}
                            onClick={() => loadWard(Number(selectedBooth), browsePage - 1)}
                            className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                            {t.browse.prev}
                          </button>
                          <span className="text-sm text-slate-500 font-medium">{t.browse.pageOf(browsePage, wardResult.pages)}</span>
                          <button disabled={browsePage === wardResult.pages}
                            onClick={() => loadWard(Number(selectedBooth), browsePage + 1)}
                            className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                            {t.browse.next}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">{t.browse.emptyTitle}</p>
                {booths.length === 0 && (
                  <p className="text-slate-400 text-sm mt-1">
                    {t.browse.noWardYet}{" "}
                    <button onClick={() => setSection("upload")} className="text-indigo-600 underline font-medium">{t.browse.importFirst}</button>
                  </p>
                )}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}
