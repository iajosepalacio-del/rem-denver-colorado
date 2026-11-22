import { EVENT_ID } from "../lib/catalog";
import { sql } from "../lib/db";
import { asBuffer } from "../lib/files";
import { newAccessKey, newId, hashSecret } from "../lib/secrets";
import type { AdminSession } from "../lib/types";
import { assemble, buildView } from "./couples";
import { syncBinary, syncCoupleSnapshot } from "./drive";
import { getEvent } from "./event";
import { accessMessage, deliverEmail, mailConfigured } from "./mail";
import { signatureProviderName } from "./signature";

async function audit(admin: AdminSession, action: string, entity: string, entityId: string, detail: Record<string, unknown> = {}) {
  await sql(
    `insert into audit_logs (id, actor_type, actor_id, action, entity, entity_id, result, detail)
     values ($1, 'admin', $2, $3, $4, $5, 'ok', $6::jsonb)`,
    [newId(), admin.id, action, entity, entityId, JSON.stringify(detail)],
  );
}

export async function registrationList(query: string, status: string) {
  const rows = await sql<{ id: string }>("select id from couples order by created_at desc limit 300");
  const views = [];
  for (const row of rows) views.push(await assemble(row.id, "es"));
  const needle = query.trim().toLowerCase();
  return views.filter((view) => {
    const haystack = [
      view.code,
      view.city,
      view.spouses.esposo.fullName,
      view.spouses.esposa.fullName,
      view.spouses.esposo.email,
      view.spouses.esposa.email,
    ]
      .join(" ")
      .toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    if (status && view.status !== status) return false;
    return true;
  });
}

export async function dashboard() {
  const views = await registrationList("", "");
  const paid = views.reduce((sum, view) => sum + view.finance.paidCents, 0);
  const balance = views.reduce((sum, view) => sum + (view.finance.balanceCents ?? 0), 0);
  const sizes: Record<string, number> = {};
  const cities: Record<string, number> = {};
  for (const view of views) {
    for (const spouse of [view.spouses.esposo, view.spouses.esposa]) {
      sizes[spouse.shirtSize] = (sizes[spouse.shirtSize] ?? 0) + 1;
      sizes[`chaqueta ${spouse.jacketSize}`] = (sizes[`chaqueta ${spouse.jacketSize}`] ?? 0) + 1;
    }
    const city = `${view.city}, ${view.country}`;
    cities[city] = (cities[city] ?? 0) + 1;
  }
  return {
    total: views.length,
    demos: views.filter((view) => view.isDemo).length,
    completos: views.filter((view) => view.status === "completado").length,
    incompletos: views.filter((view) => view.status !== "completado").length,
    pagosVerificados: paid,
    balancePendiente: balance,
    cartas: views.filter((view) => view.invitation.needed === true && view.invitation.status !== "entregada").length,
    waivers: views.filter((view) => view.progress.blocks.find((block) => block.key === "waiver" && block.ratio < 1)).length,
    cuestionarios: views.filter((view) => view.progress.blocks.find((block) => block.key === "semaforo" && block.ratio < 1)).length,
    sizes,
    cities,
    priceConfigured: views.every((view) => view.finance.priceConfigured) && views.length > 0
      ? views[0]!.finance.priceConfigured
      : (await getEvent()).priceConfigured,
  };
}

async function idByCode(code: string) {
  const rows = await sql<{ id: string }>("select id from couples where upper(public_code) = upper($1)", [code]);
  return rows[0]?.id ?? null;
}

export async function adminCouple(code: string) {
  const id = await idByCode(code);
  if (!id) return null;
  const view = await assemble(id, "es");
  const notes = await sql<{ internal_notes: string }>(
    "select internal_notes from financial_accounts where couple_id = $1",
    [id],
  );
  return { id, view, internalNotes: notes[0]?.internal_notes ?? "" };
}

