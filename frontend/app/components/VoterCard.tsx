"use client";

import type { Voter } from "@/lib/api";

const GENDER_LABEL: Record<string, string> = {
  male: "पुरुष",
  female: "स्त्री",
  third: "तृतीय लिंग",
};

const RELATION_LABEL: Record<string, string> = {
  father: "पिता",
  husband: "पति",
  mother: "माता",
  other: "अन्य",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  deleted_death: "bg-red-100 text-red-700",
  deleted_shifted: "bg-orange-100 text-orange-700",
  deleted_repeat: "bg-yellow-100 text-yellow-700",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  deleted_death: "Deleted (Death)",
  deleted_shifted: "Deleted (Shifted)",
  deleted_repeat: "Deleted (Repeat)",
};

export default function VoterCard({ voter }: { voter: Voter }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-indigo-200 text-xs font-medium uppercase tracking-wide">EPIC No.</p>
          <p className="text-white text-xl font-mono font-bold">{voter.epic_no}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[voter.status] ?? "bg-gray-100 text-gray-600"}`}>
          {STATUS_LABEL[voter.status] ?? voter.status}
        </span>
      </div>

      {/* Name */}
      <div className="px-6 py-5 border-b border-gray-100">
        <p className="text-2xl font-bold text-gray-900">{voter.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{voter.name_en}</p>
        {voter.hamlet && (
          <p className="text-xs text-indigo-600 mt-1 font-medium">{voter.hamlet}</p>
        )}
      </div>

      {/* Details grid */}
      <div className="px-6 py-5 grid grid-cols-2 gap-4">
        <Field label={RELATION_LABEL[voter.relation_type] ?? voter.relation_type} value={voter.relative_name} sub={voter.relative_name_en} />
        <Field label="मकान संख्या" value={voter.house_no} />
        <Field label="आयु" value={`${voter.age} वर्ष`} />
        <Field label="लिंग" value={GENDER_LABEL[voter.gender] ?? voter.gender} />
        <Field label="क्रम संख्या" value={String(voter.serial_no)} />
      </div>

      {/* Booth */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">मतदान केन्द्र</p>
        <p className="text-sm font-medium text-gray-800">
          {voter.booth.booth_name ?? `Booth ${voter.booth.booth_no}`}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          वार्ड {voter.booth.ward_no} · {voter.booth.gram_panchayat} · {voter.booth.panchayat_samiti} · {voter.booth.district}
        </p>
        {voter.booth.assembly_constituency && (
          <p className="text-xs text-gray-400 mt-0.5">विधानसभा: {voter.booth.assembly_constituency}</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
