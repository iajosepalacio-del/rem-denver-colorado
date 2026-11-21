import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const ACCESS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newId() {
  return randomBytes(16).toString("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newAccessKey() {
  const bytes = randomBytes(10);
  let raw = "";
  for (let index = 0; index < bytes.length; index += 1) {
    raw += ACCESS_ALPHABET[bytes[index]! % ACCESS_ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(secret, salt, 32)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifySecret(secret: string, stored: string) {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const derived = (await scryptAsync(secret, salt, 32)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
