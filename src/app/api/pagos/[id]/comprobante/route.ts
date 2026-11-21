import { coupleIdFromRequest } from "@/server/auth";
import { receiptFor, saveReceipt } from "@/server/couples";
import { attachment, fail, guard, json, limit } from "@/server/http";
import { readUpload } from "@/server/guards";
import { ready } from "@/server/ready";

export const POST = guard(async (request, context) => {
  await ready();
  if (!(await limit(request, "archivo", 30, 3600))) return fail(429, "limite");
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const uploaded = await readUpload(request);
  if (!uploaded.ok) return fail(400, uploaded.error);
  const raw = (await context.params).id;
  const id = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const view = await saveReceipt(coupleId, id, uploaded.file);
  if (!view) return fail(404, "no_encontrado");
  return json(view);
});

export const GET = guard(async (request, context) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const raw = (await context.params).id;
  const id = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const file = await receiptFor(coupleId, id);
  if (!file) return fail(404, "no_encontrado");
  return attachment(file.bytes, file.mime, file.name);
});
