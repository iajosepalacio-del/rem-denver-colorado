import { z } from "zod";
import { CALLING_CODES, COUNTRIES, PAYMENT_METHODS } from "./catalog";

const phoneCode = z.string().regex(/^\+\d{1,4}$/);

export const spouseSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  shirtSize: z.string().trim().min(1).max(40),
  jacketSize: z.string().trim().min(1).max(40),
  phoneCountry: z.union([z.enum(CALLING_CODES as [string, ...string[]]), phoneCode]),
  phone: z.string().trim().regex(/^[0-9\s()-]{6,20}$/),
  email: z.email().max(160),
});

export const createRegistrationSchema = z
  .object({
    esposo: spouseSchema,
    esposa: spouseSchema,
    city: z.string().trim().min(2).max(80),
    region: z.string().trim().max(80).optional().default(""),
    country: z.string().trim().min(2).max(80),
    privacyAccepted: z.boolean().refine((value) => value),
    questionnaireConsent: z.boolean().refine((value) => value),
    locale: z.enum(["es", "en"]).default("es"),
  })
  .superRefine((value, ctx) => {
    if (value.esposo.email.toLowerCase() === value.esposa.email.toLowerCase()) {
      ctx.addIssue({ code: "custom", path: ["esposa", "email"], message: "distinto" });
    }
    if (!COUNTRIES.includes(value.country) && value.country.length < 2) {
      ctx.addIssue({ code: "custom", path: ["country"], message: "requerido" });
    }
  });

export const updatePersonalSchema = z
  .object({
    updatedAt: z.string().min(4),
    esposo: spouseSchema,
    esposa: spouseSchema,
    city: z.string().trim().min(2).max(80),
    region: z.string().trim().max(80).optional().default(""),
    country: z.string().trim().min(2).max(80),
  })
  .superRefine((value, ctx) => {
    if (value.esposo.email.toLowerCase() === value.esposa.email.toLowerCase()) {
      ctx.addIssue({ code: "custom", path: ["esposa", "email"], message: "distinto" });
    }
  });

export const accessSchema = z.object({
  code: z.string().trim().min(6).max(40),
  email: z.email().max(160),
  accessKey: z.string().trim().min(8).max(40),
});

export const modalitySchema = z.object({
  modality: z.enum(["total", "cuotas"]),
  claimPaidInFull: z.boolean(),
});

export const paymentSchema = z.object({
  amount: z.number().positive().max(1000000),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(400).optional().default(""),
});

export const invitationChoiceSchema = z.object({
  needed: z.boolean(),
});

export const packingToggleSchema = z.object({
  participantId: z.string().min(8).max(80),
  itemKey: z.string().min(2).max(40),
  checked: z.boolean(),
});

export const packingAckSchema = z.object({
  participantId: z.string().min(8).max(80),
  acknowledged: z.literal(true),
});

export const answerKeySchema = z.object({
  participantId: z.string().min(8).max(80),
  answerKey: z.string().trim().min(8).max(80),
});

export const saveAnswersSchema = z.object({
  participantId: z.string().min(8).max(80),
  answerKey: z.string().trim().min(8).max(80),
  answers: z.array(z.object({ questionId: z.string().min(4).max(80), answer: z.string().trim().min(1).max(2000) })).max(80),
  submit: z.boolean().default(false),
});

export const externalOpenSchema = z.object({
  participantId: z.string().min(8).max(80),
});

export const adminLoginSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(12).max(200),
});

export const adminBootstrapSchema = z.object({
  token: z.string().max(200).optional().default(""),
  email: z.email().max(160),
  name: z.string().trim().min(3).max(120),
  password: z.string().min(12).max(200).regex(/[A-Za-z]/).regex(/[0-9]/),
  role: z.enum(["owner"]).default("owner"),
});

export const eventConfigSchema = z.object({
  slogan: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().min(3).max(120),
  emotionalLine: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventYear: z.number().int().min(2024).max(2100),
  currency: z.string().trim().length(3),
  price: z.number().min(0).max(1000000),
  priceConfigured: z.boolean(),
  shirtSizes: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
  jacketSizes: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
  semaforoMode: z.enum(["external", "internal"]),
  semaforoExternalUrl: z.string().trim().max(300),
  semaforoPerSpouse: z.boolean(),
  semaforoGroupSize: z.number().int().min(1).max(10),
  waiverRequiresBoth: z.boolean(),
  retentionMonths: z.number().int().min(1).max(120),
});

export const questionnaireFileSchema = z.object({
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(3).max(160),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(5).max(500),
        help: z.string().trim().max(300).optional().default(""),
        required: z.boolean().optional().default(true),
      }),
    )
    .min(1)
    .max(80),
});

export const adminCouplePatchSchema = z.object({
  city: z.string().trim().min(2).max(80).optional(),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  priceOverride: z.number().min(0).max(1000000).nullable().optional(),
  adminNotes: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
  esposo: spouseSchema.optional(),
  esposa: spouseSchema.optional(),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().min(8).max(80),
  decision: z.enum(["verificado", "rechazado"]),
  note: z.string().trim().max(400).optional().default(""),
});

export const invitationReviewSchema = z.object({
  status: z.enum(["en_revision", "aprobada", "entregada", "rechazada"]),
  note: z.string().trim().max(500).optional().default(""),
});

export const signatureRecordSchema = z.object({
  participantId: z.string().min(8).max(80),
  providerRef: z.string().trim().min(3).max(120),
  decision: z.enum(["firmado", "rechazado"]),
  note: z.string().trim().max(400).optional().default(""),
});

export const newAdminSchema = z.object({
  email: z.email().max(160),
  name: z.string().trim().min(3).max(120),
  password: z.string().min(12).max(200).regex(/[A-Za-z]/).regex(/[0-9]/),
  role: z.enum(["owner", "payments", "documents", "questionnaire", "viewer"]),
});

export function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
