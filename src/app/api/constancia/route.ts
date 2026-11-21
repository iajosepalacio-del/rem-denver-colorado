import { getLocale } from "@/i18n/locale";
import { coupleIdFromRequest } from "@/server/auth";
import { assemble } from "@/server/couples";
import { getEvent } from "@/server/event";
import { attachment, fail, guard } from "@/server/http";
import { constanciaPdf } from "@/server/pdf";
import { ready } from "@/server/ready";
import { syncBinary } from "@/server/drive";

export const GET = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const locale = await getLocale();
  const [view, event] = await Promise.all([assemble(coupleId, locale), getEvent()]);
  const pdf = await constanciaPdf(view, event, locale);
  await syncBinary({
    coupleId,
    code: view.code,
    localKind: "constancia",
    localId: coupleId,
    folder: "confirmacion",
    name: `constancia-${view.code}.pdf`,
    mime: "application/pdf",
    bytes: pdf,
  });
  return attachment(pdf, "application/pdf", `constancia-${view.code}.pdf`);
});
