import { applySignatureWebhook } from "@/server/couples";
import { fail, json } from "@/server/http";
import { ready } from "@/server/ready";
import { verifySignatureWebhook } from "@/server/signature";

export async function POST(request: Request) {
  try {
    await ready();
    const event = await verifySignatureWebhook(request);
    if (!event) return fail(401, "no_autorizado");
    const updated = await applySignatureWebhook(event.envelopeId, event.status === "signed" ? "signed" : "rejected");
    if (!updated) return fail(404, "no_encontrado");
    return json({ ok: true });
  } catch {
    return fail(500, "error");
  }
}
