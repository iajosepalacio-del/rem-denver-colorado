"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/messages";

export function LocaleToggle({ locale, label, dark }: { locale: Locale; label: string; dark: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`min-h-11 rounded-full border px-3 py-2 ${dark ? "border-white/40 bg-white/10" : "border-[#073B69]/20 bg-white"}`}
      onClick={() => {
        const next = locale === "es" ? "en" : "es";
        document.cookie = `rem_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
