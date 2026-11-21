import { createSign } from "node:crypto";
import { sql } from "../lib/db";
import { newId } from "../lib/secrets";
import { ORGANIZER_EMAIL } from "../lib/catalog";

type DriveMode = "oauth" | "service_account" | "off";

let tokenCache: { token: string; exp: number } | null = null;

export function driveMode(): DriveMode {
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    return "oauth";
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return "service_account";
  }
  return "off";
}

export function sheetsConfigured() {
  return driveMode() !== "off" && Boolean(process.env.GOOGLE_SHEETS_ID);
}

function privateKey() {
  return (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.token;
  const mode = driveMode();
  if (mode === "off") throw new Error("google_off");
  const body = new URLSearchParams();
  if (mode === "oauth") {
    body.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID ?? "");
    body.set("client_secret", process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "");
    body.set("refresh_token", process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "");
    body.set("grant_type", "refresh_token");
  } else {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: email,
        scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");
    const unsigned = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${signer.sign(privateKey()).toString("base64url")}`;
    body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
    body.set("assertion", assertion);
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`google_token_${response.status}`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("google_token_empty");
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3000) * 1000 };
  return data.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`https://www.googleapis.com${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) });
}

async function ensureFolder(path: string, name: string, parentId?: string) {
  const existing = await sql<{ drive_id: string }>("select drive_id from drive_folders where path = $1", [path]);
  if (existing[0]?.drive_id) return existing[0].drive_id;
  const query = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const found = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true`,
  );
  if (found.ok) {
    const data = (await found.json()) as { files?: { id: string }[] };
    const id = data.files?.[0]?.id;
    if (id) {
      await sql(
        `insert into drive_folders (path, drive_id) values ($1, $2) on conflict (path) do update set drive_id = excluded.drive_id, updated_at = now()`,
        [path, id],
      );
      return id;
    }
  }
  const created = await driveFetch("/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!created.ok) throw new Error(`google_folder_${created.status}`);
  const folder = (await created.json()) as { id?: string };
  if (!folder.id) throw new Error("google_folder_empty");
  await sql(
    `insert into drive_folders (path, drive_id) values ($1, $2) on conflict (path) do update set drive_id = excluded.drive_id, updated_at = now()`,
    [path, folder.id],
  );
  return folder.id;
}

async function rootFolder() {
  const preset = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (preset) return preset;
  const root = await ensureFolder("root", "REM DENVER COLORADO 2027");
  if (driveMode() === "service_account") {
    const shared = await sql("select path from drive_folders where path = 'root-shared'");
    if (!shared[0]) {
      const permission = await driveFetch(`/drive/v3/files/${root}/permissions?sendNotificationEmail=false&supportsAllDrives=true`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "user", role: "writer", emailAddress: ORGANIZER_EMAIL }),
      });
      if (permission.ok) {
        await sql(
          `insert into drive_folders (path, drive_id) values ('root-shared', $1) on conflict (path) do nothing`,
          [root],
        );
      }
    }
  }
  return root;
}

async function coupleFolder(code: string) {
  const root = await rootFolder();
  const registros = await ensureFolder("root/REGISTROS", "REGISTROS", root);
  await ensureFolder("root/DOCUMENTOS-OFICIALES", "DOCUMENTOS-OFICIALES", root);
  await ensureFolder("root/REPORTES", "REPORTES", root);
  await ensureFolder("root/PLANTILLAS", "PLANTILLAS", root);
  const couple = await ensureFolder(`root/REGISTROS/${code}`, code, registros);
  for (const name of ["comprobantes", "waiver", "invitacion", "semaforo", "confirmacion"]) {
    await ensureFolder(`root/REGISTROS/${code}/${name}`, name, couple);
  }
  return couple;
}

async function upload(input: {
  coupleId: string | null;
  localKind: string;
  localId: string;
  name: string;
  mime: string;
  bytes: Buffer;
  parentPath: string;
}) {
  const parent = await sql<{ drive_id: string }>("select drive_id from drive_folders where path = $1", [input.parentPath]);
  if (!parent[0]) throw new Error("google_parent_missing");
  const current = await sql<{ id: string; drive_file_id: string | null; attempts: number }>(
    "select id, drive_file_id, attempts from drive_files where local_kind = $1 and local_id = $2",
    [input.localKind, input.localId],
  );
  const rowId = current[0]?.id ?? newId();
  if (!current[0]) {
    await sql(
      `insert into drive_files (id, couple_id, local_kind, local_id, name, status, attempts) values ($1, $2, $3, $4, $5, 'pendiente', 0)`,
      [rowId, input.coupleId, input.localKind, input.localId, input.name],
    );
  }
  if ((current[0]?.attempts ?? 0) >= 5 && !current[0]?.drive_file_id) {
    return "error" as const;
  }
  const boundary = `rem${newId()}`;
  const meta = JSON.stringify({
    name: input.name,
    parents: current[0]?.drive_file_id ? undefined : [parent[0].drive_id],
  });
  const preamble = Buffer.from(
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${input.mime}\r\n\r\n`,
  );
  const ending = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, input.bytes, ending]);
  const target = current[0]?.drive_file_id
    ? `/upload/drive/v3/files/${current[0].drive_file_id}?uploadType=multipart&supportsAllDrives=true`
    : "/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";
  const response = await driveFetch(target, {
    method: current[0]?.drive_file_id ? "PATCH" : "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) {
    await sql(
      `update drive_files set status = 'error', attempts = attempts + 1, last_error = $2, updated_at = now() where id = $1`,
      [rowId, `google_${response.status}`],
    );
    return "error" as const;
  }
  const data = (await response.json()) as { id?: string };
  await sql(
    `update drive_files set status = 'sincronizado', drive_file_id = $2, name = $3, attempts = attempts + 1, last_error = '', updated_at = now() where id = $1`,
    [rowId, data.id ?? current[0]?.drive_file_id ?? "", input.name],
  );
  return "sincronizado" as const;
}

