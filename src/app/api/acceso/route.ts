import { accessSchema } from "@/lib/validators";
import { closeSession, coupleCookieName, openSession, tokenFrom } from "@/server/auth";
import { loginCouple } from "@/server/couples";
import { clearCookie, cookieHeader, fail, guard, json, limit, readJson } from "@/server/http";
import { ready } from "@/server/ready";

export const POST = guard(async (request) => {
  await ready();
  if (!(await limit(request, "acceso", 10, 900))) return fail(429, "limite");
  const parsed = accessSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "validacion");
  const coupleId = await loginCouple(parsed.data.code, parsed.data.email, parsed.data.accessKey);
  if (!coupleId) return fail(401, "no_autorizado");
  const token = await openSession("couple", coupleId, 24 * 14);
  const response = json({ ok: true });
  response.headers.append("set-cookie", cookieHeader(coupleCookieName(), token, 60 * 60 * 24 * 14));
  return response;
});

export const DELETE = guard(async (request) => {
  await closeSession("couple", tokenFrom(request, coupleCookieName()));
  const response = json({ ok: true });
  response.headers.append("set-cookie", clearCookie(coupleCookieName()));
  return response;
});
