import { readFile } from "node:fs/promises";
import { EVENT_ID, WAIVER_EXAMPLE_FILE_NAME, WAIVER_EXAMPLE_PATH, WAIVER_EXAMPLE_VERSION } from "../lib/catalog";
import { sql } from "../lib/db";
import { newId } from "../lib/secrets";

export async function ensureWaiverExample() {
  const existing = await sql(
    `select id from document_templates where event_id = $1 and kind = 'waiver' and active = true limit 1`,
    [EVENT_ID],
  );
  if (existing[0]) return;
  let bytes: Buffer;
  try {
    bytes = await readFile(WAIVER_EXAMPLE_PATH);
  } catch {
    return;
  }
  const id = newId();
  await sql(
    `insert into document_templates (id, event_id, kind, version, file_name, mime, size_bytes, content, active)
     values ($1, $2, 'waiver', $3, $4, 'application/pdf', $5, $6, true)`,
    [id, EVENT_ID, WAIVER_EXAMPLE_VERSION, WAIVER_EXAMPLE_FILE_NAME, bytes.length, bytes],
  );
  await sql(
    `update document_signatures
     set template_id = $1,
         version = $2,
         status = case when status = 'firmado' then status else 'pendiente' end,
         updated_at = now()
     where template_id is null`,
    [id, WAIVER_EXAMPLE_VERSION],
  );
}
