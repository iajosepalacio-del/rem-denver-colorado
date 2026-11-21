import { z } from "zod";
import {
  addTeamMember,
  adminCouple,
  auditLog,
  dashboard,
  exportAnswers,
  exportCsv,
  outboxBody,
  outboxList,
  patchCouple,
  recordProvidedSignature,
  registrationList,
  removeCouple,
  resetAccessKey,
  retryDrive,
  reviewInvitation,
  saveEvent,
  saveInvitationFile,
  saveLogo,
  saveQuestionnaire,
  saveWaiverTemplate,
  setTeamActive,
  team,
  verifyExternalSemaforo,
  verifyPayment,
  resetAnswerKey,
} from "@/server/admin-data";
import { sql } from "@/lib/db";
import { receiptFor } from "@/server/couples";
import { getEvent } from "@/server/event";
import { isAdminError, readUpload, requireAdmin } from "@/server/guards";
import { adminCookieName, authenticateAdmin, administratorCount, bootstrapTokenOk, closeSession, createAdministrator, openSession, tokenFrom } from "@/server/auth";
import { attachment, clearCookie, cookieHeader, fail, failureCode, guard, json, limit, readJson } from "@/server/http";
import { adminBootstrapSchema, adminCouplePatchSchema, adminLoginSchema, eventConfigSchema, invitationReviewSchema, newAdminSchema, questionnaireFileSchema, signatureRecordSchema, verifyPaymentSchema } from "@/lib/validators";
import { asBuffer } from "@/lib/files";

function parts(context: { params: Promise<Record<string, string | string[]>> }) {
  return context.params.then((params) => {
    const path = params.path;
    const list = Array.isArray(path) ? path : path ? [path] : [];
    return list.filter(Boolean);
  });
}

export const GET = guard(async (request, context) => {
  const path = await parts(context);
  const [head, second] = path;
  if (head === "resumen") {
    const auth = await requireAdmin(request, "read");
    if (isAdminError(auth)) return auth.error;
    const url = new URL(request.url);
    const [stats, list] = await Promise.all([
      dashboard(),
      registrationList(url.searchParams.get("q") ?? "", url.searchParams.get("estado") ?? ""),
    ]);
    return json({ stats, list, event: await getEvent(), admin: auth.admin });
  }
  if (head === "evento") {
    const auth = await requireAdmin(request, "read");
    if (isAdminError(auth)) return auth.error;
    return json(await getEvent());
  }
  if (head === "parejas" && second) {
    const auth = await requireAdmin(request, "read");
    if (isAdminError(auth)) return auth.error;
    const couple = await adminCouple(decodeURIComponent(second));
    if (!couple) return fail(404, "no_encontrado");
    return json(couple);
  }
  if (head === "export") {
    const auth = await requireAdmin(request, "read");
    if (isAdminError(auth)) return auth.error;
    const csv = await exportCsv();
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"rem-denver-2027.csv\"",
        "cache-control": "private, no-store",
      },
    });
  }
  if (head === "respuestas") {
    const auth = await requireAdmin(request, "sensitive");
    if (isAdminError(auth)) return auth.error;
    return json(await exportAnswers(auth.admin));
  }
  if (head === "auditoria") {
    const auth = await requireAdmin(request, "audit");
    if (isAdminError(auth)) return auth.error;
    return json(await auditLog());
  }
  if (head === "buzon" && !second) {
    const auth = await requireAdmin(request, "outbox");
    if (isAdminError(auth)) return auth.error;
    return json(await outboxList());
  }
  if (head === "buzon" && second) {
    const auth = await requireAdmin(request, "outbox");
    if (isAdminError(auth)) return auth.error;
    const body = await outboxBody(auth.admin, second);
    if (!body) return fail(404, "no_encontrado");
    return json(body);
  }
  if (head === "equipo") {
    const auth = await requireAdmin(request, "admins");
    if (isAdminError(auth)) return auth.error;
    return json(await team());
  }
  if (head === "comprobante" && second) {
    const auth = await requireAdmin(request, "finance");
    if (isAdminError(auth)) return auth.error;
    const rows = await sql<{ couple_id: string }>("select couple_id from payments where id = $1", [second]);
    if (!rows[0]) return fail(404, "no_encontrado");
    const file = await receiptFor(rows[0].couple_id, second);
    if (!file) return fail(404, "no_encontrado");
    return attachment(file.bytes, file.mime, file.name);
  }
  if (head === "invitacion" && second) {
    const auth = await requireAdmin(request, "documents");
    if (isAdminError(auth)) return auth.error;
    const rows = await sql<Record<string, unknown>>(
      `select i.file_name, i.mime, i.content from invitation_requests i
       join couples c on c.id = i.couple_id where upper(c.public_code) = upper($1)`,
      [decodeURIComponent(second)],
    );
    const row = rows[0];
    if (!row?.content) return fail(404, "no_encontrado");
    return attachment(asBuffer(row.content), String(row.mime), String(row.file_name));
  }
  if (head === "waiver") {
    const auth = await requireAdmin(request, "documents");
    if (isAdminError(auth)) return auth.error;
    const rows = await sql<Record<string, unknown>>(
      `select file_name, mime, content from document_templates where kind = 'waiver' and active = true order by created_at desc limit 1`,
    );
    if (!rows[0]) return fail(404, "no_configurado");
    return attachment(asBuffer(rows[0].content), String(rows[0].mime), String(rows[0].file_name));
  }
  return fail(404, "no_encontrado");
});

