"use client";

import type { Voter } from "@/lib/api";
import { useLang } from "@/app/context/LanguageContext";

export default function VoterTable({
  voters,
  total,
  onSelect,
}: {
  voters: Voter[];
  total: number;
  onSelect: (epic: string) => void;
}) {
  const { t } = useLang();
  const T = t.table;

  const GENDER_BADGE: Record<string, string> = {
    male:   "bg-sky-100 text-sky-700",
    female: "bg-rose-100 text-rose-700",
    third:  "bg-purple-100 text-purple-700",
  };
  const GENDER_LABEL: Record<string, string> = {
    male: T.male, female: T.female, third: T.other,
  };
  const RELATION_LABEL: Record<string, string> = {
    father: T.father, husband: T.husband, mother: T.mother,
  };

  if (voters.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-6 py-12 text-center text-sm text-slate-400">
        {T.empty}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{total}</span>{" "}
          {T.found(total).replace(String(total), "").trim()}
          {voters.length < total && (
            <span className="text-slate-400"> · {T.showing(voters.length)}</span>
          )}
        </p>
      </div>
      <div className="divide-y divide-slate-50">
        {voters.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.epic_no)}
            className="w-full text-left px-5 py-3.5 hover:bg-indigo-50/40 transition-colors flex items-center gap-4 group"
          >
            <div className="shrink-0 w-9 text-right">
              <p className="text-xs font-bold text-slate-300 group-hover:text-slate-400">#{v.serial_no}</p>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-800 text-sm">{v.name}</p>
                {v.name_en && <p className="text-xs text-slate-400">{v.name_en}</p>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {RELATION_LABEL[v.relation_type] ?? v.relation_type}: {v.relative_name}
                {" · "}{T.house} {v.house_no}
                {v.hamlet && <span className="text-slate-400"> · {v.hamlet}</span>}
              </p>
              <p className="text-xs text-slate-300 font-mono mt-0.5 tracking-wide">{v.epic_no}</p>
            </div>

            <div className="shrink-0 text-right space-y-1.5">
              <p className="text-sm font-bold text-slate-700">{v.age} {T.yrs}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GENDER_BADGE[v.gender] ?? "bg-slate-100 text-slate-500"}`}>
                {GENDER_LABEL[v.gender] ?? v.gender}
              </span>
            </div>

            <svg className="w-4 h-4 text-slate-200 group-hover:text-slate-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
