"use client";
import { useEffect } from "react";
import { getSavedLang, isRtlLang } from "@/lib/i18n";

export default function DirProvider() {
  useEffect(() => {
    function apply() {
      const lang = getSavedLang();
      document.documentElement.dir = isRtlLang(lang) ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  return null;
}
