import { Landing } from "@/components/site/landing";
import { getLocale } from "@/i18n/locale";
import { getEvent } from "@/server/event";
import { ready } from "@/server/ready";

export default async function HomePage() {
  await ready();
  const [locale, event] = await Promise.all([getLocale(), getEvent()]);
  return <Landing event={event} locale={locale} />;
}