export async function patchCouple(admin: AdminSession, code: string, patch: {
  city?: string;
  region?: string;
  country?: string;
  priceOverride?: number | null;
  adminNotes?: string;
  internalNotes?: string;
  esposo?: { fullName: string; shirtSize: string; jacketSize: string; phoneCountry: string; phone: string; email: string };
  esposa?: { fullName: string; shirtSize: string; jacketSize: string; phoneCountry: string; phone: string; email: string };
}) {
  const id = await idByCode(code);
  if (!id) return null;
  const before = await assemble(id, "es");
  if (patch.city || patch.country || patch.region !== undefined) {
    await sql(
      `update couples set city = coalesce($2, city), region = coalesce($3, region), country = coalesce($4, country), updated_at = now() where id = $1`,
      [id, patch.city ?? null, patch.region ?? null, patch.country ?? null],
    );
  }
  if (patch.priceOverride !== undefined || patch.adminNotes !== undefined || patch.internalNotes !== undefined) {
    await sql(
      `update financial_accounts set
         price_override_cents = case when $2::int is null then price_override_cents else $2 end,
         admin_notes = coalesce($3, admin_notes),
         internal_notes = coalesce($4, internal_notes),
         updated_at = now()
       where couple_id = $1`,
      [
        id,
        patch.priceOverride === undefined ? null : patch.priceOverride === null ? null : Math.round(patch.priceOverride * 100),
        patch.adminNotes ?? null,
        patch.internalNotes ?? null,
      ],
    );
  }
  for (const role of ["esposo", "esposa"] as const) {
    const spouse = patch[role];
    if (!spouse) continue;
    await sql(
      `update participants set full_name = $3, shirt_size = $4, jacket_size = $5, phone_country = $6, phone = $7, email = $8
       where couple_id = $1 and role = $2`,
      [id, role, spouse.fullName, spouse.shirtSize, spouse.jacketSize, spouse.phoneCountry, spouse.phone, spouse.email.toLowerCase()],
    );
  }
  await audit(admin, "edito_pareja", "couple", id, {
    before: { city: before.city, country: before.country },
    after: { city: patch.city ?? before.city, country: patch.country ?? before.country },
  });
  return buildView(id, "es");
}

export async function verifyPayment(admin: AdminSession, code: string, paymentId: string, decision: "verificado" | "rechazado", note: string) {
  const id = await idByCode(code);
  if (!id) return null;
  const rows = await sql(
    `update payments set status = $3, note = case when $4 = '' then note else $4 end, verified_by = $5, verified_at = now()
     where id = $1 and couple_id = $2 and status = 'pendiente'
     returning id`,
    [paymentId, id, decision, note, admin.id],
  );
  if (!rows[0]) return null;
  await audit(admin, "verifico_pago", "payment", paymentId, { decision });
  return buildView(id, "es");
}

export async function reviewInvitation(admin: AdminSession, code: string, status: string, note: string) {
  const id = await idByCode(code);
  if (!id) return null;
  await sql(
    `update invitation_requests
     set status = $2, reviewer_note = $3, delivered_at = case when $2 = 'entregada' then now() else delivered_at end, updated_at = now()
     where couple_id = $1 and needed = true`,
    [id, status, note],
  );
  await audit(admin, "reviso_invitacion", "invitation", id, { status });
  return buildView(id, "es");
}

export async function saveInvitationFile(admin: AdminSession, code: string, file: { name: string; mime: string; bytes: Buffer }) {
  const id = await idByCode(code);
  if (!id) return null;
  await sql(
    `update invitation_requests
     set file_name = $2, mime = $3, size_bytes = $4, content = $5, updated_at = now()
     where couple_id = $1`,
    [id, file.name, file.mime, file.bytes.length, file.bytes],
  );
  const view = await assemble(id, "es");
  await syncBinary({
    coupleId: id,
    code: view.code,
    localKind: "invitacion",
    localId: id,
    folder: "invitacion",
    name: file.name,
    mime: file.mime,
    bytes: file.bytes,
  });
  await audit(admin, "cargo_invitacion", "invitation", id, { name: file.name });
  return view;
}

export async function saveWaiverTemplate(admin: AdminSession, version: string, file: { name: string; mime: string; bytes: Buffer }) {
  await sql(`update document_templates set active = false where event_id = $1 and kind = 'waiver' and active = true`, [EVENT_ID]);
  const id = newId();
  await sql(
    `insert into document_templates (id, event_id, kind, version, file_name, mime, size_bytes, content, active, uploaded_by)
     values ($1, $2, 'waiver', $3, $4, $5, $6, $7, true, $8)`,
    [id, EVENT_ID, version, file.name, file.mime, file.bytes.length, file.bytes, admin.id],
  );
  await sql(
    `update document_signatures
     set template_id = $1,
         version = $2,
         status = case when status = 'firmado' then 'requiere_revision' else 'pendiente' end,
         updated_at = now()`,
    [id, version],
  );
  await audit(admin, "cargo_waiver", "document_template", id, { version });
  return { id, version };
}

