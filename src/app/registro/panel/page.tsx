import { redirect } from "next/navigation";
import { Wizard } from "@/components/register/wizard";
import { LightShell } from "@/components/site/chrome";
import { getLocale } from "@/i18n/locale";
import { coupleIdFromCookies } from "@/server/auth";
import { buildView } from "@/server/couples";
import { getEvent } from "@/server/event";
import { ready } from "@/server/ready";

export default async function PanelPage() {
  await ready();
  const coupleId = await coupleIdFromCookies();
  if (!coupleId) redirect("/consultar");
  const locale = await getLocale();
  const [view, event] = await Promise.all([buildView(coupleId, locale), getEvent()]);
  return (
    <LightShell locale={locale}>
      <Wizard initial={view} locale={locale} shirtSizes={event.shirtSizes} jacketSizes={event.jacketSizes} />
    </LightShell>
  );
}
