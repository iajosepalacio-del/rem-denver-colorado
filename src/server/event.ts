import {
  DEFAULT_JACKET_SIZES,
  DEFAULT_PACKING,
  DEFAULT_SHIRT_SIZES,
  EVENT_ID,
  OFFICIAL_SEMAFORO_URL,
  OFFICIAL_SITE,
  ORGANIZER_EMAIL,
  PACKAGES,
  type PackingItem,
} from "../lib/catalog";
import { sql } from "../lib/db";

export type EventConfig = {
  id: string;
  name: string;
  brand: string;
  slogan: string;
  subtitle: string;
  emotionalLine: string;
  city: string;
  region: string;
  country: string;
  startsOn: string;
  endsOn: string;
  eventYear: number;
  currency: string;
  priceCents: number;
  hotelPriceCents: number;
  priceConfigured: boolean;
  shirtSizes: string[];
  jacketSizes: string[];
  packingItems: PackingItem[];
  semaforoMode: "external" | "internal";
  semaforoExternalUrl: string;
  semaforoPerSpouse: boolean;
  semaforoGroupSize: number;
  waiverRequiresBoth: boolean;
  officialSite: string;
  organizerEmail: string;
  retentionMonths: number;
};

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function day(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

export function mapEvent(row: Record<string, unknown>): EventConfig {
  const packing = asJson<PackingItem[]>(row.packing_items, DEFAULT_PACKING);
  return {
    id: String(row.id),
    name: String(row.name),
    brand: String(row.brand),
    slogan: String(row.slogan),
    subtitle: String(row.subtitle),
    emotionalLine: String(row.emotional_line),
    city: String(row.city),
    region: String(row.region),
    country: String(row.country),
    startsOn: day(row.starts_on),
    endsOn: day(row.ends_on),
    eventYear: Number(row.event_year),
    currency: String(row.currency),
    priceCents: Number(row.price_cents),
    hotelPriceCents: Number(row.hotel_price_cents ?? PACKAGES.hotel.cents),
    priceConfigured: row.price_configured === true,
    shirtSizes: asJson<string[]>(row.shirt_sizes, DEFAULT_SHIRT_SIZES),
    jacketSizes: asJson<string[]>(row.jacket_sizes, DEFAULT_JACKET_SIZES),
    packingItems: packing.length ? packing : DEFAULT_PACKING,
    semaforoMode: row.semaforo_mode === "internal" ? "internal" : "external",
    semaforoExternalUrl: String(row.semaforo_external_url ?? ""),
    semaforoPerSpouse: row.semaforo_per_spouse !== false,
    semaforoGroupSize: Number(row.semaforo_group_size ?? 1),
    waiverRequiresBoth: row.waiver_requires_both !== false,
    officialSite: String(row.official_site),
    organizerEmail: String(row.organizer_email),
    retentionMonths: Number(row.retention_months ?? 24),
  };
}

export async function ensureEvent() {
  const existing = await sql("select id from events where id = $1", [EVENT_ID]);
  if (existing.length > 0) return;
  await sql(
    `insert into events (
      id, name, brand, slogan, subtitle, emotional_line, city, region, country,
      starts_on, ends_on, event_year, currency, price_cents, hotel_price_cents, price_configured,
      shirt_sizes, jacket_sizes, packing_items, semaforo_mode, semaforo_external_url,
      semaforo_per_spouse, semaforo_group_size, waiver_requires_both, official_site,
      organizer_email, retention_months
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, 'USD', $13, $14, true,
      $15::jsonb, $16::jsonb, $17::jsonb, 'external', $18,
      true, 1, true, $19, $20, 24
    )`,
    [
      EVENT_ID,
      "REM DENVER COLORADO 2027",
      "REM — Reto de Empoderamiento Matrimonial",
      "AMOR A PRUEBA DE HIELO",
      "PRIMER REM EN LA NIEVE",
      "Una experiencia para fortalecer nuestro matrimonio y vivir juntos un nuevo reto.",
      "Denver",
      "Colorado",
      "USA",
      "2027-01-23",
      "2027-01-24",
      2027,
      PACKAGES.general.cents,
      PACKAGES.hotel.cents,
      JSON.stringify(DEFAULT_SHIRT_SIZES),
      JSON.stringify(DEFAULT_JACKET_SIZES),
      JSON.stringify(DEFAULT_PACKING),
      OFFICIAL_SEMAFORO_URL,
      OFFICIAL_SITE,
      ORGANIZER_EMAIL,
    ],
  );
}

export async function getEvent() {
  await ensureEvent();
  const rows = await sql<Record<string, unknown>>("select * from events where id = $1", [EVENT_ID]);
  return mapEvent(rows[0]!);
}
