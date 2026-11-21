import { cookies } from "next/headers";
import { sql } from "../lib/db";
import { hashSecret, newId, newToken, safeEqual, sha256, verifySecret } from "../lib/secrets";
import type { AdminSession } from "../lib/types";

const COUPLE_COOKIE = "rem_couple";
const ADMIN_COOKIE = "rem_admin";

export function coupleCookieName() {
  return COUPLE_COOKIE;
}

export function adminCookieName() {
  return ADMIN_COOKIE;
}

export function tokenFrom(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const piece = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!piece) return undefined;
  return decodeURIComponent(piece.slice(name.length + 1));
}

export async function openSession(kind: "couple" | "admin", subjectId: string, hours: number) {
  const token = newToken();
  await sql(
    `insert into sessions (id, token_hash, kind, subject_id, expires_at) values ($1, $2, $3, $4, now() + ($5::int * interval '1 hour'))`,
    [newId(), sha256(token), kind, subjectId, hours],
  );
  return token;
}

export async function subjectFromToken(kind: "couple" | "admin", token: string | undefined) {
  if (!token) return null;
  const rows = await sql<{ subject_id: string }>(
    `select subject_id from sessions where token_hash = $1 and kind = $2 and expires_at > now()`,
    [sha256(token), kind],
  );
  return rows[0]?.subject_id ?? null;
}

export async function coupleIdFromRequest(request: Request) {
  return subjectFromToken("couple", tokenFrom(request, COUPLE_COOKIE));
}

export async function adminFromRequest(request: Request): Promise<AdminSession | null> {
  const id = await subjectFromToken("admin", tokenFrom(request, ADMIN_COOKIE));
  if (!id) return null;
  return loadAdmin(id);
}

export async function adminFromCookies(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  const id = await subjectFromToken("admin", token);
  if (!id) return null;
  return loadAdmin(id);
}

export async function coupleIdFromCookies() {
  const store = await cookies();
  return subjectFromToken("couple", store.get(COUPLE_COOKIE)?.value);
}

async function loadAdmin(id: string): Promise<AdminSession | null> {
  const rows = await sql<{ id: string; email: string; name: string; role: AdminSession["role"]; active: boolean }>(
    `select id, email, name, role, active from administrators where id = $1`,
    [id],
  );
  const admin = rows[0];
  if (!admin || admin.active === false) return null;
  return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
}

export async function closeSession(kind: "couple" | "admin", token: string | undefined) {
  if (!token) return;
  await sql(`delete from sessions where token_hash = $1 and kind = $2`, [sha256(token), kind]);
}

export function allows(role: AdminSession["role"], action: string) {
  const map: Record<AdminSession["role"], string[]> = {
    owner: ["read", "finance", "documents", "questionnaire", "sensitive", "config", "admins", "audit", "outbox"],
    payments: ["read", "finance"],
    documents: ["read", "documents"],
    questionnaire: ["read", "questionnaire", "sensitive"],
    viewer: ["read"],
  };
  return map[role].includes(action);
}

export function localBootstrapAllowed(request: Request) {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.DATABASE_URL) return false;
  const host = request.headers.get("host") ?? "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}

export async function createAdministrator(input: {
  email: string;
  name: string;
  password: string;
  role: AdminSession["role"];
}) {
  const id = newId();
  await sql(
    `insert into administrators (id, email, name, password_hash, role) values ($1, $2, $3, $4, $5)`,
    [id, input.email.toLowerCase(), input.name, await hashSecret(input.password), input.role],
  );
  return id;
}

export async function authenticateAdmin(email: string, password: string) {
  const rows = await sql<{ id: string; password_hash: string; active: boolean }>(
    `select id, password_hash, active from administrators where email = $1`,
    [email.toLowerCase()],
  );
  const admin = rows[0];
  if (!admin || !admin.active) return null;
  const ok = await verifySecret(password, admin.password_hash);
  if (!ok) return null;
  return admin.id;
}

export async function administratorCount() {
  const rows = await sql<{ n: number }>("select count(*)::int as n from administrators");
  return Number(rows[0]?.n ?? 0);
}

export function bootstrapTokenOk(request: Request, token: string) {
  const configured = process.env.ADMIN_BOOTSTRAP_TOKEN ?? "";
  if (configured) return safeEqual(configured, token);
  return localBootstrapAllowed(request);
}
