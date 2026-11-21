export function formatMoney(cents: number, currency: string, locale: "es" | "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatEventRange(start: string, end: string, locale: "es" | "en") {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const month = startDate
    .toLocaleDateString(locale === "en" ? "en-US" : "es-CO", { month: "long", timeZone: "UTC" })
    .toLocaleUpperCase(locale === "en" ? "en-US" : "es-CO");
  if (
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth()
  ) {
    return `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${month} ${startDate.getUTCFullYear()}`;
  }
  return `${start} – ${end}`;
}

export function formatWhen(value: string | null, locale: "es" | "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleString(locale === "en" ? "en-US" : "es-CO", {
    dateStyle: "medium",
    timeStyle: value.length > 10 ? "short" : undefined,
    timeZone: "America/Bogota",
  });
}

export function likePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