export const POST = guard(async (request, context) => {
  const path = await parts(context);
  const [head] = path;
  if (head === "ingresar") {
    if (!(await limit(request, "admin", 8, 900))) return fail(429, "limite");
    const parsed = adminLoginSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const id = await authenticateAdmin(parsed.data.email, parsed.data.password);
    if (!id) return fail(401, "no_autorizado");
    const token = await openSession("admin", id, 12);
    const response = json({ ok: true });
    response.headers.append("set-cookie", cookieHeader(adminCookieName(), token, 60 * 60 * 12));
    return response;
  }
  if (head === "salir") {
    await closeSession("admin", tokenFrom(request, adminCookieName()));
    const response = new Response(null, { status: 303, headers: { location: "/admin/ingresar" } });
    response.headers.append("set-cookie", clearCookie(adminCookieName()));
    return response;
  }
  if (head === "activar") {
    const parsed = adminBootstrapSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    if ((await administratorCount()) > 0) return fail(409, "conflicto");
    if (!bootstrapTokenOk(request, parsed.data.token)) return fail(401, "no_configurado");
    const id = await createAdministrator(parsed.data);
    const token = await openSession("admin", id, 12);
    const response = json({ ok: true });
    response.headers.append("set-cookie", cookieHeader(adminCookieName(), token, 60 * 60 * 12));
    return response;
  }
  if (head === "pagos") {
    const auth = await requireAdmin(request, "finance");
    if (isAdminError(auth)) return auth.error;
    const parsed = verifyPaymentSchema.extend({ code: z.string().min(6) }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const view = await verifyPayment(auth.admin, parsed.data.code, parsed.data.paymentId, parsed.data.decision, parsed.data.note);
    if (!view) return fail(404, "no_encontrado");
    return json(view);
  }
  if (head === "semaforo") {
    const auth = await requireAdmin(request, "questionnaire");
    if (isAdminError(auth)) return auth.error;
    const parsed = z.object({ code: z.string(), participantId: z.string(), action: z.enum(["verificar", "reiniciar"]) }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    if (parsed.data.action === "reiniciar") {
      const ok = await resetAnswerKey(auth.admin, parsed.data.code, parsed.data.participantId);
      if (!ok) return fail(404, "no_encontrado");
      return json({ ok: true });
    }
    const view = await verifyExternalSemaforo(auth.admin, parsed.data.code, parsed.data.participantId);
    if (!view) return fail(400, "no_configurado");
    return json(view);
  }
  if (head === "cuestionario") {
    const auth = await requireAdmin(request, "questionnaire");
    if (isAdminError(auth)) return auth.error;
    const parsed = questionnaireFileSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    return json(await saveQuestionnaire(auth.admin, parsed.data));
  }
  if (head === "equipo") {
    const auth = await requireAdmin(request, "admins");
    if (isAdminError(auth)) return auth.error;
    const parsed = newAdminSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    return json({ id: await addTeamMember(auth.admin, parsed.data) });
  }
  if (head === "clave") {
    const auth = await requireAdmin(request, "admins");
    if (isAdminError(auth)) return auth.error;
    const parsed = z.object({ code: z.string().min(6) }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const result = await resetAccessKey(auth.admin, parsed.data.code);
    if (!result) return fail(404, "no_encontrado");
    return json(result);
  }
  if (head === "eliminar") {
    const auth = await requireAdmin(request, "admins");
    if (isAdminError(auth)) return auth.error;
    const parsed = z.object({ code: z.string().min(6) }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const ok = await removeCouple(auth.admin, parsed.data.code);
    if (!ok) return fail(404, "no_encontrado");
    return json({ ok: true });
  }
  if (head === "drive") {
    const auth = await requireAdmin(request, "documents");
    if (isAdminError(auth)) return auth.error;
    const parsed = z.object({ code: z.string().min(6) }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const drive = await retryDrive(auth.admin, parsed.data.code);
    if (!drive) return fail(404, "no_encontrado");
    return json({ drive });
  }
  if (head === "invitacion") {
    const auth = await requireAdmin(request, "documents");
    if (isAdminError(auth)) return auth.error;
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const uploaded = await readUpload(request, true);
      if (!uploaded.ok) return fail(400, uploaded.error);
      const code = String(uploaded.form.get("code") ?? "");
      const view = await saveInvitationFile(auth.admin, code, uploaded.file);
      if (!view) return fail(404, "no_encontrado");
      return json(view);
    }
    const parsed = invitationReviewSchema.extend({ code: z.string().min(6) }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const view = await reviewInvitation(auth.admin, parsed.data.code, parsed.data.status, parsed.data.note);
    if (!view) return fail(404, "no_encontrado");
    return json(view);
  }
  if (head === "waiver") {
    const auth = await requireAdmin(request, "documents");
    if (isAdminError(auth)) return auth.error;
    const uploaded = await readUpload(request, true);
    if (!uploaded.ok) return fail(400, uploaded.error);
    const version = String(uploaded.form.get("version") ?? "").trim();
    if (version.length < 1 || version.length > 40) return fail(400, "validacion");
    return json(await saveWaiverTemplate(auth.admin, version, uploaded.file));
  }
  if (head === "firma") {
    const auth = await requireAdmin(request, "documents");
    if (isAdminError(auth)) return auth.error;
    const uploaded = await readUpload(request, true);
    if (!uploaded.ok) return fail(400, "archivo");
    const parsed = signatureRecordSchema.safeParse({
      participantId: String(uploaded.form.get("participantId") ?? ""),
      providerRef: String(uploaded.form.get("providerRef") ?? ""),
      decision: String(uploaded.form.get("decision") ?? ""),
      note: String(uploaded.form.get("note") ?? ""),
    });
    if (!parsed.success) return fail(400, "validacion");
    const code = String(uploaded.form.get("code") ?? "");
    const result = await recordProvidedSignature(auth.admin, code, parsed.data.participantId, parsed.data, uploaded.file);
    if ("error" in result) return fail(409, failureCode(result) ?? "error");
    return json(result.view);
  }
  if (head === "logo") {
    const auth = await requireAdmin(request, "config");
    if (isAdminError(auth)) return auth.error;
    const uploaded = await readUpload(request);
    if (!uploaded.ok || uploaded.file.mime === "application/pdf") return fail(400, "archivo");
    await saveLogo(auth.admin, uploaded.file);
    return json({ ok: true });
  }
  return fail(404, "no_encontrado");
});

export const PATCH = guard(async (request, context) => {
  const path = await parts(context);
  const [head, second] = path;
  if (head === "evento") {
    const auth = await requireAdmin(request, "config");
    if (isAdminError(auth)) return auth.error;
    const parsed = eventConfigSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    if (parsed.data.semaforoExternalUrl && !parsed.data.semaforoExternalUrl.startsWith("https://")) return fail(400, "validacion");
    return json(await saveEvent(auth.admin, parsed.data));
  }
  if (head === "parejas" && second) {
    const auth = await requireAdmin(request, "admins");
    if (isAdminError(auth)) return auth.error;
    const parsed = adminCouplePatchSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const view = await patchCouple(auth.admin, decodeURIComponent(second), parsed.data);
    if (!view) return fail(404, "no_encontrado");
    return json(view);
  }
  if (head === "equipo" && second) {
    const auth = await requireAdmin(request, "admins");
    if (isAdminError(auth)) return auth.error;
    const parsed = z.object({ active: z.boolean() }).safeParse(await readJson(request));
    if (!parsed.success) return fail(400, "validacion");
    const ok = await setTeamActive(auth.admin, second, parsed.data.active);
    if (!ok) return fail(409, "conflicto");
    return json({ ok: true });
  }
  return fail(404, "no_encontrado");
});
