import nodemailer from "nodemailer";
import { sql } from "../lib/db";
import { newId } from "../lib/secrets";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function deliverEmail(input: {
  to: string[];
  subject: string;
  text: string;
  coupleId?: string;
}) {
  const recipients = [...new Set(input.to.map((email) => email.toLowerCase()))];
  const results: { id: string; to: string; status: string }[] = [];
  for (const to of recipients) {
    const id = newId();
    await sql(
      `insert into email_outbox (id, couple_id, to_email, subject, body, status) values ($1, $2, $3, $4, $5, 'pendiente')`,
      [id, input.coupleId ?? null, to, input.subject, input.text],
    );
    if (!mailConfigured()) {
      await sql(`update email_outbox set status = 'pendiente_configuracion' where id = $1`, [id]);
      results.push({ id, to, status: "pendiente_configuracion" });
      continue;
    }
    try {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: input.subject,
        text: input.text,
      });
      await sql(`update email_outbox set status = 'enviado', sent_at = now() where id = $1`, [id]);
      results.push({ id, to, status: "enviado" });
    } catch {
      await sql(`update email_outbox set status = 'error', last_error = 'envio_fallido' where id = $1`, [id]);
      results.push({ id, to, status: "error" });
    }
  }
  return results;
}

export function accessMessage(locale: "es" | "en", code: string, accessKey: string) {
  if (locale === "en") {
    return {
      subject: `REM Denver Colorado 2027 — access for ${code}`,
      text: [
        "REM Denver Colorado 2027",
        "",
        `We saved registration ${code}.`,
        `Access key: ${accessKey}`,
        "",
        "Use this key with either spouse's email to continue the registration.",
        "Do not forward this message.",
        "",
        "This message does not mean the registration is complete.",
        "It does not include questionnaire answers.",
      ].join("\n"),
    };
  }
  return {
    subject: `REM Denver Colorado 2027 — acceso de ${code}`,
    text: [
      "REM Denver Colorado 2027",
      "",
      `Guardamos la inscripción ${code}.`,
      `Clave de acceso: ${accessKey}`,
      "",
      "Usa esta clave con el correo de cualquiera de los dos cónyuges para continuar.",
      "No reenvíes este mensaje.",
      "",
      "Este mensaje no significa que el registro esté completo.",
      "No incluye respuestas del cuestionario.",
    ].join("\n"),
  };
}

export function completionMessage(locale: "es" | "en", code: string, husband: string, wife: string) {
  if (locale === "en") {
    return {
      subject: `REM Denver Colorado 2027 — registration complete ${code}`,
      text: [
        "REM Denver Colorado 2027",
        "",
        `Registration ${code} is complete and verified.`,
        `Spouses: ${husband} and ${wife}.`,
        "",
        "Sign in to download the certificate.",
        "This message does not include questionnaire answers and is not an immigration document.",
      ].join("\n"),
    };
  }
  return {
    subject: `REM Denver Colorado 2027 — registro completo ${code}`,
    text: [
      "REM Denver Colorado 2027",
      "",
      `La inscripción ${code} quedó completa y verificada.`,
      `Cónyuges: ${husband} y ${wife}.`,
      "",
      "Entren de nuevo para descargar la constancia.",
      "Este mensaje no incluye respuestas del cuestionario y no es un documento migratorio.",
    ].join("\n"),
  };
}
