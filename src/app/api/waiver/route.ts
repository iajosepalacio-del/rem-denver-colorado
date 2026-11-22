import { z } from "zod";
import { waiverSignSchema } from "@/lib/validators";
import { coupleIdFromRequest } from "@/server/auth";
import { signWaiverExample, startSignature, waiverTemplateFile } from "@/server/couples";
import { attachment, fail, failureCode, guard, json, readJson } from "@/server/http";
import { ready } from "@/server/ready";

export const GET = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const file = await waiverTemplateFile();
  if (!file) return fail(404, "no_configurado");
  return attachment(file.bytes, file.mime, file.name);
});

const providerSchema = z.object({ participantId: z.string().min(8) });

export const POST = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const body = await readJson(request);
  const form = waiverSignSchema.safeParse(body);
  if (form.success) {
    const result = await signWaiverExample(coupleId, form.data);
    if ("error" in result) return fail(409, failureCode(result) ?? "error");
    return json(result);
  }
  const parsed = providerSchema.safeParse(body);
  if (!parsed.success) return fail(400, "validacion");
  const result = await startSignature(coupleId, parsed.data.participantId);
  if ("error" in result) return fail(409, failureCode(result) ?? "error");
  return json(result);
});
