import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { shouldEmbedCertificateQr } from "../lib/progress";
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
  const includeQr = shouldEmbedCertificateQr(view.progress.percent, view.status);
  page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: rgb(0.027, 0.231, 0.412) });
  page.drawText("REM DENVER COLORADO 2027", { x: 48, y: 800, size: 16, font: bold, color: rgb(0.97, 0.99, 1) });
  page.drawText(confirmed ? "CONSTANCIA CONFIRMADA" : "CONSTANCIA PENDIENTE", {
    x: 48,
    y: 776,
    size: 14,
    font: bold,
    color: rgb(1, 0.85, 0.9),
  });
  const packageLabel =
    view.finance.packageKind === "hotel"
      ? "PAQUETE CON HOTEL"
      : view.finance.packageKind === "general"
        ? "TARIFA GENERAL"
        : "sin paquete";
  const lines = [
    `Codigo: ${view.code}`,
    `Evento: ${event.startsOn} a ${event.endsOn} · ${event.city}, ${event.region}, ${event.country}`,
    `Esposo: ${view.spouses.esposo.fullName}`,
    `Esposa: ${view.spouses.esposa.fullName}`,
    `Origen: ${view.city}${view.region ? `, ${view.region}` : ""}, ${view.country}`,
    `Tallas esposo: camiseta ${view.spouses.esposo.shirtSize} / chaqueta ${view.spouses.esposo.jacketSize}`,
    `Tallas esposa: camiseta ${view.spouses.esposa.shirtSize} / chaqueta ${view.spouses.esposa.jacketSize}`,
    `Paquete: ${packageLabel}`,
    `Estado financiero: ${view.finance.priceConfigured && view.finance.balanceCents != null ? `${view.finance.currency} pagado ${view.finance.paidCents / 100} / saldo ${((view.finance.balanceCents ?? 0) / 100).toFixed(2)}` : "Paquete o precio pendiente"}`,
    `Modalidad: ${view.finance.modality || "sin definir"}`,
    `Carta de invitacion: ${view.invitation.status}`,
    `Waiver esposo: ${view.waiver.spouses.esposo.status}`,
    `Waiver esposa: ${view.waiver.spouses.esposa.status}`,
    `SEMÁFORO esposo: ${view.spouses.esposo.semaforoStatus}`,
    `SEMÁFORO esposa: ${view.spouses.esposa.semaforoStatus}`,
    `Maleta (solo esposa, obligatorio): ${view.spouses.esposa.packingAck ? "revisada" : "pendiente"}`,
    `Progreso: ${view.progress.percent}%`,
    `Estado: ${view.status}`,
    "",
    locale === "en"
      ? "This certificate is not an immigration document and does not include questionnaire answers."
      : "Esta constancia no es un documento migratorio y no incluye respuestas del cuestionario.",
    locale === "en"
      ? includeQr
        ? "QR included because registration is 100% complete."
        : "No QR: the registration is not 100% complete."
      : includeQr
        ? "El codigo QR aparece porque el registro esta al 100%."
        : "Sin codigo QR: el registro no termino al 100%.",
  ];
  let y = 720;
  for (const line of lines) {
    page.drawText(ascii(line).slice(0, 90), { x: 48, y, size: 11, font, color: rgb(0.03, 0.15, 0.28) });
    y -= 22;
  }
  if (includeQr) {
    const png = await QRCode.toBuffer(
      `REM DENVER COLORADO 2027\n${view.code}\nCONSTANCIA CONFIRMADA\n100%`,
      { type: "png", width: 280, margin: 1, errorCorrectionLevel: "M" },
    );
    const image = await pdf.embedPng(png);
    page.drawImage(image, { x: 420, y: 680, width: 130, height: 130 });
    page.drawText(ascii(view.code), { x: 428, y: 662, size: 8, font, color: rgb(0.03, 0.15, 0.28) });
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
  page.drawText(
    ascii(
      locale === "en"
        ? "NOTE: Only the wife prepares the bags. Required."
        : "NOTA: Las maletas las debe preparar solo la Esposa. *Obligatorio.",
    ),
    { x: 48, y: 776, size: 11, font: bold, color: rgb(0.62, 0.07, 0.22) },
  );
  page.drawText(ascii(`${view.code} · ${view.spouses.esposa.fullName}`), {
    x: 48,
    y: 754,
    size: 11,
    font,
    color: rgb(0.1, 0.2, 0.35),
  });
  let y = 726;
  for (const item of view.packing.items) {
    if (y < 64) break;
    const wife = view.packing.checks[view.spouses.esposa.id]?.includes(item.key) ? "x" : " ";
    page.drawText(ascii(`[${wife}] ${item.label}`).slice(0, 95), {
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

export async function stampWaiverExample(
  source: Buffer,
  input: {
    signedName: string;
    printedName: string;
    signedOn: string;
    coupleCode: string;
    role: string;
    participantName: string;
  },
) {
  const pdf = await PDFDocument.load(source);
  const page = pdf.getPages()[0];
  if (!page) return source;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  page.drawRectangle({
    x: 36,
    y: 748,
    width: width - 72,
    height: 28,
    color: rgb(1, 0.96, 0.78),
  });
  page.drawText(ascii("EJEMPLO PROVISIONAL — Shipping Waiver (2).pdf  ·  Name Signature / Name Print / Date"), {
    x: 44,
    y: 758,
    size: 8,
    font: bold,
    color: rgb(0.35, 0.2, 0.05),
  });
  page.drawRectangle({ x: 48, y: 42, width: width - 96, height: 92, color: rgb(1, 1, 1) });
  page.drawText("Name Signature", { x: 56, y: 112, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(ascii(input.signedName).slice(0, 48), {
    x: 160,
    y: 110,
    size: 14,
    font: italic,
    color: rgb(0.05, 0.12, 0.28),
  });
  page.drawLine({ start: { x: 156, y: 106 }, end: { x: width - 64, y: 106 }, thickness: 0.7, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Name Print", { x: 56, y: 84, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(ascii(input.printedName).slice(0, 48), {
    x: 160,
    y: 82,
    size: 12,
    font,
    color: rgb(0.05, 0.12, 0.28),
  });
  page.drawLine({ start: { x: 156, y: 78 }, end: { x: width - 64, y: 78 }, thickness: 0.7, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Date", { x: 56, y: 56, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(input.signedOn, { x: 160, y: 54, size: 12, font, color: rgb(0.05, 0.12, 0.28) });
  page.drawLine({ start: { x: 156, y: 50 }, end: { x: 280, y: 50 }, thickness: 0.7, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(
    ascii(`${input.coupleCode} · ${input.role} · ${input.participantName} · no es firma notarial`).slice(0, 95),
    { x: 56, y: 32, size: 7, font, color: rgb(0.35, 0.35, 0.35) },
  );
  return Buffer.from(await pdf.save());
}
