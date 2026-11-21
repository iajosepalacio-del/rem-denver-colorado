import { getLocale } from "@/i18n/locale";
import { createRegistrationSchema, updatePersonalSchema } from "@/lib/validators";
import { coupleCookieName, coupleIdFromRequest, openSession } from "@/server/auth";
import { buildView, createCouple, updatePersonal } from "@/server/couples";
import { cookieHeader, fail, failureCode, guard, json, limit, readJson } from "@/server/http";
import { ready } from "@/server/ready";

export const POST = guard(async (request) => {
  await ready();
  if (!(await limit(request, "registro", 8, 3600))) return fail(429, "limite");
  const body = await readJson(request);
  const parsed = createRegistrationSchema.safeParse(body);
  if (!parsed.success) return fail(400, "validacion");
  const created = await createCouple(parsed.data);
  if ("error" in created) return fail(400, failureCode(created) ?? "error");
  const token = await openSession("couple", created.coupleId, 24 * 14);
  const response = json({
    code: created.code,
    accessKey: created.accessKey,
    email: created.email,
    drive: created.drive,
    view: created.view,
  });
  response.headers.append("set-cookie", cookieHeader(coupleCookieName(), token, 60 * 60 * 24 * 14));
  return response;
});

export const GET = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const locale = await getLocale();
  return json(await buildView(coupleId, locale));
});

export const PATCH = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const body = await readJson(request);
  const parsed = updatePersonalSchema.safeParse(body);
  if (!parsed.success) return fail(400, "validacion");
  const result = await updatePersonal(coupleId, parsed.data);
  if ("error" in result) {
    const personalError = failureCode(result) ?? "error";
    return fail(personalError === "conflicto" ? 409 : 400, personalError);
  }
  return json(result.view);
});
