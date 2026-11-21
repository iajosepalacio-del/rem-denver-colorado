import { LightShell } from "@/components/site/chrome";
import { getLocale } from "@/i18n/locale";
import { getEvent } from "@/server/event";
import { ready } from "@/server/ready";

export default async function RetentionPage() {
  await ready();
  const [locale, event] = await Promise.all([getLocale(), getEvent()]);
  const spanish = locale === "es";
  return (
    <LightShell locale={locale}>
      <article className="grid max-w-3xl gap-4 rounded-3xl bg-white p-5 text-base leading-relaxed">
        <h1 className="text-3xl">{spanish ? "Retención y eliminación" : "Retention and deletion"}</h1>
        <p>{spanish
          ? `La configuración actual conserva la inscripción ${event.retentionMonths} meses después del evento, salvo una solicitud de eliminación.`
          : `Current settings keep a registration for ${event.retentionMonths} months after the event, unless deletion is requested.`}</p>
        <p>{spanish
          ? "La pareja puede pedir la eliminación desde la confirmación. Un responsable del equipo la ejecuta. Las copias en Google Drive, si llegaron a sincronizarse, pueden requerir un borrado aparte. Las copias de seguridad dependen del proveedor de la base de datos."
          : "A couple can request deletion from the confirmation step. An owner on the team carries it out. Google Drive copies, if a sync happened, may need a separate deletion. Backups depend on the database provider."}</p>
      </article>
    </LightShell>
  );
}
