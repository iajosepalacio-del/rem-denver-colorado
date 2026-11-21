import { mkdir, writeFile } from "node:fs/promises";
import { sql } from "../lib/db";
import { newAccessKey } from "../lib/secrets";
import { createCouple } from "./couples";

export async function ensureDemo() {
  if (process.env.SEED_DEMO !== "1") return;
  if (process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV === "production") return;
  const existing = await sql("select id from couples where is_demo = true limit 1");
  if (existing.length > 0) return;
  const keys = [newAccessKey(), newAccessKey(), newAccessKey()];
  const created = [];
  created.push(
    await createCouple({
      demo: true,
      accessKey: keys[0],
      locale: "es",
      city: "Bogotá",
      region: "Cundinamarca",
      country: "Colombia",
      esposo: spouse("Luis Ejemplo Ficticio", "ficticio.luis@example.com", "+57", "3000000001", "M", "L"),
      esposa: spouse("Ana Ejemplo Ficticio", "ficticio.ana@example.com", "+57", "3000000002", "S", "M"),
    }),
  );
  created.push(
    await createCouple({
      demo: true,
      accessKey: keys[1],
      locale: "es",
      city: "Medellín",
      region: "Antioquia",
      country: "Colombia",
      esposo: spouse("Jorge Prueba Ficticio", "ficticio.jorge@example.com", "+57", "3000000003", "L", "L"),
      esposa: spouse("Marta Prueba Ficticio", "ficticio.marta@example.com", "+57", "3000000004", "M", "M"),
    }),
  );
  created.push(
    await createCouple({
      demo: true,
      accessKey: keys[2],
      locale: "es",
      city: "Ciudad de México",
      region: "Ciudad de México",
      country: "México",
      esposo: spouse("Diego Demostración Ficticio", "ficticio.diego@example.com", "+52", "5500000001", "XL", "XL"),
      esposa: spouse("Clara Demostración Ficticio", "ficticio.clara@example.com", "+52", "5500000002", "S", "S"),
    }),
  );
  await mkdir(".data", { recursive: true });
  const lines = [
    "DATOS FICTICIOS LOCALES. No son participantes reales.",
    ...created.map((item, index) => {
      if ("error" in item) return `error ${index}`;
      return `${item.code} ${keys[index]}`;
    }),
  ];
  await writeFile(".data/demo-credentials.txt", `${lines.join("\n")}\n`, { mode: 0o600 });
}

function spouse(fullName: string, email: string, phoneCountry: string, phone: string, shirtSize: string, jacketSize: string) {
  return { fullName, email, phoneCountry, phone, shirtSize, jacketSize };
}
