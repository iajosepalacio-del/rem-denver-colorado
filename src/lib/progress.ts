export type BlockState = "pendiente" | "en_proceso" | "completado" | "requiere_revision" | "no_aplica";

export type RegistrationStatus =
  | "en_proceso"
  | "documentacion_pendiente"
  | "pendiente_verificacion"
  | "completado";

export type BlockKey = "personal" | "payment" | "invitation" | "waiver" | "semaforo" | "packing";

export type ProgressBlock = {
  key: BlockKey;
  state: BlockState;
  ratio: number;
  applicable: boolean;
};

export type ProgressResult = {
  percent: number;
  status: RegistrationStatus;
  blocks: ProgressBlock[];
  needsReview: boolean;
  blocking: BlockKey[];
};

export type WaiverMark = "sin_configuracion" | "pendiente" | "enviado" | "firmado" | "rechazado" | "requiere_revision";

export type AssessInput = {
  personalComplete: boolean;
  modality: "" | "total" | "cuotas";
  priceConfigured: boolean;
  totalCents: number;
  verifiedPaidCents: number;
  hasRejectedPayment: boolean;
  invitation: "unanswered" | "not_needed" | "pending" | "in_review" | "delivered" | "rejected";
  waiverConfigured: boolean;
  waiverRequiresBoth: boolean;
  waiverStatuses: WaiverMark[];
  semaforoReady: boolean;
  semaforoStatuses: Array<"pendiente" | "en_proceso" | "enviado" | "verificado_externo" | "requiere_revision">;
  packingAcks: number;
  packingPeople: number;
};

export function sumVerified(payments: { amountCents: number; status: string }[]) {
  return payments.reduce((sum, payment) => sum + (payment.status === "verificado" ? payment.amountCents : 0), 0);
}

export function balanceCents(totalCents: number, verifiedPaidCents: number) {
  return totalCents - verifiedPaidCents;
}

function clamp(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function average(blocks: ProgressBlock[]) {
  const applicable = blocks.filter((block) => block.applicable);
  if (applicable.length === 0) return 0;
  const total = applicable.reduce((sum, block) => sum + clamp(block.ratio), 0);
  return Math.round((total / applicable.length) * 100);
}

export function assess(input: AssessInput): ProgressResult {
  const paymentRatio = paymentProgress(input);
  const invitation = invitationBlock(input.invitation);
  const waiver = waiverBlock(input);
  const semaforo = semaforoBlock(input);
  const packingRatio = input.packingPeople === 0 ? 0 : input.packingAcks / input.packingPeople;
  const packingComplete = input.packingPeople > 0 && input.packingAcks >= input.packingPeople;

  const blocks: ProgressBlock[] = [
    {
      key: "personal",
      applicable: true,
      state: input.personalComplete ? "completado" : "pendiente",
      ratio: input.personalComplete ? 1 : 0,
    },
    paymentRatio,
    invitation,
    waiver,
    semaforo,
    {
      key: "packing",
      applicable: true,
      state: packingComplete ? "completado" : packingRatio > 0 ? "en_proceso" : "pendiente",
      ratio: packingRatio,
    },
  ];

  const docsOk = invitation.ratio === 1 && waiver.ratio === 1 && semaforo.ratio === 1;
  const payOk = paymentRatio.ratio === 1;
  let status: RegistrationStatus = "completado";
  if (!input.personalComplete) status = "en_proceso";
  else if (!docsOk) status = "documentacion_pendiente";
  else if (!payOk) status = "pendiente_verificacion";
  else if (!packingComplete) status = "en_proceso";

  const needsReview = blocks.some((block) => block.state === "requiere_revision");
  const blocking = blocks.filter((block) => block.applicable && block.ratio < 1).map((block) => block.key);

  return {
    percent: average(blocks),
    status,
    blocks,
    needsReview,
    blocking,
  };
}

function paymentProgress(input: AssessInput): ProgressBlock {
  if (!input.modality) {
    return { key: "payment", applicable: true, state: "pendiente", ratio: 0 };
  }
  if (!input.priceConfigured) {
    return {
      key: "payment",
      applicable: true,
      state: input.hasRejectedPayment ? "requiere_revision" : "en_proceso",
      ratio: 0.35,
    };
  }
  if (input.totalCents <= 0) {
    return { key: "payment", applicable: true, state: "completado", ratio: 1 };
  }
  const covered = input.verifiedPaidCents >= input.totalCents;
  if (covered) {
    return { key: "payment", applicable: true, state: "completado", ratio: 1 };
  }
  const partial = input.totalCents === 0 ? 0 : clamp(input.verifiedPaidCents / input.totalCents);
  return {
    key: "payment",
    applicable: true,
    state: input.hasRejectedPayment ? "requiere_revision" : "en_proceso",
    ratio: Math.min(0.85, 0.35 + partial * 0.5),
  };
}

function invitationBlock(state: AssessInput["invitation"]): ProgressBlock {
  if (state === "not_needed") {
    return { key: "invitation", applicable: true, state: "no_aplica", ratio: 1 };
  }
  if (state === "delivered") {
    return { key: "invitation", applicable: true, state: "completado", ratio: 1 };
  }
  if (state === "rejected") {
    return { key: "invitation", applicable: true, state: "requiere_revision", ratio: 0.2 };
  }
  if (state === "pending" || state === "in_review") {
    return { key: "invitation", applicable: true, state: "en_proceso", ratio: 0.45 };
  }
  return { key: "invitation", applicable: true, state: "pendiente", ratio: 0 };
}

function waiverBlock(input: AssessInput): ProgressBlock {
  const marks = input.waiverStatuses;
  if (!input.waiverConfigured || marks.length === 0 || marks.every((mark) => mark === "sin_configuracion")) {
    return { key: "waiver", applicable: true, state: "pendiente", ratio: 0 };
  }
  const required = input.waiverRequiresBoth ? marks.length : 1;
  const signed = marks.filter((mark) => mark === "firmado").length;
  const rejected = marks.some((mark) => mark === "rechazado" || mark === "requiere_revision");
  const sent = marks.some((mark) => mark === "enviado");
  const done = signed >= required && required > 0;
  if (done) return { key: "waiver", applicable: true, state: "completado", ratio: 1 };
  return {
    key: "waiver",
    applicable: true,
    state: rejected ? "requiere_revision" : sent || signed > 0 ? "en_proceso" : "pendiente",
    ratio: rejected ? 0.2 : clamp(signed / required) * 0.7,
  };
}

function semaforoBlock(input: AssessInput): ProgressBlock {
  if (!input.semaforoReady || input.semaforoStatuses.length === 0) {
    return { key: "semaforo", applicable: true, state: "pendiente", ratio: 0 };
  }
  const done = input.semaforoStatuses.every(
    (status) => status === "enviado" || status === "verificado_externo",
  );
  if (done) return { key: "semaforo", applicable: true, state: "completado", ratio: 1 };
  const review = input.semaforoStatuses.some((status) => status === "requiere_revision");
  const started = input.semaforoStatuses.some((status) => status !== "pendiente");
  const finished = input.semaforoStatuses.filter(
    (status) => status === "enviado" || status === "verificado_externo",
  ).length;
  return {
    key: "semaforo",
    applicable: true,
    state: review ? "requiere_revision" : started ? "en_proceso" : "pendiente",
    ratio: clamp(finished / input.semaforoStatuses.length) * (review ? 0.4 : 0.7),
  };
}

export function formatPublicCode(year: number, sequence: number) {
  return `REM-${year}-${String(sequence).padStart(4, "0")}`;
}
