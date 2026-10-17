"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { useLang } from "@/app/context/LanguageContext";

export default function Navbar({ email }: { email: string }) {
  const router = useRouter();
  const { lang, toggle, t } = useLang();

  async function handleLogout() {
    await logout().catch(() => {});
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-slate-200 px-4">
      <div className="max-w-[1400px] mx-auto h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-semibold text-slate-800 text-sm">{t.appName}</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 px-2 hidden sm:block">{email}</span>

          <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />

          {/* RBAC link */}
          <Link
            href="/rbac"
            className="text-xs font-medium px-2.5 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all hidden sm:block"
          >
            Access Control
          </Link>

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {t.langToggle}
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <button
            onClick={handleLogout}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            {t.signOut}
          </button>
        </div>
      </div>
    </header>
  );
}
