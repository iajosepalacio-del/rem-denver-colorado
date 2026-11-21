import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CoupleView } from "../lib/types";
import type { EventConfig } from "./event";

function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function constanciaPdf(view: CoupleView, event: EventConfig, locale: "es" | "en") {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const confirmed = view.status === "completado";
  page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: rgb(0.027, 0.231, 0.412) });
  page.drawText("REM DENVER COLORADO 2027", { x: 48, y: 800, size: 16, font: bold, color: rgb(0.97, 0.99, 1) });
  page.drawText(confirmed ? "CONSTANCIA CONFIRMADA" : "CONSTANCIA PENDIENTE", {
    x: 48,
    y: 776,
    size: 14,
    font: bold,
    color: rgb(1, 0.85, 0.9),
  });
  const lines = [
    `Codigo: ${view.code}`,
    `Evento: ${event.startsOn} a ${event.endsOn} · ${event.city}, ${event.region}, ${event.country}`,
    `Esposo: ${view.spouses.esposo.fullName}`,
    `Esposa: ${view.spouses.esposa.fullName}`,
    `Origen: ${view.city}${view.region ? `, ${view.region}` : ""}, ${view.country}`,
    `Tallas esposo: camiseta ${view.spouses.esposo.shirtSize} / chaqueta ${view.spouses.esposo.jacketSize}`,
    `Tallas esposa: camiseta ${view.spouses.esposa.shirtSize} / chaqueta ${view.spouses.esposa.jacketSize}`,
    `Estado financiero: ${view.finance.priceConfigured ? `${view.finance.currency} pagado ${view.finance.paidCents / 100} / saldo ${((view.finance.balanceCents ?? 0) / 100).toFixed(2)}` : "Precio oficial pendiente de configuracion"}`,
    `Modalidad: ${view.finance.modality || "sin definir"}`,
    `Carta de invitacion: ${view.invitation.status}`,
    `Waiver esposo: ${view.waiver.spouses.esposo.status}`,
    `Waiver esposa: ${view.waiver.spouses.esposa.status}`,
    `SEMÁFORO esposo: ${view.spouses.esposo.semaforoStatus}`,
    `SEMÁFORO esposa: ${view.spouses.esposa.semaforoStatus}`,
    `Maleta: esposo ${view.spouses.esposo.packingAck ? "revisada" : "pendiente"} / esposa ${view.spouses.esposa.packingAck ? "revisada" : "pendiente"}`,
    `Progreso: ${view.progress.percent}%`,
    `Estado: ${view.status}`,
    "",
    locale === "en"
      ? "This certificate is not an immigration document and does not include questionnaire answers."
      : "Esta constancia no es un documento migratorio y no incluye respuestas del cuestionario.",
    locale === "en"
      ? "A pending certificate means the registration is not fully verified."
      : "Si dice PENDIENTE, el registro todavia no esta verificado por completo.",
  ];
  let y = 720;
  for (const line of lines) {
    page.drawText(ascii(line).slice(0, 110), { x: 48, y, size: 11, font, color: rgb(0.03, 0.15, 0.28) });
    y -= 22;
  }
  return Buffer.from(await pdf.save());
}

export async function packingPdf(view: CoupleView, locale: "es" | "en") {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText(ascii(locale === "en" ? "Winter packing list" : "Prepara tu maleta para el reto"), {
    x: 48,
    y: 800,
    size: 16,
    font: bold,
    color: rgb(0.027, 0.231, 0.412),
  });
  page.drawText(ascii(`${view.code} · ${view.spouses.esposo.fullName} / ${view.spouses.esposa.fullName}`), {
    x: 48,
    y: 776,
    size: 11,
    font,
    color: rgb(0.1, 0.2, 0.35),
  });
  let y = 746;
  for (const item of view.packing.items) {
    if (y < 48) break;
    const husband = view.packing.checks[view.spouses.esposo.id]?.includes(item.key) ? "x" : " ";
    const wife = view.packing.checks[view.spouses.esposa.id]?.includes(item.key) ? "x" : " ";
    page.drawText(ascii(`[${husband}] [${wife}] ${item.label}`).slice(0, 95), {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.05, 0.16, 0.28),
    });
    y -= 18;
  }
  page.drawText(
    ascii(
      locale === "en"
        ? "Check weather, activities and travel rules before departure. Not every item is required."
        : "Verifiquen el clima, las actividades y los requisitos de viaje. No todos los articulos son obligatorios.",
    ),
    { x: 48, y: 36, size: 9, font, color: rgb(0.15, 0.25, 0.35) },
  );
  return Buffer.from(await pdf.save());
}