export async function recordProvidedSignature(
  admin: AdminSession,
  code: string,
  participantId: string,
  input: { providerRef: string; decision: "firmado" | "rechazado"; note: string },
  file: { name: string; mime: string; bytes: Buffer } | null,
) {
  if (!signatureProviderName()) return { error: "proveedor_no_configurado" as const };
  if (input.decision === "firmado" && !file) return { error: "archivo" as const };
  const id = await idByCode(code);
  if (!id) return { error: "no_encontrado" as const };
  const owned = await sql("select id from participants where id = $1 and couple_id = $2", [participantId, id]);
  if (!owned[0]) return { error: "no_encontrado" as const };
  await sql(
    `update document_signatures
     set status = $3, method = 'carga_organizador', provider = $4, provider_ref = $5, note = $6,
         signed_name = $7, signed_mime = $8, signed_size = $9, signed_content = $10, updated_at = now()
     where participant_id = $1 and couple_id = $2`,
    [
      participantId,
      id,
      input.decision,
      signatureProviderName(),
      input.providerRef,
      input.note,
      file?.name ?? null,
      file?.mime ?? null,
      file?.bytes.length ?? null,
      file?.bytes ?? null,
    ],
  );
  if (file) {
    const view = await assemble(id, "es");
    await syncBinary({
      coupleId: id,
      code: view.code,
      localKind: `waiver-${participantId}`,
      localId: participantId,
      folder: "waiver",
      name: file.name,
      mime: file.mime,
      bytes: file.bytes,
    });
  }
  await audit(admin, "registro_firma_proveedor", "document_signature", participantId, {
    decision: input.decision,
    providerRef: input.providerRef,
  });
  return { view: await buildView(id, "es") };
}

export async function saveQuestionnaire(admin: AdminSession, input: { version: string; title: string; questions: { prompt: string; help?: string; required?: boolean }[] }) {
  await sql(`update questionnaires set active = false where event_id = $1 and active = true`, [EVENT_ID]);
  const id = newId();
  await sql(
    `insert into questionnaires (id, event_id, version, title, active) values ($1, $2, $3, $4, true)`,
    [id, EVENT_ID, input.version, input.title],
  );
  for (const [index, question] of input.questions.entries()) {
    await sql(
      `insert into questionnaire_questions (id, questionnaire_id, position, prompt, help, required) values ($1, $2, $3, $4, $5, $6)`,
      [newId(), id, index + 1, question.prompt, question.help ?? "", question.required !== false],
    );
  }
  await sql(
    `update questionnaire_submissions
     set status = case when status in ('enviado', 'verificado_externo') then 'requiere_revision' else status end,
         updated_at = now()
     where questionnaire_id is not null and questionnaire_id <> $1`,
    [id],
  );
  await audit(admin, "cargo_cuestionario", "questionnaire", id, { version: input.version, questions: input.questions.length });
  return { id, count: input.questions.length };
}

export async function verifyExternalSemaforo(admin: AdminSession, code: string, participantId: string) {
  const id = await idByCode(code);
  if (!id) return null;
  const event = await getEvent();
  if (event.semaforoMode !== "external") return null;
  await sql(
    `update questionnaire_submissions set status = 'verificado_externo', updated_at = now()
     where participant_id = $1 and couple_id = $2`,
    [participantId, id],
  );
  await audit(admin, "verifico_semaforo_externo", "questionnaire_submission", participantId, {});
  return buildView(id, "es");
}

export async function resetAnswerKey(admin: AdminSession, code: string, participantId: string) {
  const id = await idByCode(code);
  if (!id) return null;
  await sql(`update participants set answer_key_hash = null where id = $1 and couple_id = $2`, [participantId, id]);
  await audit(admin, "reinicio_clave_semaforo", "participant", participantId, {});
  return true;
}

