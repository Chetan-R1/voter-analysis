"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { translations, type Lang, type Translations } from "@/app/lib/i18n";

interface LangCtx {
  lang: Lang;
  toggle: () => void;
  t: Translations;
}

const Ctx = createContext<LangCtx>({
  lang: "en",
  toggle: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "hi") setLang(saved);
  }, []);

  function toggle() {
    setLang((prev) => {
      const next = prev === "en" ? "hi" : "en";
      localStorage.setItem("lang", next);
      return next;
    });
  }

  return (
    <Ctx.Provider value={{ lang, toggle, t: translations[lang] }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLang() {
  return useContext(Ctx);
}
