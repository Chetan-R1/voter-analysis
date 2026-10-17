"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { me } from "@/lib/api";
import Navbar from "@/app/components/Navbar";

const TABS = [
  { label: "Roles", href: "/rbac/roles" },
  { label: "Permissions", href: "/rbac/permissions" },
];

function RbacTabs() {
  const pathname = usePathname();
  return (
    <div className="flex">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href === "/rbac/roles" && pathname.startsWith("/rbac/roles"));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function RbacLayoutClient({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    me().then((u) => setEmail(u.email)).catch(() => {
      window.location.href = "/login";
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar email={email} />

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="h-11 flex items-center gap-2 border-b border-slate-100">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium"
            >
              Projects
            </Link>
            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-slate-900">Access Control</span>
          </div>

          <Suspense fallback={<div className="h-10" />}>
            <RbacTabs />
          </Suspense>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
