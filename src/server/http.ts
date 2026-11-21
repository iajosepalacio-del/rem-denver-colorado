import { sha256 } from "../lib/secrets";
import { sql } from "../lib/db";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export function fail(status: number, code: string, extra?: Record<string, unknown>) {
  return json({ error: code, ...extra }, status);
}

export function failureCode(value: object): string | null {
  if (!("error" in value)) return null;
  const code = (value as { error?: unknown }).error;
  return typeof code === "string" ? code : null;
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "local").slice(0, 80);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function cookieHeader(name: string, token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookie(name: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

export async function limit(request: Request, action: string, max: number, windowSeconds: number) {
  const bucket = `${action}:${sha256(clientIp(request)).slice(0, 24)}`;
  const rows = await sql<{ hits: number }>(
    `insert into rate_limits (bucket, hits, window_start) values ($1, 1, now())
     on conflict (bucket) do update set
       hits = case
         when rate_limits.window_start < now() - ($2::int * interval '1 second') then 1
         else rate_limits.hits + 1
       end,
       window_start = case
         when rate_limits.window_start < now() - ($2::int * interval '1 second') then now()
         else rate_limits.window_start
       end
     returning hits`,
    [bucket, windowSeconds],
  );
  return Number(rows[0]?.hits ?? 1) <= max;
}

export async function readJson(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 200_000) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };

export function guard(handler: (request: Request, context: RouteContext) => Promise<Response>) {
  return async (request: Request, context: RouteContext) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) {
        return fail(403, "origen");
      }
      return await handler(request, context);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(error);
      else console.error("request_failed");
      return fail(500, "error");
    }
  };
}

export function attachment(bytes: Buffer, mime: string, filename: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
