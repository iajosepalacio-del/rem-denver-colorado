import type { ProgressResult } from "./progress";

export type SpouseRole = "esposo" | "esposa";

export type SpouseView = {
  id: string;
  role: SpouseRole;
  fullName: string;
  shirtSize: string;
  jacketSize: string;
  phoneCountry: string;
  phone: string;
  email: string;
  semaforoStatus: string;
  semaforoAnswered: number;
  semaforoTotal: number;
  packingAck: boolean;
  packingChecked: number;
  waiverStatus: string;
};

export type PaymentView = {
  id: string;
  amountCents: number;
  currency: string;
  method: string;
  paidOn: string | null;
  status: "pendiente" | "verificado" | "rechazado";
  note: string;
  hasReceipt: boolean;
  receiptName: string | null;
  createdAt: string;
};

export type CoupleView = {
  code: string;
  isDemo: boolean;
  city: string;
  region: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  status: ProgressResult["status"];
  progress: ProgressResult;
  spouses: Record<SpouseRole, SpouseView>;
  finance: {
    currency: string;
    priceConfigured: boolean;
    totalCents: number;
    modality: "" | "total" | "cuotas";
    claimPaidInFull: boolean;
    paidCents: number;
    balanceCents: number | null;
    lastPaymentOn: string | null;
    adminNotes: string;
    payments: PaymentView[];
  };
  invitation: {
    answered: boolean;
    needed: boolean | null;
    status: string;
    deliveredAt: string | null;
    fileName: string | null;
    reviewerNote: string;
  };
  waiver: {
    configured: boolean;
    version: string | null;
    fileName: string | null;
    requiresBoth: boolean;
    providerConfigured: boolean;
    providerName: string;
    spouses: Record<SpouseRole, { status: string; providerRef: string; version: string; signedName: string | null }>;
  };
  semaforo: {
    mode: "external" | "internal";
    externalUrl: string;
    questionsLoaded: boolean;
    version: string | null;
    title: string | null;
    perSpouse: boolean;
    groupSize: number;
    questionCount: number;
  };
  packing: {
    items: { key: string; group: string; label: string }[];
    checks: Record<string, string[]>;
  };
  integrations: {
    mail: boolean;
    drive: "no_configurado" | "sincronizado" | "pendiente" | "error";
  };
  deletionRequested: boolean;
};

export type AdminSession = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "payments" | "documents" | "questionnaire" | "viewer";
};
