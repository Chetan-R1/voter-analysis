"use client";

import { useEffect, useState } from "react";
import {
  listOrganizations,
  getRoles,
  getOrgMembers,
  assignRoleToUser,
  removeRoleFromUser,
} from "@/lib/api";
import type { OrgMember, Organization, RbacRole } from "@/lib/types";

const ROLE_DOT: Record<string, string> = {
  admin:    "bg-red-500",
  leader:   "bg-amber-500",
  karkarta: "bg-sky-500",
};

const ROLE_BADGE: Record<string, string> = {
  admin:    "bg-red-50 text-red-700 border-red-200",
  leader:   "bg-amber-50 text-amber-700 border-amber-200",
  karkarta: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function MembersPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleChanging, setRoleChanging] = useState<number | null>(null);

  useEffect(() => {
    listOrganizations().then(async (orgs) => {
      if (!orgs.length) return;
      const o = orgs[0];
      setOrg(o);
      const [r, m] = await Promise.all([getRoles(o.id), getOrgMembers(o.id)]);
      setRoles(r);
      setMembers(m);
    }).finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(member: OrgMember, newRoleId: number | null) {
    if (!org) return;
    setRoleChanging(member.id);
    try {
      if (member.role_id) await removeRoleFromUser(org.id, member.id, member.role_id);
      if (newRoleId) await assignRoleToUser(org.id, member.id, newRoleId);
      setMembers(await getOrgMembers(org.id));
    } finally {
      setRoleChanging(null);
    }
  }

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
      <div>
        <h2 className="text-base font-semibold text-slate-900">Team Members</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Assign roles to members of <span className="font-medium text-slate-600">{org?.name}</span>
        </p>
      </div>

      {/* Role legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {roles.map((role) => {
          const count = members.filter((m) => m.role_code === role.code).length;
          return (
            <div key={role.id} className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${ROLE_DOT[role.code] ?? "bg-slate-300"}`} />
              {role.name}
              <span className="font-semibold text-slate-800 ml-0.5">{count}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
          No role
          <span className="font-semibold text-slate-800 ml-0.5">{members.filter((m) => !m.role_code).length}</span>
        </div>
      </div>

      {/* Members list */}
      <div className="space-y-2">
        {members.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-sm text-slate-400">
            No members in this organization
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-semibold text-slate-600">
                {member.email[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{member.email}</p>
                <div className="mt-0.5">
                  {member.role_code ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[member.role_code] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ROLE_DOT[member.role_code] ?? "bg-slate-400"}`} />
                      {member.role_name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">No role assigned</span>
                  )}
                </div>
              </div>

              {/* Role selector */}
              <div className="shrink-0">
                {roleChanging === member.id ? (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                  </div>
                ) : (
                  <select
                    value={member.role_id ?? ""}
                    onChange={(e) => handleRoleChange(member, e.target.value ? Number(e.target.value) : null)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer font-medium"
                  >
                    <option value="">Remove role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-slate-400">
        New members are added when they sign up.{" "}
        <a className="text-indigo-600 hover:underline cursor-pointer" onClick={() => window.location.reload()}>
          Refresh
        </a>{" "}
        to see latest members.
      </p>
    </div>
  );
}
