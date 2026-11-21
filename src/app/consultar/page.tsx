import { ConsultForm } from "@/components/register/consult-form";
import { LightShell } from "@/components/site/chrome";
import { getLocale } from "@/i18n/locale";

export default async function ConsultPage() {
  const locale = await getLocale();
  return (
    <LightShell locale={locale}>
      <ConsultForm locale={locale} />
    </LightShell>
  );
}
