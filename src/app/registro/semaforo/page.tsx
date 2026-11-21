import { Suspense } from "react";
import { SemaforoFlow } from "@/components/register/semaforo-flow";
import { LightShell } from "@/components/site/chrome";
import { getLocale } from "@/i18n/locale";

export default async function SemaforoPage() {
  const locale = await getLocale();
  return (
    <LightShell locale={locale}>
      <Suspense fallback={<p>Cargando</p>}>
        <SemaforoFlow locale={locale} />
      </Suspense>
    </LightShell>
  );
}
