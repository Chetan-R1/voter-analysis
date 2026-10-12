"use client";

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
      <div className="max-w-6xl mx-auto h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-semibold text-slate-800 text-sm">{t.appName}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:block">{email}</span>

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {t.langToggle}
          </button>

          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium px-2 py-1.5"
          >
            {t.signOut}
          </button>
        </div>
      </div>
    </header>
  );
}
