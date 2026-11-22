import { persistenceMode } from "@/lib/db";
import { driveMode } from "@/server/drive";
import { mailConfigured } from "@/server/mail";
import { json } from "@/server/http";
import { ready } from "@/server/ready";
import { signatureConfigured, signatureProviderName } from "@/server/signature";

export async function GET() {
  await ready();
  return json({
    ok: true,
    database: persistenceMode(),
    mail: mailConfigured(),
    drive: driveMode() !== "off",
    signatureApi: signatureConfigured(),
    signatureProvider: Boolean(signatureProviderName()),
  });
}
