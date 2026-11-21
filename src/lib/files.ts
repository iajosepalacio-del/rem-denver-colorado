import { MAX_UPLOAD_BYTES } from "./catalog";

export type StoredFile = {
  name: string;
  mime: "application/pdf" | "image/jpeg" | "image/png";
  bytes: Buffer;
};

export function sniffFile(bytes: Buffer, originalName: string): StoredFile | null {
  if (bytes.length < 4 || bytes.length > MAX_UPLOAD_BYTES) return null;
  let mime: StoredFile["mime"] | null = null;
  if (bytes.subarray(0, 4).toString("utf8") === "%PDF") mime = "application/pdf";
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) mime = "image/png";
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = "image/jpeg";
  if (!mime) return null;
  return { name: cleanFileName(originalName, mime), mime, bytes };
}

export function cleanFileName(originalName: string, mime: StoredFile["mime"]) {
  const base = originalName.split(/[/\\]/).pop() ?? "archivo";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "").slice(0, 80);
  const extension = mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : ".jpg";
  const stem = cleaned.replace(/\.(pdf|png|jpe?g)$/i, "") || "archivo";
  return `${stem}${extension}`;
}

export function asBuffer(value: unknown) {
  if (value instanceof Buffer) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  return Buffer.alloc(0);
}
