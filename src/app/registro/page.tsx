import { StartForm } from "@/components/register/start-form";
import { LightShell } from "@/components/site/chrome";
import { getLocale } from "@/i18n/locale";
import { getEvent } from "@/server/event";
import { ready } from "@/server/ready";

export default async function RegisterPage() {
  await ready();
  const [locale, event] = await Promise.all([getLocale(), getEvent()]);
  return (
    <LightShell locale={locale}>
      <StartForm locale={locale} shirtSizes={event.shirtSizes} jacketSizes={event.jacketSizes} />
    </LightShell>
  );
}
