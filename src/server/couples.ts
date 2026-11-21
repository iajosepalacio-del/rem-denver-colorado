import { EVENT_ID } from "../lib/catalog";
import { sql, transaction } from "../lib/db";
import { asBuffer } from "../lib/files";
import { assess, balanceCents, formatPublicCode, sumVerified, type AssessInput } from "../lib/progress";
import { hashSecret, newAccessKey, newId, verifySecret } from "../lib/secrets";
import type { CoupleView, SpouseRole, SpouseView } from "../lib/types";
import { getEvent, type EventConfig } from "./event";
import { syncBinary, syncCoupleSnapshot, driveMode } from "./drive";
import { accessMessage, completionMessage, deliverEmail, mailConfigured } from "./mail";
import { signatureConfigured, signatureProviderName, createSignatureEnvelope } from "./signature";

type SpouseInput = {
  fullName: string;
  shirtSize: string;
  jacketSize: string;
  phoneCountry: string;
  phone: string;
  email: string;
};

type Query = typeof sql;

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return "";
}

function day(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function bool(value: unknown) {
  return value === true;
}

async function audit(
  q: Query,
  input: {
    actorType: string;
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    result: string;
    detail?: Record<string, unknown>;
  },
) {
  await q(
    `insert into audit_logs (id, actor_type, actor_id, action, entity, entity_id, result, detail)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      newId(),
      input.actorType,
      input.actorId,
      input.action,
      input.entity,
      input.entityId,
      input.result,
      JSON.stringify(input.detail ?? {}),
    ],
  );
}

function sizeOk(value: string, allowed: string[]) {
  return allowed.includes(value);
}

export async function createCouple(input: {
  esposo: SpouseInput;
  esposa: SpouseInput;
  city: string;
  region: string;
  country: string;
  locale: "es" | "en";
  demo?: boolean;
  accessKey?: string;
}) {
  const event = await getEvent();
  if (!sizeOk(input.esposo.shirtSize, event.shirtSizes) || !sizeOk(input.esposa.shirtSize, event.shirtSizes)) {
    return { error: "talla" as const };
  }
  if (!sizeOk(input.esposo.jacketSize, event.jacketSizes) || !sizeOk(input.esposa.jacketSize, event.jacketSizes)) {
    return { error: "talla" as const };
  }
  const accessKey = input.accessKey ?? newAccessKey();
  const accessHash = await hashSecret(accessKey);
  const coupleId = newId();
  const husbandId = newId();
  const wifeId = newId();
  const template = await activeWaiver();

  const code = await transaction(async (q) => {
    const counter = await q<{ last_value: number }>(
      `insert into code_counters (event_id, last_value) values ($1, 1)
       on conflict (event_id) do update set last_value = code_counters.last_value + 1
       returning last_value`,
      [EVENT_ID],
    );
    const publicCode = formatPublicCode(event.eventYear, Number(counter[0]?.last_value ?? 1));
    await q(
      `insert into couples (
        id, event_id, public_code, access_key_hash, city, region, country, locale, is_demo,
        privacy_accepted_at, questionnaire_consent_at, status
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now(), 'en_proceso')`,
      [
        coupleId,
        EVENT_ID,
        publicCode,
        accessHash,
        input.city,
        input.region,
        input.country,
        input.locale,
        Boolean(input.demo),
      ],
    );
    for (const spouse of [
      { id: husbandId, role: "esposo", data: input.esposo },
      { id: wifeId, role: "esposa", data: input.esposa },
    ]) {
      await q(
        `insert into participants (
          id, couple_id, role, full_name, shirt_size, jacket_size, phone_country, phone, email
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          spouse.id,
          coupleId,
          spouse.role,
          spouse.data.fullName,
          spouse.data.shirtSize,
          spouse.data.jacketSize,
          spouse.data.phoneCountry,
          spouse.data.phone,
          spouse.data.email.toLowerCase(),
        ],
      );
      await q(
        `insert into document_signatures (id, couple_id, participant_id, template_id, status, version)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          newId(),
          coupleId,
          spouse.id,
          template?.id ?? null,
          template ? "pendiente" : "sin_configuracion",
          template?.version ?? "",
        ],
      );
      await q(
        `insert into questionnaire_submissions (participant_id, couple_id, status) values ($1, $2, 'pendiente')`,
        [spouse.id, coupleId],
      );
    }
    await q(`insert into registrations (couple_id, last_step) values ($1, 'datos')`, [coupleId]);
    await q(`insert into financial_accounts (couple_id) values ($1)`, [coupleId]);
    await q(`insert into invitation_requests (couple_id, status) values ($1, 'no_responde')`, [coupleId]);
    await audit(q, {
      actorType: input.demo ? "sistema" : "pareja",
      actorId: coupleId,
      action: "creo_inscripcion",
      entity: "couple",
      entityId: coupleId,
      result: "ok",
      detail: { code: publicCode, demo: Boolean(input.demo), privacy: true, questionnaire: true },
    });
    return publicCode;
  });

  const message = accessMessage(input.locale, code, accessKey);
  const email = await deliverEmail({
    to: [input.esposo.email, input.esposa.email],
    subject: message.subject,
    text: message.text,
    coupleId,
  });
  const view = await assemble(coupleId, input.locale);
  const drive = await syncCoupleSnapshot({ coupleId, code, json: snapshotJson(view) });
  return { code, accessKey, coupleId, email, drive, view };
}

export async function loginCouple(code: string, email: string, accessKey: string) {
  const rows = await sql<{ id: string; access_key_hash: string }>(
    `select c.id, c.access_key_hash
     from couples c
     join participants p on p.couple_id = c.id
     where upper(c.public_code) = upper($1) and lower(p.email) = lower($2)`,
    [code.trim(), email.trim()],
  );
  const couple = rows[0];
  if (!couple) return null;
  const ok = await verifySecret(accessKey.trim().toUpperCase(), couple.access_key_hash);
  if (!ok) return null;
  return couple.id;
}

async function activeWaiver() {
  const rows = await sql<{ id: string; version: string; file_name: string }>(
    `select id, version, file_name from document_templates
     where event_id = $1 and kind = 'waiver' and active = true
     order by created_at desc limit 1`,
    [EVENT_ID],
  );
  return rows[0] ?? null;
}

async function activeQuestionnaire() {
  const rows = await sql<{ id: string; version: string; title: string }>(
    `select id, version, title from questionnaires where event_id = $1 and active = true order by created_at desc limit 1`,
    [EVENT_ID],
  );
  return rows[0] ?? null;
}

export async function assemble(coupleId: string, locale: "es" | "en"): Promise<CoupleView> {
  const event = await getEvent();
  const couples = await sql<Record<string, unknown>>("select * from couples where id = $1", [coupleId]);
  const couple = couples[0];
  if (!couple) throw new Error("missing_couple");
  const people = await sql<Record<string, unknown>>(
    "select * from participants where couple_id = $1",
    [coupleId],
  );
  const financeRows = await sql<Record<string, unknown>>(
    "select * from financial_accounts where couple_id = $1",
    [coupleId],
  );
  const payments = await sql<Record<string, unknown>>(
    `select p.id, p.amount_cents, p.currency, p.method, p.paid_on, p.status, p.note, p.created_at, r.file_name
     from payments p
     left join payment_receipts r on r.payment_id = p.id
     where p.couple_id = $1
     order by p.created_at`,
    [coupleId],
  );
  const invitationRows = await sql<Record<string, unknown>>(
    `select needed, status, delivered_at, file_name, reviewer_note from invitation_requests where couple_id = $1`,
    [coupleId],
  );
  const signatures = await sql<Record<string, unknown>>(
    `select participant_id, status, provider_ref, version, signed_name from document_signatures where couple_id = $1`,
    [coupleId],
  );
  const template = await activeWaiver();
  const questionnaire = await activeQuestionnaire();
  const questionCountRows = questionnaire
    ? await sql<{ n: number }>(
        "select count(*)::int as n from questionnaire_questions where questionnaire_id = $1",
        [questionnaire.id],
      )
    : [{ n: 0 }];
  const submissions = await sql<Record<string, unknown>>(
    "select participant_id, status, questionnaire_id from questionnaire_submissions where couple_id = $1",
    [coupleId],
  );
  const answerCounts = await sql<{ participant_id: string; n: number }>(
    "select participant_id, count(*)::int as n from questionnaire_answers where couple_id = $1 group by participant_id",
    [coupleId],
  );
  const checks = await sql<{ participant_id: string; item_key: string }>(
    "select participant_id, item_key from packing_checks where couple_id = $1 and checked = true",
    [coupleId],
  );
  const acks = await sql<{ participant_id: string }>(
    "select participant_id from packing_acks where couple_id = $1",
    [coupleId],
  );
  const deletion = await sql(
    "select id from deletion_requests where couple_id = $1 and status = 'pendiente'",
    [coupleId],
  );
  const driveRows = await sql<{ status: string }>(
    `select status from drive_files where couple_id = $1 order by updated_at desc limit 1`,
    [coupleId],
  );

  const byRole = Object.fromEntries(people.map((person) => [String(person.role), person])) as Record<string, Record<string, unknown>>;
  const finance = financeRows[0] ?? {};
  const invitation = invitationRows[0] ?? {};
  const paymentViews = payments.map((payment) => ({
    id: String(payment.id),
    amountCents: Number(payment.amount_cents),
    currency: String(payment.currency),
    method: String(payment.method),
    paidOn: day(payment.paid_on),
    status: String(payment.status) as CoupleView["finance"]["payments"][number]["status"],
    note: String(payment.note ?? ""),
    hasReceipt: Boolean(payment.file_name),
    receiptName: payment.file_name ? String(payment.file_name) : null,
    createdAt: iso(payment.created_at),
  }));
  const verifiedPaid = sumVerified(paymentViews);
  const override = finance.price_override_cents == null ? null : Number(finance.price_override_cents);
  const priceConfigured = override != null || event.priceConfigured;
  const totalCents = override != null ? override : event.priceCents;
  const questions = Number(questionCountRows[0]?.n ?? 0);
  const semaforoReady =
    event.semaforoMode === "external"
      ? event.semaforoExternalUrl.startsWith("https://")
      : questions > 0;

  const spouseView = (role: SpouseRole): SpouseView => {
    const person = byRole[role]!;
    const submission = submissions.find((row) => row.participant_id === person.id);
    let semaforoStatus = String(submission?.status ?? "pendiente");
    if (
      questionnaire &&
      submission?.questionnaire_id &&
      submission.questionnaire_id !== questionnaire.id &&
      (semaforoStatus === "enviado" || semaforoStatus === "verificado_externo")
    ) {
      semaforoStatus = "requiere_revision";
    }
    const signature = signatures.find((row) => row.participant_id === person.id);
    const checked = checks.filter((row) => row.participant_id === person.id).map((row) => row.item_key);
    return {
      id: String(person.id),
      role,
      fullName: String(person.full_name),
      shirtSize: String(person.shirt_size),
      jacketSize: String(person.jacket_size),
      phoneCountry: String(person.phone_country),
      phone: String(person.phone),
      email: String(person.email),
      semaforoStatus,
      semaforoAnswered: Number(answerCounts.find((row) => row.participant_id === person.id)?.n ?? 0),
      semaforoTotal: questions,
      packingAck: acks.some((row) => row.participant_id === person.id),
      packingChecked: checked.length,
      waiverStatus: template ? String(signature?.status ?? "pendiente") : "sin_configuracion",
    };
  };

  const esposo = spouseView("esposo");
  const esposa = spouseView("esposa");
  const invitationState = invitationStateOf(invitation);
  const semaforoStatuses = semaforoProgressStatuses(event, [esposo, esposa]);
  const input: AssessInput = {
    personalComplete: Boolean(esposo.fullName && esposa.fullName && esposo.email && esposa.email && couple.city && couple.country),
    modality: finance.modality === "total" || finance.modality === "cuotas" ? finance.modality : "",
    priceConfigured,
    totalCents,
    verifiedPaidCents: verifiedPaid,
    hasRejectedPayment: paymentViews.some((payment) => payment.status === "rechazado"),
    invitation: invitationState,
    waiverConfigured: Boolean(template),
    waiverRequiresBoth: event.waiverRequiresBoth,
    waiverStatuses: [esposo.waiverStatus, esposa.waiverStatus] as AssessInput["waiverStatuses"],
    semaforoReady,
    semaforoStatuses,
    packingAcks: [esposo, esposa].filter((spouse) => spouse.packingAck).length,
    packingPeople: 2,
  };
  const progress = assess(input);
  const driveStatus = driveState(driveRows[0]?.status);
  const checksBySpouse: Record<string, string[]> = {
    [esposo.id]: checks.filter((row) => row.participant_id === esposo.id).map((row) => row.item_key),
    [esposa.id]: checks.filter((row) => row.participant_id === esposa.id).map((row) => row.item_key),
  };

  return {
    code: String(couple.public_code),
    isDemo: bool(couple.is_demo),
    city: String(couple.city),
    region: String(couple.region ?? ""),
    country: String(couple.country),
    createdAt: iso(couple.created_at),
    updatedAt: iso(couple.updated_at),
    status: progress.status,
    progress,
    spouses: { esposo, esposa },
    finance: {
      currency: event.currency,
      priceConfigured,
      totalCents,
      modality: input.modality,
      claimPaidInFull: bool(finance.claim_paid_in_full),
      paidCents: verifiedPaid,
      balanceCents: priceConfigured ? balanceCents(totalCents, verifiedPaid) : null,
      lastPaymentOn: lastVerified(paymentViews),
      adminNotes: String(finance.admin_notes ?? ""),
      payments: paymentViews,
    },
    invitation: {
      answered: invitation.needed === true || invitation.needed === false,
      needed: invitation.needed == null ? null : Boolean(invitation.needed),
      status: String(invitation.status ?? "no_responde"),
      deliveredAt: invitation.delivered_at ? iso(invitation.delivered_at) : null,
      fileName: invitation.file_name ? String(invitation.file_name) : null,
      reviewerNote: String(invitation.reviewer_note ?? ""),
    },
    waiver: {
      configured: Boolean(template),
      version: template?.version ?? null,
      fileName: template?.file_name ?? null,
      requiresBoth: event.waiverRequiresBoth,
      providerConfigured: signatureConfigured(),
      providerName: signatureProviderName(),
      spouses: {
        esposo: signatureView(signatures, esposo.id, template),
        esposa: signatureView(signatures, esposa.id, template),
      },
    },
    semaforo: {
      mode: event.semaforoMode,
      externalUrl: event.semaforoExternalUrl,
      questionsLoaded: questions > 0,
      version: questionnaire?.version ?? null,
      title: questionnaire?.title ?? null,
      perSpouse: event.semaforoPerSpouse,
      groupSize: event.semaforoGroupSize,
      questionCount: questions,
    },
    packing: {
      items: event.packingItems.map((item) => ({
        key: item.key,
        group: item.group,
        label: locale === "en" ? item.en : item.es,
      })),
      checks: checksBySpouse,
    },
    integrations: {
      mail: mailConfigured(),
      drive: driveStatus,
    },
    deletionRequested: deletion.length > 0,
  };
}

function signatureView(
  signatures: Record<string, unknown>[],
  participantId: string,
  template: { version: string } | null,
) {
  const row = signatures.find((item) => item.participant_id === participantId);
  return {
    status: template ? String(row?.status ?? "pendiente") : "sin_configuracion",
    providerRef: String(row?.provider_ref ?? ""),
    version: String(row?.version ?? ""),
    signedName: row?.signed_name ? String(row.signed_name) : null,
  };
}

function invitationStateOf(invitation: Record<string, unknown>): AssessInput["invitation"] {
  if (invitation.needed === false || invitation.status === "no_aplica") return "not_needed";
  if (invitation.status === "entregada") return "delivered";
  if (invitation.status === "rechazada") return "rejected";
  if (invitation.status === "en_revision" || invitation.status === "aprobada") return "in_review";
  if (invitation.status === "solicitud_pendiente") return "pending";
  return "unanswered";
}

function semaforoProgressStatuses(event: EventConfig, spouses: SpouseView[]): AssessInput["semaforoStatuses"] {
  const statuses = spouses.map((spouse) => spouse.semaforoStatus as AssessInput["semaforoStatuses"][number]);
  if (!event.semaforoPerSpouse) {
    const done = statuses.find((status) => status === "enviado" || status === "verificado_externo");
    return [done ?? statuses[0] ?? "pendiente"];
  }
  return statuses;
}

function lastVerified(payments: CoupleView["finance"]["payments"]) {
  const dates = payments
    .filter((payment) => payment.status === "verificado" && payment.paidOn)
    .map((payment) => payment.paidOn as string)
    .sort();
  return dates.at(-1) ?? null;
}

function driveState(status: string | undefined): CoupleView["integrations"]["drive"] {
  if (driveMode() === "off") return "no_configurado";
  if (status === "sincronizado") return "sincronizado";
  if (status === "error") return "error";
  return "pendiente";
}

function snapshotJson(view: CoupleView) {
  return JSON.stringify({
    code: view.code,
    names: `${view.spouses.esposo.fullName} y ${view.spouses.esposa.fullName}`,
    emails: [view.spouses.esposo.email, view.spouses.esposa.email],
    phones: [
      `${view.spouses.esposo.phoneCountry} ${view.spouses.esposo.phone}`,
      `${view.spouses.esposa.phoneCountry} ${view.spouses.esposa.phone}`,
    ],
    city: view.city,
    region: view.region,
    country: view.country,
    sizes: {
      esposo: { shirt: view.spouses.esposo.shirtSize, jacket: view.spouses.esposo.jacketSize },
      esposa: { shirt: view.spouses.esposa.shirtSize, jacket: view.spouses.esposa.jacketSize },
    },
    status: view.status,
    progress: view.progress.percent,
    finance: {
      modality: view.finance.modality,
      totalCents: view.finance.priceConfigured ? view.finance.totalCents : null,
      paidCents: view.finance.paidCents,
      balanceCents: view.finance.balanceCents,
    },
    invitation: view.invitation.status,
    waiver: {
      esposo: view.waiver.spouses.esposo.status,
      esposa: view.waiver.spouses.esposa.status,
    },
    semaforo: {
      esposo: view.spouses.esposo.semaforoStatus,
      esposa: view.spouses.esposa.semaforoStatus,
    },
    note: "Este archivo no incluye respuestas del cuestionario SEMÁFORO.",
  });
}

export async function buildView(coupleId: string, locale: "es" | "en") {
  const view = await assemble(coupleId, locale);
  await sql(`update couples set status = $2 where id = $1 and status <> $2`, [coupleId, view.status]);
  if (view.status === "completado") {
    const already = await sql(
      "select id from audit_logs where entity_id = $1 and action = 'registro_completado' limit 1",
      [coupleId],
    );
    if (!already[0]) {
      await audit(sql, {
        actorType: "sistema",
        actorId: coupleId,
        action: "registro_completado",
        entity: "couple",
        entityId: coupleId,
        result: "ok",
        detail: { code: view.code },
      });
      const message = completionMessage(
        locale,
        view.code,
        view.spouses.esposo.fullName,
        view.spouses.esposa.fullName,
      );
      await deliverEmail({
        to: [view.spouses.esposo.email, view.spouses.esposa.email],
        subject: message.subject,
        text: message.text,
        coupleId,
      });
    }
  }
  return view;
}

async function syncView(coupleId: string, locale: "es" | "en") {
  const view = await buildView(coupleId, locale);
  const drive = await syncCoupleSnapshot({ coupleId, code: view.code, json: snapshotJson(view) });
  view.integrations.drive = drive === "no_configurado" ? "no_configurado" : drive;
  return view;
}

export async function updatePersonal(
  coupleId: string,
  input: {
    updatedAt: string;
    esposo: SpouseInput;
    esposa: SpouseInput;
    city: string;
    region: string;
    country: string;
  },
) {
  const event = await getEvent();
  if (
    !sizeOk(input.esposo.shirtSize, event.shirtSizes) ||
    !sizeOk(input.esposa.shirtSize, event.shirtSizes) ||
    !sizeOk(input.esposo.jacketSize, event.jacketSizes) ||
    !sizeOk(input.esposa.jacketSize, event.jacketSizes)
  ) {
    return { error: "talla" as const };
  }
  const current = await sql<{ updated_at: unknown }>("select updated_at from couples where id = $1", [coupleId]);
  if (!current[0]) return { error: "no_encontrado" as const };
  const currentIso = iso(current[0].updated_at);
  if (Math.abs(new Date(currentIso).getTime() - new Date(input.updatedAt).getTime()) > 1500) {
    return { error: "conflicto" as const };
  }
  await sql(
    `update couples set city = $2, region = $3, country = $4, updated_at = now() where id = $1`,
    [coupleId, input.city, input.region, input.country],
  );
  for (const role of ["esposo", "esposa"] as const) {
    const spouse = input[role];
    await sql(
      `update participants set full_name = $3, shirt_size = $4, jacket_size = $5, phone_country = $6, phone = $7, email = $8
       where couple_id = $1 and role = $2`,
      [coupleId, role, spouse.fullName, spouse.shirtSize, spouse.jacketSize, spouse.phoneCountry, spouse.phone, spouse.email.toLowerCase()],
    );
  }
  return { view: await syncView(coupleId, "es") };
}

export async function setModality(coupleId: string, modality: "total" | "cuotas", claimPaidInFull: boolean) {
  await sql(
    `update financial_accounts
     set modality = $2, claim_paid_in_full = $3, updated_at = now()
     where couple_id = $1`,
    [coupleId, modality, modality === "total" ? claimPaidInFull : false],
  );
  await sql(`update registrations set last_step = 'pagos', updated_at = now() where couple_id = $1`, [coupleId]);
  return syncView(coupleId, "es");
}

export async function addPayment(
  coupleId: string,
  input: { amount: number; paidOn: string; method: string; note: string },
) {
  const event = await getEvent();
  const id = newId();
  const amountCents = Math.round(input.amount * 100);
  await sql(
    `insert into payments (id, couple_id, amount_cents, currency, method, paid_on, status, note)
     values ($1, $2, $3, $4, $5, $6, 'pendiente', $7)`,
    [id, coupleId, amountCents, event.currency, input.method, input.paidOn, input.note],
  );
  const view = await syncView(coupleId, "es");
  return { id, view };
}

export async function saveReceipt(coupleId: string, paymentId: string, file: { name: string; mime: string; bytes: Buffer }) {
  const payment = await sql("select id from payments where id = $1 and couple_id = $2", [paymentId, coupleId]);
  if (!payment[0]) return null;
  await sql(
    `insert into payment_receipts (payment_id, couple_id, file_name, mime, size_bytes, content)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (payment_id) do update set file_name = excluded.file_name, mime = excluded.mime, size_bytes = excluded.size_bytes, content = excluded.content, created_at = now()`,
    [paymentId, coupleId, file.name, file.mime, file.bytes.length, file.bytes],
  );
  const view = await assemble(coupleId, "es");
  const drive = await syncBinary({
    coupleId,
    code: view.code,
    localKind: "receipt",
    localId: paymentId,
    folder: "comprobantes",
    name: file.name,
    mime: file.mime,
    bytes: file.bytes,
  });
  view.integrations.drive = drive === "no_configurado" ? "no_configurado" : drive;
  return view;
}

export async function receiptFor(coupleId: string, paymentId: string) {
  const rows = await sql<Record<string, unknown>>(
    `select file_name, mime, content from payment_receipts where payment_id = $1 and couple_id = $2`,
    [paymentId, coupleId],
  );
  const row = rows[0];
  if (!row) return null;
  return { name: String(row.file_name), mime: String(row.mime), bytes: asBuffer(row.content) };
}

export async function chooseInvitation(coupleId: string, needed: boolean) {
  await sql(
    `update invitation_requests
     set needed = $2,
         status = $3,
         requested_at = case when $2 then now() else requested_at end,
         updated_at = now()
     where couple_id = $1`,
    [coupleId, needed, needed ? "solicitud_pendiente" : "no_aplica"],
  );
  await sql(`update registrations set last_step = 'documentos', updated_at = now() where couple_id = $1`, [coupleId]);
  return syncView(coupleId, "es");
}

export async function invitationFile(coupleId: string) {
  const rows = await sql<Record<string, unknown>>(
    `select file_name, mime, content, status from invitation_requests where couple_id = $1`,
    [coupleId],
  );
  const row = rows[0];
  if (!row?.content || (row.status !== "entregada" && row.status !== "aprobada")) return null;
  return { name: String(row.file_name), mime: String(row.mime), bytes: asBuffer(row.content) };
}

export async function waiverTemplateFile() {
  const rows = await sql<Record<string, unknown>>(
    `select file_name, mime, content, version from document_templates
     where event_id = $1 and kind = 'waiver' and active = true
     order by created_at desc limit 1`,
    [EVENT_ID],
  );
  const row = rows[0];
  if (!row) return null;
  return { name: String(row.file_name), mime: String(row.mime), bytes: asBuffer(row.content), version: String(row.version) };
}

export async function startSignature(coupleId: string, participantId: string) {
  const people = await sql<Record<string, unknown>>(
    "select id, full_name, email, role from participants where id = $1 and couple_id = $2",
    [participantId, coupleId],
  );
  const person = people[0];
  const template = await waiverTemplateFile();
  if (!person || !template) return { error: "no_configurado" as const };
  if (!signatureConfigured()) return { error: "proveedor_no_configurado" as const, version: template.version };
  const couple = await sql<{ public_code: string }>("select public_code from couples where id = $1", [coupleId]);
  const envelope = await createSignatureEnvelope({
    coupleCode: couple[0]?.public_code ?? coupleId,
    version: template.version,
    name: String(person.full_name),
    email: String(person.email),
    role: String(person.role),
  });
  if (!envelope.ok) return { error: envelope.reason };
  await sql(
    `update document_signatures
     set status = 'enviado', method = 'proveedor', provider = $3, provider_ref = $4, version = $5, template_id = (
       select id from document_templates where event_id = $6 and kind = 'waiver' and active = true order by created_at desc limit 1
     ), updated_at = now()
     where participant_id = $1 and couple_id = $2`,
    [participantId, coupleId, signatureProviderName(), envelope.id, template.version, EVENT_ID],
  );
  const view = await syncView(coupleId, "es");
  return { view, signingUrl: envelope.signingUrl };
}

export async function applySignatureWebhook(envelopeId: string, status: "signed" | "rejected") {
  const rows = await sql<{ participant_id: string; couple_id: string }>(
    `select participant_id, couple_id from document_signatures where provider_ref = $1 and method = 'proveedor'`,
    [envelopeId],
  );
  const row = rows[0];
  if (!row) return false;
  await sql(
    `update document_signatures set status = $2, updated_at = now() where participant_id = $1`,
    [row.participant_id, status === "signed" ? "firmado" : "rechazado"],
  );
  await audit(sql, {
    actorType: "proveedor",
    actorId: "firma",
    action: "actualizo_firma",
    entity: "document_signature",
    entityId: row.participant_id,
    result: status,
    detail: {},
  });
  await syncView(row.couple_id, "es");
  return true;
}

export async function signedWaiverFile(coupleId: string, participantId: string) {
  const rows = await sql<Record<string, unknown>>(
    `select signed_name, signed_mime, signed_content, status from document_signatures
     where couple_id = $1 and participant_id = $2`,
    [coupleId, participantId],
  );
  const row = rows[0];
  if (!row?.signed_content || row.status !== "firmado") return null;
  return { name: String(row.signed_name), mime: String(row.signed_mime), bytes: asBuffer(row.signed_content) };
}

export async function markExternalOpened(coupleId: string, participantId: string) {
  const event = await getEvent();
  if (event.semaforoMode !== "external") return { error: "no_configurado" as const };
  const owned = await sql("select id from participants where id = $1 and couple_id = $2", [participantId, coupleId]);
  if (!owned[0]) return { error: "no_encontrado" as const };
  await sql(
    `update questionnaire_submissions
     set status = case when status in ('verificado_externo', 'enviado') then status else 'en_proceso' end,
         external_opened_at = coalesce(external_opened_at, now()),
         updated_at = now()
     where participant_id = $1`,
    [participantId],
  );
  return { view: await syncView(coupleId, "es") };
}

export async function setAnswerKey(coupleId: string, participantId: string, answerKey: string) {
  const hash = await hashSecret(answerKey);
  const rows = await sql(
    `update participants set answer_key_hash = $3
     where id = $1 and couple_id = $2 and answer_key_hash is null
     returning id`,
    [participantId, coupleId, hash],
  );
  if (!rows[0]) return { error: "conflicto" as const };
  return { ok: true as const };
}

export async function saveAnswers(
  coupleId: string,
  input: { participantId: string; answerKey: string; answers: { questionId: string; answer: string }[]; submit: boolean },
) {
  const event = await getEvent();
  if (event.semaforoMode !== "internal") return { error: "no_configurado" as const };
  const people = await sql<{ answer_key_hash: string | null }>(
    "select answer_key_hash from participants where id = $1 and couple_id = $2",
    [input.participantId, coupleId],
  );
  const person = people[0];
  if (!person?.answer_key_hash) return { error: "clave" as const };
  if (!(await verifySecret(input.answerKey, person.answer_key_hash))) return { error: "clave" as const };
  const questionnaire = await activeQuestionnaire();
  if (!questionnaire) return { error: "no_configurado" as const };
  const questions = await sql<{ id: string; required: boolean }>(
    "select id, required from questionnaire_questions where questionnaire_id = $1",
    [questionnaire.id],
  );
  const allowed = new Set(questions.map((question) => question.id));
  for (const answer of input.answers) {
    if (!allowed.has(answer.questionId)) return { error: "validacion" as const };
    await sql(
      `insert into questionnaire_answers (id, participant_id, couple_id, questionnaire_id, question_id, answer)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (participant_id, question_id) do update set answer = excluded.answer, updated_at = now()`,
      [newId(), input.participantId, coupleId, questionnaire.id, answer.questionId, answer.answer],
    );
  }
  if (input.submit) {
    const stored = await sql<{ question_id: string }>(
      "select question_id from questionnaire_answers where participant_id = $1 and questionnaire_id = $2",
      [input.participantId, questionnaire.id],
    );
    const answered = new Set(stored.map((row) => row.question_id));
    const missing = questions.some((question) => question.required && !answered.has(question.id));
    if (missing) return { error: "incompleto" as const };
    await sql(
      `update questionnaire_submissions
       set status = 'enviado', questionnaire_id = $2, submitted_at = now(), updated_at = now()
       where participant_id = $1`,
      [input.participantId, questionnaire.id],
    );
    const payload = await ownAnswers(coupleId, input.participantId, input.answerKey);
    const view = await assemble(coupleId, "es");
    const role = view.spouses.esposo.id === input.participantId ? "esposo" : "esposa";
    if (payload) {
      await syncBinary({
        coupleId,
        code: view.code,
        localKind: `semaforo-${role}`,
        localId: input.participantId,
        folder: "semaforo",
        name: `semaforo-${role}.json`,
        mime: "application/json",
        bytes: Buffer.from(JSON.stringify({ code: view.code, role, version: questionnaire.version, answers: payload })),
      });
    }
  }
  return { view: await syncView(coupleId, "es") };
}

export async function ownAnswers(coupleId: string, participantId: string, answerKey: string) {
  const people = await sql<{ answer_key_hash: string | null }>(
    "select answer_key_hash from participants where id = $1 and couple_id = $2",
    [inputSafe(participantId), coupleId],
  );
  const person = people[0];
  if (!person?.answer_key_hash) return null;
  if (!(await verifySecret(answerKey, person.answer_key_hash))) return null;
  const rows = await sql<{ position: number; prompt: string; answer: string }>(
    `select q.position, q.prompt, a.answer
     from questionnaire_answers a
     join questionnaire_questions q on q.id = a.question_id
     where a.participant_id = $1 and a.couple_id = $2
     order by q.position`,
    [participantId, coupleId],
  );
  return rows;
}

function inputSafe(value: string) {
  return value;
}

export async function questionsForCouple(coupleId: string, participantId: string) {
  const owned = await sql("select id from participants where id = $1 and couple_id = $2", [participantId, coupleId]);
  if (!owned[0]) return null;
  const questionnaire = await activeQuestionnaire();
  if (!questionnaire) return null;
  const questions = await sql<{ id: string; position: number; prompt: string; help: string; required: boolean }>(
    `select id, position, prompt, help, required from questionnaire_questions where questionnaire_id = $1 order by position`,
    [questionnaire.id],
  );
  const person = await sql<{ answer_key_hash: string | null; role: string }>(
    "select answer_key_hash, role from participants where id = $1",
    [participantId],
  );
  return {
    questionnaire,
    questions,
    role: String(person[0]?.role ?? ""),
    hasKey: Boolean(person[0]?.answer_key_hash),
  };
}

export async function togglePack(coupleId: string, participantId: string, itemKey: string, checked: boolean) {
  const owned = await sql("select id from participants where id = $1 and couple_id = $2", [participantId, coupleId]);
  if (!owned[0]) return null;
  const event = await getEvent();
  if (!event.packingItems.some((item) => item.key === itemKey)) return null;
  await sql(
    `insert into packing_checks (participant_id, couple_id, item_key, checked) values ($1, $2, $3, $4)
     on conflict (participant_id, item_key) do update set checked = excluded.checked, updated_at = now()`,
    [participantId, coupleId, itemKey, checked],
  );
  return syncView(coupleId, "es");
}

export async function acknowledgePack(coupleId: string, participantId: string) {
  const owned = await sql("select id from participants where id = $1 and couple_id = $2", [participantId, coupleId]);
  if (!owned[0]) return null;
  await sql(
    `insert into packing_acks (participant_id, couple_id) values ($1, $2)
     on conflict (participant_id) do update set acknowledged_at = now()`,
    [participantId, coupleId],
  );
  await sql(`update registrations set last_step = 'maleta', updated_at = now() where couple_id = $1`, [coupleId]);
  return syncView(coupleId, "es");
}

export async function requestDeletion(coupleId: string) {
  const pending = await sql("select id from deletion_requests where couple_id = $1 and status = 'pendiente'", [coupleId]);
  if (!pending[0]) {
    await sql(
      `insert into deletion_requests (id, couple_id, status) values ($1, $2, 'pendiente')`,
      [newId(), coupleId],
    );
    await audit(sql, {
      actorType: "pareja",
      actorId: coupleId,
      action: "solicito_eliminacion",
      entity: "couple",
      entityId: coupleId,
      result: "pendiente",
    });
  }
  return assemble(coupleId, "es");
}

export async function participantInCouple(coupleId: string, participantId: string) {
  const rows = await sql("select id from participants where id = $1 and couple_id = $2", [participantId, coupleId]);
  return Boolean(rows[0]);
}
