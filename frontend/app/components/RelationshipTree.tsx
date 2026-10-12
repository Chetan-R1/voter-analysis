"use client";

import type { Relation } from "@/lib/api";

const RELATION_HINDI: Record<string, string> = {
  father: "पिता",
  mother: "माता",
  husband: "पति",
  wife: "पत्नी",
  son: "पुत्र",
  daughter: "पुत्री",
  brother: "भाई",
  sister: "बहन",
  sibling: "भाई / बहन",
  relative: "संबंधी",
};

const RELATION_COLOR: Record<string, string> = {
  father: "bg-blue-50 border-blue-200 text-blue-800",
  mother: "bg-purple-50 border-purple-200 text-purple-800",
  husband: "bg-rose-50 border-rose-200 text-rose-800",
  wife: "bg-pink-50 border-pink-200 text-pink-800",
  son: "bg-green-50 border-green-200 text-green-800",
  daughter: "bg-emerald-50 border-emerald-200 text-emerald-800",
  brother: "bg-orange-50 border-orange-200 text-orange-800",
  sister: "bg-yellow-50 border-yellow-200 text-yellow-800",
  sibling: "bg-amber-50 border-amber-200 text-amber-800",
  relative: "bg-slate-50 border-slate-200 text-slate-700",
};

export default function RelationshipTree({ relations, onSelect }: {
  relations: Relation[];
  onSelect: (epic: string) => void;
}) {
  if (relations.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-8 text-center">
        <p className="text-gray-500 font-medium text-sm">No family members found</p>
        <p className="text-gray-400 text-xs mt-1">No voters in this ward share the same name/relative name</p>
      </div>
    );
  }

  const grouped: Record<string, Relation[]> = {};
  for (const r of relations) {
    (grouped[r.relation] ??= []).push(r);
  }

  const ORDER = ["father", "mother", "husband", "wife", "son", "daughter", "sibling", "brother", "sister", "relative"];
  const sorted = ORDER.filter((k) => grouped[k]).concat(Object.keys(grouped).filter((k) => !ORDER.includes(k)));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Family Members</h3>
        <p className="text-xs text-gray-400 mt-0.5">{relations.length} member{relations.length !== 1 ? "s" : ""} found by name matching</p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {sorted.map((rel) => (
          <div key={rel}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {RELATION_HINDI[rel] ?? rel}
            </p>
            <div className="space-y-2">
              {grouped[rel].map((r) => (
                <button
                  key={r.voter.id}
                  onClick={() => onSelect(r.voter.epic_no)}
                  className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border transition-all hover:shadow-sm ${RELATION_COLOR[rel] ?? "bg-gray-50 border-gray-200 text-gray-800"}`}
                >
                  <div>
                    <p className="font-semibold text-sm">{r.voter.name}</p>
                    <p className="text-xs opacity-70">{r.voter.name_en} · {r.voter.epic_no}</p>
                    <p className="text-xs opacity-60 mt-0.5">Age {r.voter.age} · House {r.voter.house_no}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs opacity-60">House {r.voter.house_no}</span>
                    <svg className="w-4 h-4 opacity-40 mt-1 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
