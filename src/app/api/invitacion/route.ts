import { invitationChoiceSchema } from "@/lib/validators";
import { coupleIdFromRequest } from "@/server/auth";
import { chooseInvitation, invitationFile } from "@/server/couples";
import { attachment, fail, guard, json, readJson } from "@/server/http";
import { ready } from "@/server/ready";

export const POST = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const parsed = invitationChoiceSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "validacion");
  return json(await chooseInvitation(coupleId, parsed.data.needed));
});

export const GET = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const file = await invitationFile(coupleId);
  if (!file) return fail(404, "no_encontrado");
  return attachment(file.bytes, file.mime, file.name);
});
