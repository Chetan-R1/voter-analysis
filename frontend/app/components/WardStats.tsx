"use client";

import type { WardStats } from "@/lib/api";

export default function WardStatsCard({ stats, compact = false }: { stats: WardStats; compact?: boolean }) {
  const maleP = Math.round((stats.male / stats.total) * 100);
  const femaleP = Math.round((stats.female / stats.total) * 100);

  const hasAge = Object.keys(stats.age_groups).length > 0;
  const hasHamlets = stats.hamlets.length > 0;

  if (compact && !hasAge && !hasHamlets) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {!compact && (
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">वार्ड विश्लेषण (Ward Analysis)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Ward {stats.booth.ward_no} · {stats.booth.gram_panchayat}</p>
        </div>
      )}

      <div className="px-6 py-5 space-y-5">
        {!compact && (
          <>
            {/* Total + gender tiles */}
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="कुल मतदाता" value={stats.total} color="indigo" />
              <StatTile label="पुरुष" value={stats.male} color="blue" />
              <StatTile label="स्त्री" value={stats.female} color="pink" />
            </div>

            {/* Gender bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>पुरुष {maleP}%</span>
                <span>स्त्री {femaleP}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                <div className="bg-blue-500 h-full" style={{ width: `${maleP}%` }} />
                <div className="bg-pink-400 h-full" style={{ width: `${femaleP}%` }} />
              </div>
            </div>
          </>
        )}

        {/* Age groups */}
        {hasAge && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Age Groups</p>
            <div className="space-y-1.5">
              {Object.entries(stats.age_groups)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([group, count]) => {
                  const pct = Math.round((count / stats.total) * 100);
                  return (
                    <div key={group} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 shrink-0">{group}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Hamlets */}
        {hasHamlets && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ढाणी / Hamlet</p>
            <div className="space-y-1">
              {stats.hamlets.map(({ hamlet, count }) => (
                <div key={hamlet} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{hamlet}</span>
                  <span className="text-gray-400 ml-2 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    blue: "bg-blue-50 text-blue-700",
    pink: "bg-pink-50 text-pink-700",
  };
  return (
    <div className={`rounded-xl px-3 py-3 text-center ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
