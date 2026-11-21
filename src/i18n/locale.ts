import { cookies } from "next/headers";
import type { Locale } from "./messages";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("rem_lang")?.value === "en" ? "en" : "es";
}