export async function syncCoupleSnapshot(input: {
  coupleId: string;
  code: string;
  json: string;
}) {
  if (driveMode() === "off") return "no_configurado" as const;
  try {
    await coupleFolder(input.code);
    const status = await upload({
      coupleId: input.coupleId,
      localKind: "snapshot",
      localId: input.coupleId,
      name: "datos-pareja.json",
      mime: "application/json",
      bytes: Buffer.from(input.json),
      parentPath: `root/REGISTROS/${input.code}`,
    });
    if (sheetsConfigured()) {
      await appendSheet(input).catch(() => undefined);
    }
    return status;
  } catch {
    await sql(
      `insert into drive_files (id, couple_id, local_kind, local_id, name, status, attempts, last_error)
       values ($1, $2, 'snapshot', $2, 'datos-pareja.json', 'error', 1, 'sincronizacion_fallida')
       on conflict (local_kind, local_id) do update set status = 'error', attempts = drive_files.attempts + 1, last_error = 'sincronizacion_fallida', updated_at = now()`,
      [newId(), input.coupleId],
    );
    return "error" as const;
  }
}

export async function syncBinary(input: {
  coupleId: string;
  code: string;
  localKind: string;
  localId: string;
  folder: "comprobantes" | "waiver" | "invitacion" | "semaforo" | "confirmacion";
  name: string;
  mime: string;
  bytes: Buffer;
}) {
  if (driveMode() === "off") return "no_configurado" as const;
  try {
    await coupleFolder(input.code);
    return await upload({
      coupleId: input.coupleId,
      localKind: input.localKind,
      localId: input.localId,
      name: input.name,
      mime: input.mime,
      bytes: input.bytes,
      parentPath: `root/REGISTROS/${input.code}/${input.folder}`,
    });
  } catch {
    return "error" as const;
  }
}

async function appendSheet(input: { code: string; json: string }) {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return;
  const token = await accessToken();
  const snapshot = JSON.parse(input.json) as { names?: string; city?: string; status?: string };
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("Indice!A:E")}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        values: [[input.code, snapshot.names ?? "", snapshot.city ?? "", snapshot.status ?? "", new Date().toISOString()]],
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
}

export async function retryPending(limit = 5) {
  if (driveMode() === "off") return 0;
  const rows = await sql<{ local_kind: string; local_id: string }>(
    `select local_kind, local_id from drive_files where status in ('pendiente', 'error') and attempts < 5 order by updated_at asc limit $1`,
    [limit],
  );
  return rows.length;
}
