import assert from "node:assert/strict";
import test from "node:test";
import { sniffFile } from "../src/lib/files.ts";
import { assess, balanceCents, formatPublicCode, sumVerified } from "../src/lib/progress.ts";
import type { AssessInput } from "../src/lib/progress.ts";

const base: AssessInput = {
  personalComplete: true,
  modality: "total",
  priceConfigured: true,
  totalCents: 100000,
  verifiedPaidCents: 100000,
  hasRejectedPayment: false,
  invitation: "not_needed",
  waiverConfigured: true,
  waiverRequiresBoth: true,
  waiverStatuses: ["firmado", "firmado"],
  semaforoReady: true,
  semaforoStatuses: ["enviado", "enviado"],
  packingAcks: 2,
  packingPeople: 2,
};

test("el porcentaje llega a 100 solo cuando todos los requisitos aplican", () => {
  const done = assess(base);
  assert.equal(done.percent, 100);
  assert.equal(done.status, "completado");
  assert.deepEqual(done.blocking, []);
});

test("una carta no requerida cuenta como no aplica y no bloquea", () => {
  const result = assess({ ...base, invitation: "not_needed", waiverStatuses: ["pendiente", "pendiente"], waiverConfigured: true });
  const invitation = result.blocks.find((block) => block.key === "invitation");
  assert.equal(invitation?.state, "no_aplica");
  assert.equal(invitation?.ratio, 1);
  assert.equal(result.status, "documentacion_pendiente");
  assert.ok(result.percent < 100);
});

test("un pago pendiente no reduce el saldo", () => {
  const paid = sumVerified([
    { amountCents: 40000, status: "verificado" },
    { amountCents: 60000, status: "pendiente" },
    { amountCents: 10000, status: "rechazado" },
  ]);
  assert.equal(paid, 40000);
  assert.equal(balanceCents(100000, paid), 60000);
});

test("sin precio oficial el pago no se da por completo", () => {
  const result = assess({ ...base, priceConfigured: false, verifiedPaidCents: 0 });
  assert.notEqual(result.status, "completado");
  assert.equal(result.blocks.find((block) => block.key === "payment")?.state, "en_proceso");
});

test("el codigo publico no es un uuid", () => {
  assert.equal(formatPublicCode(2027, 1), "REM-2027-0001");
});

test("rechaza archivos que no son pdf, jpg o png", () => {
  assert.equal(sniffFile(Buffer.from("<html></html>"), "carta.pdf"), null);
  assert.ok(sniffFile(Buffer.from("%PDF-1.4\n"), "carta.pdf"));
  assert.equal(sniffFile(Buffer.from("abc"), "carta.pdf"), null);
});
