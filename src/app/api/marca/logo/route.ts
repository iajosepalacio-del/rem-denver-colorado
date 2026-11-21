import { logoFile } from "@/server/admin-data";
import { fail } from "@/server/http";
import { ready } from "@/server/ready";

export async function GET() {
  await ready();
  const file = await logoFile();
  if (!file) return fail(404, "no_encontrado");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.mime,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
