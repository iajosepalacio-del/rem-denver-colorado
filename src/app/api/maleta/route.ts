import { packingAckSchema, packingToggleSchema } from "@/lib/validators";
import { coupleIdFromRequest } from "@/server/auth";
import { acknowledgePack, assemble, togglePack } from "@/server/couples";
import { packingPdf } from "@/server/pdf";
import { attachment, fail, guard, json, readJson } from "@/server/http";
import { getLocale } from "@/i18n/locale";
import { ready } from "@/server/ready";

export const POST = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const body = await readJson(request);
  const kind = body && typeof body === "object" && "kind" in body ? String((body as { kind?: string }).kind) : "item";
  if (kind === "ack") {
    const parsed = packingAckSchema.safeParse(body);
    if (!parsed.success) return fail(400, "validacion");
    const view = await acknowledgePack(coupleId, parsed.data.participantId);
    if (!view) return fail(404, "no_encontrado");
    return json(view);
  }
  const parsed = packingToggleSchema.safeParse(body);
  if (!parsed.success) return fail(400, "validacion");
  const view = await togglePack(coupleId, parsed.data.participantId, parsed.data.itemKey, parsed.data.checked);
  if (!view) return fail(404, "no_encontrado");
  return json(view);
});

export const GET = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const locale = await getLocale();
  const view = await assemble(coupleId, locale);
  const pdf = await packingPdf(view, locale);
  return attachment(pdf, "application/pdf", `maleta-${view.code}.pdf`);
});
