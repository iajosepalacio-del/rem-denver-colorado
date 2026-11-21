import { LightShell } from "@/components/site/chrome";
import { getLocale } from "@/i18n/locale";
import { getEvent } from "@/server/event";
import { ready } from "@/server/ready";

export default async function PrivacyPage() {
  await ready();
  const [locale, event] = await Promise.all([getLocale(), getEvent()]);
  const spanish = locale === "es";
  return (
    <LightShell locale={locale}>
      <article className="grid max-w-3xl gap-4 rounded-3xl bg-white p-5 text-base leading-relaxed">
        <h1 className="text-3xl">{spanish ? "Privacidad" : "Privacy"}</h1>
        <p>{spanish
          ? `REM Denver Colorado 2027 trata los datos de la inscripción para organizar la participación, la logística de tallas, los pagos que la pareja declara y la comunicación del evento ${event.startsOn}.`
          : `REM Denver Colorado 2027 uses registration data to organize attendance, size logistics, payments a couple declares and event communication for ${event.startsOn}.`}</p>
        <p>{spanish
          ? "Las respuestas del SEMÁFORO no se muestran al otro cónyuge en esta plataforma y no viajan en el correo de confirmación. Un administrador con el permiso correspondiente puede exportarlas. La plataforma no produce diagnósticos ni interpretaciones clínicas."
          : "SEMÁFORO answers are not shown to the other spouse on this platform and are not included in confirmation email. An administrator with the matching permission can export them. The platform does not produce diagnoses or clinical interpretations."}</p>
        <p>{spanish
          ? "Si Google Drive o el correo están configurados, la copia documental se envía a la cuenta organizadora y los mensajes salen por el servicio configurado. Si no lo están, los datos quedan en la base de la plataforma y la pantalla lo dice."
          : "When Google Drive or email is configured, document copies go to the organizer account and messages leave through that service. Otherwise the data stays in the platform database and the screen says so."}</p>
        <p>{spanish
          ? `Esta página no certifica por sí sola el cumplimiento de una norma. Las solicitudes pueden enviarse a ${event.organizerEmail}.`
          : `This page does not by itself certify compliance with a statute. Requests can be sent to ${event.organizerEmail}.`}</p>
      </article>
    </LightShell>
  );
}
