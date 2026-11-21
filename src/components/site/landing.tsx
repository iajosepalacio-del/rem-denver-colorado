import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatEventRange } from "@/lib/format";
import { messages, type Locale } from "@/i18n/messages";
import type { EventConfig } from "@/server/event";
import { Flag, SiteFooter, SiteHeader, Snow } from "./chrome";

const DEFAULT_SLOGAN = "AMOR A PRUEBA DE HIELO";
const DEFAULT_SUBTITLE = "PRIMER REM EN LA NIEVE";

export function Landing({ event, locale }: { event: EventConfig; locale: Locale }) {
  const copy = messages[locale];
  const range = formatEventRange(event.startsOn, event.endsOn, locale);
  const place = `${event.city} · ${event.region} · ${event.country}`;
  const iceSlogan = event.slogan.trim().toUpperCase() === DEFAULT_SLOGAN;
  const posterSubtitle = event.subtitle.trim().toUpperCase() === DEFAULT_SUBTITLE;
  return (
    <div className="bg-[#04182C] text-[#F7FCFF]">
      <section className="relative min-h-[100svh] overflow-hidden">
        <img
          src="/denver/rockies.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04182C]/55 via-[#04182C]/25 to-[#04182C]/88" />
        <Snow />
        <SiteHeader locale={locale} />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col justify-center px-4 pt-8 pb-16">
          <h1 className="max-w-4xl">
            {iceSlogan ? (
              <img src="/brand/ice-slogan.webp" alt={event.slogan} className="w-full drop-shadow-[0_12px_28px_rgba(4,24,44,0.45)]" />
            ) : (
              <span className="ice-display block text-5xl leading-none sm:text-7xl">{event.slogan}</span>
            )}
          </h1>
          {posterSubtitle ? (
            <div className="mt-5 flex flex-col items-start gap-3">
              <p className="font-[family-name:var(--font-montserrat)] text-3xl font-extrabold tracking-[0.2em] text-white sm:text-5xl">PRIMER</p>
              <img src="/brand/rem-isotipo.png" alt="" className="h-16 w-auto drop-shadow sm:h-20" />
              <p className="ribbon bg-[#FF75A5] text-base text-white sm:text-lg">En la nieve</p>
            </div>
          ) : (
            <p className="mt-4 font-[family-name:var(--font-montserrat)] text-2xl font-extrabold tracking-[0.12em] text-white">{event.subtitle}</p>
          )}
          <p className="ribbon mt-4 self-start bg-[#00BFD0] text-center text-sm text-[#073B69] sm:text-base">{range}<br />{place}</p>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-white">
            <Flag />
            <span>{place.toUpperCase()}</span>
          </p>
          <blockquote className="mt-6 max-w-xl rounded-2xl bg-[#04182C]/70 p-4 text-lg leading-relaxed text-[#F7FCFF]">“{event.emotionalLine}”</blockquote>
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
              className="h-12 border-white/80 bg-[#04182C]/45 px-6 text-base text-white hover:bg-[#04182C]/70"
            >
              {copy.heroSecondary}
            </Button>
          </div>
        </div>
      </section>
      <main id="contenido">
        <section className="bg-[#F7FCFF] px-4 py-16 text-[#073B69]">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-[family-name:var(--font-montserrat)] text-4xl font-extrabold tracking-tight">{copy.denverTitle}</h2>
            <p className="mt-3 max-w-2xl text-lg">{copy.denverIntro}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {copy.denverPlaces.map((placeCard) => (
                <figure key={placeCard.src} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                  <img src={placeCard.src} alt={placeCard.alt} className="aspect-[4/3] w-full object-cover" />
                  <figcaption className="p-4">
                    <p className="font-[family-name:var(--font-montserrat)] text-lg font-extrabold">{placeCard.title}</p>
                    <p className="mt-1 text-base text-[#1A4468]">{placeCard.body}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-6 max-w-3xl text-base text-[#1A4468]">{copy.denverNote}</p>
          </div>
        </section>
        <section className="bg-[#073B69] px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-[family-name:var(--font-montserrat)] text-4xl font-extrabold tracking-tight">{copy.experienceTitle}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {copy.experience.map((item) => (
                <article key={item.title} className="glass rounded-3xl p-5">
                  <h3 className="font-[family-name:var(--font-montserrat)] text-xl font-extrabold text-[#F7FCFF]">{item.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-[#F7FCFF]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="relative overflow-hidden bg-[#062844] px-4 py-16">
          <img src="/denver/skyline.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--font-montserrat)] text-4xl font-extrabold tracking-tight">{copy.factsTitle}</h2>
              <dl className="mt-6 grid gap-4 text-lg">
                <div className="glass rounded-2xl p-4"><dt className="text-sm text-[#D7F6FF]">{copy.registeredOn}</dt><dd>{range}</dd></div>
                <div className="glass rounded-2xl p-4"><dt className="text-sm text-[#D7F6FF]">{place}</dt><dd className="flex items-center gap-2"><Flag /> {event.city}, {event.region}</dd></div>
              </dl>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-montserrat)] text-4xl font-extrabold tracking-tight">{copy.stepsTitle}</h2>
              <ol className="mt-6 grid gap-3">
                {copy.steps.map((step, index) => (
                  <li key={step} className="flex items-center gap-3 rounded-2xl bg-[#04182C]/75 px-4 py-3">
                    <span className="grid size-9 place-items-center rounded-full bg-[#FF5400] font-semibold text-white">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
        <section className="bg-[#F7FCFF] px-4 py-16 text-[#073B69]">
          <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="font-[family-name:var(--font-montserrat)] text-4xl font-extrabold tracking-tight">{copy.winterTitle}</h2>
              <p className="mt-4 max-w-2xl text-lg">{copy.winterBody}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {copy.tips.map((tip) => (
                  <li key={tip} className="rounded-2xl border border-[#C5E4F2] bg-white p-4 text-base">{tip}</li>
                ))}
              </ul>
              <p className="mt-6 max-w-3xl text-base text-[#1A4468]">{copy.winterNote}</p>
            </div>
            <img src="/denver/barrio.jpg" alt={copy.denverPlaces[2]?.alt ?? ""} className="aspect-[4/3] w-full rounded-3xl object-cover" />
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
