import { MAX_UPLOAD_BYTES } from "../lib/catalog";
import { sniffFile } from "../lib/files";
import { allows, adminFromRequest, coupleIdFromRequest } from "./auth";
import { fail } from "./http";
import { ready } from "./ready";
import type { AdminSession } from "../lib/types";

export async function requireCouple(request: Request) {
  await ready();
  return coupleIdFromRequest(request);
}

export async function requireAdmin(request: Request, action: string): Promise<{ admin: AdminSession } | { error: Response }> {
  await ready();
  const admin = await adminFromRequest(request);
  if (!admin) return { error: fail(401, "no_autorizado") };
  if (!allows(admin.role, action)) return { error: fail(403, "prohibido") };
  return { admin };
}

export function isAdminError(result: { admin: AdminSession } | { error: Response }): result is { error: Response } {
  return "error" in result;
}

export async function readUpload(request: Request, pdfOnly = false) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_UPLOAD_BYTES + 100_000) return { ok: false as const, error: "archivo" as const };
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "archivo" as const };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false as const, error: "archivo" as const };
  const sniffed = sniffFile(Buffer.from(await file.arrayBuffer()), file.name);
  if (!sniffed) return { ok: false as const, error: "archivo" as const };
  if (pdfOnly && sniffed.mime !== "application/pdf") return { ok: false as const, error: "archivo" as const };
  return { ok: true as const, form, file: sniffed };
}
