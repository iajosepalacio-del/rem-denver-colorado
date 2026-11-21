import { externalOpenSchema, saveAnswersSchema, answerKeySchema } from "@/lib/validators";
import { coupleIdFromRequest } from "@/server/auth";
import { markExternalOpened, ownAnswers, questionsForCouple, saveAnswers, setAnswerKey } from "@/server/couples";
import { fail, failureCode, guard, json, limit, readJson } from "@/server/http";
import { ready } from "@/server/ready";

export const GET = guard(async (request) => {
  await ready();
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const participantId = new URL(request.url).searchParams.get("participantId") ?? "";
  const data = await questionsForCouple(coupleId, participantId);
  if (!data) return fail(404, "no_encontrado");
  return json(data);
});

export const POST = guard(async (request) => {
  await ready();
  if (!(await limit(request, "semaforo", 40, 900))) return fail(429, "limite");
  const coupleId = await coupleIdFromRequest(request);
  if (!coupleId) return fail(401, "no_autorizado");
  const body = await readJson(request);
  const kind = body && typeof body === "object" && "kind" in body ? String((body as { kind?: string }).kind) : "respuestas";
  if (kind === "clave") {
    const parsed = answerKeySchema.safeParse(body);
    if (!parsed.success) return fail(400, "validacion");
    const result = await setAnswerKey(coupleId, parsed.data.participantId, parsed.data.answerKey);
    if ("error" in result) return fail(409, failureCode(result) ?? "error");
    return json(result);
  }
  if (kind === "externo") {
    const parsed = externalOpenSchema.safeParse(body);
    if (!parsed.success) return fail(400, "validacion");
    const result = await markExternalOpened(coupleId, parsed.data.participantId);
    if ("error" in result) return fail(400, failureCode(result) ?? "error");
    return json(result.view);
  }
  if (kind === "ver") {
    const parsed = answerKeySchema.safeParse(body);
    if (!parsed.success) return fail(400, "validacion");
    const answers = await ownAnswers(coupleId, parsed.data.participantId, parsed.data.answerKey);
    if (!answers) return fail(401, "clave");
    return json({ answers });
  }
  const parsed = saveAnswersSchema.safeParse(body);
  if (!parsed.success) return fail(400, "validacion");
  const result = await saveAnswers(coupleId, parsed.data);
  if ("error" in result) {
    const answerError = failureCode(result) ?? "error";
    return fail(answerError === "clave" ? 401 : 400, answerError);
  }
  return json(result.view);
});
