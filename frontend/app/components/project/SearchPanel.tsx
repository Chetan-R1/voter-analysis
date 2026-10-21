"use client";

import { useCallback, useState } from "react";
import type { Relation, SearchResult, Voter, WardStats } from "@/lib/types";
import { searchVoterByEpic, searchVoters, getFamily, getWardStats } from "@/lib/api";
import VoterCard from "@/app/components/VoterCard";
import RelationshipTree from "@/app/components/RelationshipTree";
import WardStatsCard from "@/app/components/WardStats";
import { useLang } from "@/app/context/LanguageContext";

type DetailTab = "voter" | "family" | "ward";

export default function SearchPanel() {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [wardStats, setWardStats] = useState<WardStats | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("voter");

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setError(""); setSearching(true);
    setSelectedVoter(null); setResults(null); setRelations([]); setWardStats(null);
    try {
      const exact = await searchVoterByEpic(trimmed);
      if (exact) {
        setSelectedVoter(exact); setDetailTab("voter");
        const [rels, stats] = await Promise.all([getFamily(exact.id), getWardStats(exact.booth.id)]);
        setRelations(rels); setWardStats(stats);
      } else {
        const res = await searchVoters({ q: trimmed, page_size: 50 });
        if (res.total === 0) setError(t.search.notFound(trimmed));
        else setResults(res);
      }
    } catch {
      setError(t.search.failed);
    } finally {
      setSearching(false);
    }
  }, []);

  async function selectVoter(epic: string) {
    setSearching(true); setResults(null); setSelectedVoter(null);
    try {
      const v = await searchVoterByEpic(epic);
      if (!v) return;
      setSelectedVoter(v); setDetailTab("voter");
      const [rels, stats] = await Promise.all([getFamily(v.id), getWardStats(v.booth.id)]);
      setRelations(rels); setWardStats(stats);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); doSearch(query); }} className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>
        <button
          type="submit" disabled={searching || !query.trim()}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          {searching
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : t.search.searchBtn}
        </button>
      </form>

      {error && (
        <div className="bg-slate-100 border border-slate-200 text-slate-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {results && !selectedVoter && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-xs text-slate-500">
            {results.total} results
          </div>
          <ul className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {results.voters.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => selectVoter(v.epic_no)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{v.name}</p>
                      {v.name_en && <p className="text-xs text-slate-500">{v.name_en}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-indigo-600">{v.epic_no}</p>
                      <p className="text-xs text-slate-400">{v.booth.gram_panchayat} · Ward {v.booth.ward_no}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedVoter && (
        <div className="space-y-3">
          <button
            onClick={() => { setSelectedVoter(null); if (query) doSearch(query); }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t.search.back}
          </button>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(["voter", "family", "ward"] as DetailTab[]).map((tab) => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize
                  ${detailTab === tab ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {tab === "family" ? t.search.tabFamily(relations.length) : tab === "voter" ? t.search.tabVoter : t.search.tabWard}
              </button>
            ))}
          </div>
          {detailTab === "voter" && <VoterCard voter={selectedVoter} />}
          {detailTab === "family" && <RelationshipTree relations={relations} onSelect={selectVoter} />}
          {detailTab === "ward" && wardStats && <WardStatsCard stats={wardStats} />}
        </div>
      )}

      {!selectedVoter && !results && !searching && !error && (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <svg className="w-8 h-8 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-slate-400 text-sm">{t.search.emptyTitle}</p>
          <p className="text-slate-300 text-xs mt-1">{t.search.emptyHint}</p>
        </div>
      )}
    </div>
  );
}
