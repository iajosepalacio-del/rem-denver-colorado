import { coupleIdFromRequest } from "@/server/auth";
import { participantInCouple, signedWaiverFile } from "@/server/couples";
import { attachment, fail, guard } from "@/server/http";
import { ready } from "@/server/ready";

export const GET = guard(async (request, context) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const raw = (await context.params).participantId;
  const participantId = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  if (!(await participantInCouple(coupleId, participantId))) return fail(404, "no_encontrado");
  const file = await signedWaiverFile(coupleId, participantId);
  if (!file) return fail(404, "no_encontrado");
  return attachment(file.bytes, file.mime, file.name);
});