export async function exportCsv() {
  const views = await registrationList("", "");
  const header = [
    "codigo",
    "demo",
    "esposo",
    "esposa",
    "correo_esposo",
    "correo_esposa",
    "ciudad",
    "region",
    "pais",
    "talla_camiseta_esposo",
    "talla_chaqueta_esposo",
    "talla_camiseta_esposa",
    "talla_chaqueta_esposa",
    "estado",
    "progreso",
    "modalidad",
    "paquete",
    "total",
    "pagado",
    "saldo",
    "invitacion",
    "waiver_esposo",
    "waiver_esposa",
    "semaforo_esposo",
    "semaforo_esposa",
    "maleta_esposo",
    "maleta_esposa",
  ];
  const lines = views.map((view) =>
    [
      view.code,
      view.isDemo ? "FICTICIO" : "",
      view.spouses.esposo.fullName,
      view.spouses.esposa.fullName,
      view.spouses.esposo.email,
      view.spouses.esposa.email,
      view.city,
      view.region,
      view.country,
      view.spouses.esposo.shirtSize,
      view.spouses.esposo.jacketSize,
      view.spouses.esposa.shirtSize,
      view.spouses.esposa.jacketSize,
      view.status,
      String(view.progress.percent),
      view.finance.modality,
      view.finance.packageKind,
      view.finance.priceConfigured ? (view.finance.totalCents / 100).toFixed(2) : "",
      (view.finance.paidCents / 100).toFixed(2),
      view.finance.balanceCents == null ? "" : (view.finance.balanceCents / 100).toFixed(2),
      view.invitation.status,
      view.waiver.spouses.esposo.status,
      view.waiver.spouses.esposa.status,
      view.spouses.esposo.semaforoStatus,
      view.spouses.esposa.semaforoStatus,
      "n/a",
      view.spouses.esposa.packingAck ? "revisada" : "pendiente",
    ]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}\n`;
}

export async function exportAnswers(admin: AdminSession) {
  const rows = await sql<{
    public_code: string;
    role: string;
    position: number;
    prompt: string;
    answer: string;
  }>(
    `select c.public_code, p.role, q.position, q.prompt, a.answer
     from questionnaire_answers a
     join participants p on p.id = a.participant_id
     join couples c on c.id = a.couple_id
     join questionnaire_questions q on q.id = a.question_id
     order by c.public_code, p.role, q.position`,
  );
  await audit(admin, "exporto_respuestas", "questionnaire", EVENT_ID, { rows: rows.length });
  return rows;
}

export async function auditLog() {
  return sql<{ id: string; at: string; actor_type: string; action: string; entity: string; entity_id: string; result: string }>(
    `select id, at, actor_type, action, entity, entity_id, result from audit_logs order by at desc limit 200`,
  );
}

export async function outboxList() {
  return sql<{ id: string; to_email: string; subject: string; status: string; created_at: string }>(
    `select id, to_email, subject, status, created_at from email_outbox order by created_at desc limit 100`,
  );
}

export async function outboxBody(admin: AdminSession, id: string) {
  const rows = await sql<{ body: string; subject: string; to_email: string; status: string }>(
    `select body, subject, to_email, status from email_outbox where id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  await audit(admin, "leyo_buzon", "email_outbox", id, {});
  return rows[0];
}

export async function saveEvent(admin: AdminSession, input: {
  slogan: string;
  subtitle: string;
  emotionalLine: string;
  city: string;
  region: string;
  country: string;
  startsOn: string;
  endsOn: string;
  eventYear: number;
  currency: string;
  price: number;
  hotelPrice: number;
  priceConfigured: boolean;
  shirtSizes: string[];
  jacketSizes: string[];
  semaforoMode: "external" | "internal";
  semaforoExternalUrl: string;
  semaforoPerSpouse: boolean;
  semaforoGroupSize: number;
  waiverRequiresBoth: boolean;
  retentionMonths: number;
}) {
  await sql(
    `update events set
      slogan = $2, subtitle = $3, emotional_line = $4, city = $5, region = $6, country = $7,
      starts_on = $8, ends_on = $9, event_year = $10, currency = $11, price_cents = $12,
      hotel_price_cents = $13, price_configured = $14, shirt_sizes = $15::jsonb, jacket_sizes = $16::jsonb,
      semaforo_mode = $17, semaforo_external_url = $18, semaforo_per_spouse = $19,
      semaforo_group_size = $20, waiver_requires_both = $21, retention_months = $22, updated_at = now()
     where id = $1`,
    [
      EVENT_ID,
      input.slogan,
      input.subtitle,
      input.emotionalLine,
      input.city,
      input.region,
      input.country,
      input.startsOn,
      input.endsOn,
      input.eventYear,
      input.currency.toUpperCase(),
      Math.round(input.price * 100),
      Math.round(input.hotelPrice * 100),
      input.priceConfigured,
      JSON.stringify(input.shirtSizes),
      JSON.stringify(input.jacketSizes),
      input.semaforoMode,
      input.semaforoExternalUrl,
      input.semaforoPerSpouse,
      input.semaforoGroupSize,
      input.waiverRequiresBoth,
      input.retentionMonths,
    ],
  );
  await audit(admin, "actualizo_evento", "event", EVENT_ID, { priceConfigured: input.priceConfigured });
  return getEvent();
}

