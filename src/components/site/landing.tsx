import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatEventRange } from "@/lib/format";
import { messages, type Locale } from "@/i18n/messages";
import type { EventConfig } from "@/server/event";
import { Flag, Mountains, SiteFooter, SiteHeader, Snow } from "./chrome";

export function Landing({ event, locale }: { event: EventConfig; locale: Locale }) {
  const copy = messages[locale];
  const range = formatEventRange(event.startsOn, event.endsOn, locale);
  const place = `${event.city} · ${event.region} · ${event.country}`;
  return (
    <div className="bg-[#041E36] text-[#F7FCFF]">
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="hero-glow absolute inset-0" />
        <Snow />
        <SiteHeader locale={locale} />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col justify-center px-4 pt-6 pb-36">
          <p className="text-xs font-semibold tracking-[0.28em] text-[#FF75A5] sm:text-sm">REM · RETO DE EMPODERAMIENTO MATRIMONIAL</p>
          <h1 className="ice-display mt-4 max-w-5xl text-[2.7rem] leading-[0.95] sm:text-7xl lg:text-8xl">{event.slogan}</h1>
          <p className="mt-4 text-lg font-semibold tracking-[0.16em] text-[#F7FCFF] sm:text-2xl">{event.subtitle}</p>
          <p className="mt-6 text-base font-semibold tracking-wide sm:text-lg">{range}</p>
          <p className="mt-2 flex items-center gap-2 text-base sm:text-lg">
            <Flag />
            <span>{place.toUpperCase()}</span>
          </p>
          <blockquote className="mt-8 max-w-xl text-lg leading-relaxed text-[#F7FCFF]">“{event.emotionalLine}”</blockquote>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              nativeButton={false}
              render={<Link href="/registro" />}
              className="h-12 bg-[#F7FCFF] px-6 text-base font-semibold text-[#073B69] hover:bg-white"
            >
              {copy.heroCta}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/consultar" />}
              variant="outline"
              className="h-12 border-white/70 bg-white/10 px-6 text-base text-white hover:bg-white/20"
            >
              {copy.heroSecondary}
            </Button>
          </div>
        </div>
        <Mountains />
      </section>
      <main id="contenido">
        <section className="bg-[#073B69] px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-[family-name:var(--font-iceberg)] text-4xl tracking-[0.08em]">{copy.experienceTitle}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {copy.experience.map((item) => (
                <article key={item.title} className="glass rounded-3xl p-5">
                  <h3 className="text-xl font-semibold text-[#F7FCFF]">{item.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-[#F7FCFF]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-[#062844] px-4 py-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--font-iceberg)] text-4xl tracking-[0.08em]">{copy.factsTitle}</h2>
              <dl className="mt-6 grid gap-4 text-lg">
                <div className="glass rounded-2xl p-4"><dt className="text-sm text-[#D7F6FF]">{copy.registeredOn}</dt><dd>{range}</dd></div>
                <div className="glass rounded-2xl p-4"><dt className="text-sm text-[#D7F6FF]">{place}</dt><dd className="flex items-center gap-2"><Flag /> {event.city}, {event.region}</dd></div>
              </dl>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-iceberg)] text-4xl tracking-[0.08em]">{copy.stepsTitle}</h2>
              <ol className="mt-6 grid gap-3">
                {copy.steps.map((step, index) => (
                  <li key={step} className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
                    <span className="grid size-9 place-items-center rounded-full bg-[#38B9E8] font-semibold text-[#041E36]">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
        <section className="bg-[#F7FCFF] px-4 py-16 text-[#073B69]">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-[family-name:var(--font-iceberg)] text-4xl tracking-[0.06em] text-[#073B69]">{copy.winterTitle}</h2>
            <p className="mt-4 max-w-2xl text-lg">{copy.winterBody}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {copy.tips.map((tip) => (
                <li key={tip} className="rounded-2xl border border-[#C5E4F2] bg-white p-4 text-base">{tip}</li>
              ))}
            </ul>
            <p className="mt-6 max-w-3xl text-base text-[#1A4468]">{copy.winterNote}</p>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
