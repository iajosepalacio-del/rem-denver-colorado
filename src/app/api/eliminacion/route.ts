import { coupleIdFromRequest } from "@/server/auth";
import { requestDeletion } from "@/server/couples";
import { fail, guard, json } from "@/server/http";
import { ready } from "@/server/ready";

export const POST = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  return json(await requestDeletion(coupleId));
});
