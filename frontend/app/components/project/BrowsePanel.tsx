"use client";

import { useCallback, useEffect, useState } from "react";
import type { Booth, WardStats, WardVotersResult } from "@/lib/types";
import { getWardVoters, getWardStats } from "@/lib/api";
import VoterTable from "@/app/components/VoterTable";
import WardStatsCard from "@/app/components/WardStats";

interface Props {
  booths: Booth[];
}

export default function BrowsePanel({ booths }: Props) {
  const [selectedBooth, setSelectedBooth] = useState<number | "">("");
  const [gender, setGender] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [sort, setSort] = useState("serial");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<WardVotersResult | null>(null);
  const [stats, setStats] = useState<WardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWard = useCallback(async (boothId: number, p = 1) => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        getWardVoters(boothId, {
          gender: gender || undefined,
          age_min: ageMin ? Number(ageMin) : undefined,
          age_max: ageMax ? Number(ageMax) : undefined,
          sort: sort as any, page: p, page_size: 50,
        }),
        p === 1 ? getWardStats(boothId) : Promise.resolve(null),
      ]);
      setResult(res); setPage(p);
      if (s) setStats(s);
    } finally {
      setLoading(false);
    }
  }, [gender, ageMin, ageMax, sort]);

  useEffect(() => {
    if (selectedBooth) loadWard(Number(selectedBooth), 1);
    else { setResult(null); setStats(null); }
  }, [selectedBooth, gender, ageMin, ageMax, sort, loadWard]);

  return (
    <div className="space-y-4">
      {/* Ward + filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Select Ward</label>
          <select
            value={selectedBooth}
            onChange={(e) => { setSelectedBooth(e.target.value ? Number(e.target.value) : ""); }}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">— Choose a ward —</option>
            {booths.map((b) => (
              <option key={b.id} value={b.id}>
                Ward {b.ward_no} · {b.gram_panchayat} ({b.district})
              </option>
            ))}
          </select>
        </div>

        {selectedBooth && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="">All</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="third">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Age From</label>
              <input type="number" min={18} value={ageMin} onChange={(e) => setAgeMin(e.target.value)}
                placeholder="18"
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Age To</label>
              <input type="number" min={18} value={ageMax} onChange={(e) => setAgeMax(e.target.value)}
                placeholder="100"
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Sort</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="serial">Serial</option>
                <option value="age_asc">Age ↑</option>
                <option value="age_desc">Age ↓</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total", value: result.summary.total, cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
                { label: "Male", value: result.summary.male, cls: "bg-sky-50 text-sky-700 border-sky-100" },
                { label: "Female", value: result.summary.female, cls: "bg-rose-50 text-rose-700 border-rose-100" },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.cls}`}>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs font-semibold opacity-70">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          <VoterTable voters={result.voters} total={result.total} onSelect={() => {}} />

          {result.pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={page === 1}
                onClick={() => loadWard(Number(selectedBooth), page - 1)}
                className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:border-indigo-300 transition-colors">
                Prev
              </button>
              <span className="text-sm text-slate-500">{page} / {result.pages}</span>
              <button disabled={page === result.pages}
                onClick={() => loadWard(Number(selectedBooth), page + 1)}
                className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-30 hover:border-indigo-300 transition-colors">
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <svg className="w-8 h-8 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-400 text-sm">
            {booths.length === 0 ? "No wards imported yet" : "Select a ward to browse voters"}
          </p>
        </div>
      )}
    </div>
  );
}