export async function team() {
  return sql<{ id: string; email: string; name: string; role: string; active: boolean }>(
    `select id, email, name, role, active from administrators order by created_at`,
  );
}

export async function addTeamMember(admin: AdminSession, input: { email: string; name: string; password: string; role: AdminSession["role"] }) {
  const id = newId();
  await sql(
    `insert into administrators (id, email, name, password_hash, role) values ($1, $2, $3, $4, $5)`,
    [id, input.email.toLowerCase(), input.name, await hashSecret(input.password), input.role],
  );
  await audit(admin, "creo_administrador", "administrator", id, { role: input.role });
  return id;
}

export async function setTeamActive(admin: AdminSession, id: string, active: boolean) {
  if (id === admin.id && !active) return false;
  await sql(`update administrators set active = $2 where id = $1`, [id, active]);
  await audit(admin, "actualizo_administrador", "administrator", id, { active });
  return true;
}

export async function removeCouple(admin: AdminSession, code: string) {
  const id = await idByCode(code);
  if (!id) return false;
  await audit(admin, "elimino_pareja", "couple", id, { code });
  await sql(`delete from sessions where subject_id = $1`, [id]);
  await sql(`delete from couples where id = $1`, [id]);
  return true;
}

export async function saveLogo(admin: AdminSession, file: { name: string; mime: string; bytes: Buffer }) {
  await sql(
    `insert into brand_assets (kind, file_name, mime, size_bytes, content) values ('logo', $1, $2, $3, $4)
     on conflict (kind) do update set file_name = excluded.file_name, mime = excluded.mime, size_bytes = excluded.size_bytes, content = excluded.content, updated_at = now()`,
    [file.name, file.mime, file.bytes.length, file.bytes],
  );
  await audit(admin, "cargo_logo", "brand_asset", "logo", { name: file.name });
}

export async function logoFile() {
  const rows = await sql<Record<string, unknown>>("select file_name, mime, content from brand_assets where kind = 'logo'");
  const row = rows[0];
  if (!row) return null;
  return { name: String(row.file_name), mime: String(row.mime), bytes: asBuffer(row.content) };
}

export async function retryDrive(admin: AdminSession, code: string) {
  const id = await idByCode(code);
  if (!id) return null;
  await sql(`update drive_files set attempts = 0, status = 'pendiente' where couple_id = $1 and status = 'error'`, [id]);
  const view = await assemble(id, "es");
  const drive = await syncCoupleSnapshot({
    coupleId: id,
    code: view.code,
    json: JSON.stringify({ code: view.code, names: `${view.spouses.esposo.fullName} y ${view.spouses.esposa.fullName}`, city: view.city, status: view.status }),
  });
  await audit(admin, "reintento_drive", "drive_file", id, { drive });
  return drive;
}

export async function resetAccessKey(admin: AdminSession, code: string) {
  const id = await idByCode(code);
  if (!id) return null;
  const people = await sql<{ email: string; locale: string; full_name: string }>(
    `select p.email, c.locale from participants p join couples c on c.id = p.couple_id where c.id = $1`,
    [id],
  );
  const accessKey = newAccessKey();
  await sql(`update couples set access_key_hash = $2 where id = $1`, [id, await hashSecret(accessKey)]);
  const locale = people[0]?.locale === "en" ? "en" : "es";
  const message = accessMessage(locale, code, accessKey);
  let delivered = false;
  if (mailConfigured()) {
    const sent = await deliverEmail({
      to: people.map((person) => person.email),
      subject: message.subject,
      text: message.text,
      coupleId: id,
    });
    delivered = sent.some((item) => item.status === "enviado");
  }
  await audit(admin, "reenvio_clave", "couple", id, { delivered });
  return { delivered, accessKey };
}

