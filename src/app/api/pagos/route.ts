import { modalitySchema, paymentSchema } from "@/lib/validators";
import { coupleIdFromRequest } from "@/server/auth";
import { addPayment, setModality } from "@/server/couples";
import { fail, guard, json, readJson } from "@/server/http";
import { ready } from "@/server/ready";

export const POST = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const body = await readJson(request);
  const kind = body && typeof body === "object" && "kind" in body ? String((body as { kind?: string }).kind) : "";
  if (kind === "modalidad") {
    const parsed = modalitySchema.safeParse(body);
    if (!parsed.success) return fail(400, "validacion");
    return json(await setModality(coupleId, parsed.data.modality, parsed.data.claimPaidInFull));
  }
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return fail(400, "validacion");
  const created = await addPayment(coupleId, parsed.data);
  return json({ id: created.id, view: created.view });
});
