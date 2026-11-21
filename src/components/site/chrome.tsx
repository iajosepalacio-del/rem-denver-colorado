import Link from "next/link";
import { messages, type Locale } from "@/i18n/messages";
import { LocaleToggle } from "./locale-toggle";

export function Flag({ className = "h-4 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 32" className={className} aria-hidden="true">
      <rect width="60" height="32" fill="#b22234" />
      <path d="M0 4h60M0 12h60M0 20h60M0 28h60" stroke="#fff" strokeWidth="3" />
      <rect width="26" height="16" fill="#3c3b6e" />
    </svg>
  );
}

export function Snow() {
  const flakes = Array.from({ length: 22 }, (_, index) => ({
    left: `${(index * 17) % 100}%`,
    delay: `${(index % 8) * 0.7}s`,
    duration: `${9 + (index % 6)}s`,
    size: index % 4 === 0 ? 7 : 4,
    opacity: 0.45 + (index % 5) * 0.08,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
      {flakes.map((flake) => (
        <span
          key={flake.left + flake.delay}
          className="flake"
          style={{
            left: flake.left,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
          }}
        />
      ))}
    </div>
  );
}

export function Mountains() {
  return (
    <svg className="absolute inset-x-0 bottom-0 h-40 w-full sm:h-56" viewBox="0 0 1440 280" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 220 L180 120 L320 190 L520 70 L760 180 L980 90 L1200 170 L1440 80 L1440 280 L0 280 Z" fill="#f7fcff" opacity="0.18" />
      <path d="M0 250 L220 160 L420 220 L640 110 L900 200 L1120 140 L1440 190 L1440 280 L0 280 Z" fill="#f7fcff" opacity="0.72" />
    </svg>
  );
}

export function SiteHeader({ locale, tone = "dark" }: { locale: Locale; tone?: "dark" | "light" }) {
  const copy = messages[locale];
  const dark = tone === "dark";
  return (
    <header className={`relative z-20 ${dark ? "text-[#F7FCFF]" : "border-b border-[#C5E4F2] bg-[#F7FCFF] text-[#073B69]"}`}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:text-[#073B69]">
        {copy.skip}
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="min-w-0">
          <span className={`block font-[family-name:var(--font-iceberg)] text-3xl leading-none tracking-[0.14em] ${dark ? "text-white" : "text-[#073B69]"}`}>REM</span>
          <span className={`block text-xs ${dark ? "text-[#D7F6FF]" : "text-[#1A4468]"}`}>Reto de Empoderamiento Matrimonial</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link className="hidden rounded-full px-3 py-2 underline-offset-4 hover:underline sm:inline" href="/consultar">{copy.navConsult}</Link>
          <LocaleToggle locale={locale} label={copy.lang} dark={dark} />
        </nav>
      </div>
    </header>
  );
}

export function LightShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7FCFF]">
      <SiteHeader locale={locale} tone="light" />
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = messages[locale];
  return (
    <footer className="border-t border-white/15 bg-[#041E36] px-4 py-10 text-[#F7FCFF]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-iceberg)] text-2xl tracking-[0.12em]">REM</p>
          <p className="mt-1 max-w-md text-[#D7F6FF]">Reto de Empoderamiento Matrimonial. Denver, Colorado.</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/privacidad">{copy.navPrivacy}</Link>
          <Link href="/retencion">{copy.navRetention}</Link>
          <a href="https://matrimoniosrem.com">{copy.navOfficial}</a>
          <Link href="/admin">{copy.navAdmin}</Link>
        </nav>
      </div>
    </footer>
  );
}
