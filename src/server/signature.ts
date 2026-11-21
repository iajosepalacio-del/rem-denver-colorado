import { createHmac, timingSafeEqual } from "node:crypto";
import { httpsUrl } from "../lib/validators";

export function signatureConfigured() {
  return Boolean(
    process.env.SIGNATURE_PROVIDER_NAME &&
      process.env.SIGNATURE_API_KEY &&
      process.env.SIGNATURE_API_BASE &&
      httpsUrl(process.env.SIGNATURE_API_BASE),
  );
}

export function signatureProviderName() {
  return (process.env.SIGNATURE_PROVIDER_NAME ?? "").trim();
}

export async function createSignatureEnvelope(input: {
  coupleCode: string;
  version: string;
  name: string;
  email: string;
  role: string;
}) {
  if (!signatureConfigured()) return { ok: false as const, reason: "proveedor_no_configurado" };
  const base = httpsUrl(process.env.SIGNATURE_API_BASE ?? "");
  if (!base) return { ok: false as const, reason: "proveedor_no_configurado" };
  const response = await fetch(new URL("/envelopes", base), {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.SIGNATURE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      reference: input.coupleCode,
      version: input.version,
      signer: { name: input.name, email: input.email, role: input.role },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return { ok: false as const, reason: "proveedor_error" };
  const data = (await response.json()) as { id?: string; signingUrl?: string };
  if (!data.id) return { ok: false as const, reason: "proveedor_error" };
  return {
    ok: true as const,
    id: data.id.slice(0, 120),
    signingUrl: data.signingUrl ? httpsUrl(data.signingUrl) : null,
  };
}

export async function verifySignatureWebhook(request: Request) {
  const secret = process.env.SIGNATURE_WEBHOOK_SECRET ?? "";
  if (!secret) return null;
  const provided = request.headers.get("x-rem-signature") ?? "";
  const raw = await request.text();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(raw) as { envelopeId?: string; status?: string };
    if (!data.envelopeId || (data.status !== "signed" && data.status !== "rejected")) return null;
    return { envelopeId: data.envelopeId.slice(0, 120), status: data.status };
  } catch {
    return null;
  }
}
