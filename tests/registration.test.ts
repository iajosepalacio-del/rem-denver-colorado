import assert from "node:assert/strict";
import test from "node:test";

process.env.PGLITE_DIR = ":memory:";
process.env.DATABASE_URL = "";
process.env.SEED_DEMO = "0";
process.env.NODE_ENV = "test";

async function load() {
  const ready = await import("../src/server/ready.ts");
  await ready.ready();
  const couples = await import("../src/server/couples.ts");
  const admin = await import("../src/server/admin-data.ts");
  const auth = await import("../src/server/auth.ts");
  return { couples, admin, auth };
}

const spouse = (name: string, email: string) => ({
  fullName: name,
  shirtSize: "M",
  jacketSize: "L",
  phoneCountry: "+57",
  phone: "3001112233",
  email,
});

test("una pareja no ve datos de otra y el saldo ignora casillas", async () => {
  const { couples, admin, auth } = await load();
  const first = await couples.createCouple({
    esposo: spouse("Carlos Uno Ficticio", "uno.esposo@example.com"),
    esposa: spouse("Elena Uno Ficticio", "uno.esposa@example.com"),
    city: "Cali",
    region: "Valle",
    country: "Colombia",
    locale: "es",
  });
  const second = await couples.createCouple({
    esposo: spouse("Mario Dos Ficticio", "dos.esposo@example.com"),
    esposa: spouse("Nora Dos Ficticio", "dos.esposa@example.com"),
    city: "Lima",
    region: "Lima",
    country: "Perú",
    locale: "es",
  });
  assert.ok(!("error" in first) && !("error" in second));
  if ("error" in first || "error" in second) return;
  const view = await couples.assemble(first.coupleId, "es");
  assert.equal(view.code, first.code);
  assert.equal(JSON.stringify(view).includes("dos.esposo@example.com"), false);
  assert.equal(view.finance.balanceCents, null);
  assert.equal(view.waiver.configured, true);
  assert.equal(view.waiver.fileName, "waiver-ejemplo-provisional.pdf");
  assert.equal(view.progress.blocks.find((block) => block.key === "packing")?.ratio, 0);

  const husbandPack = await couples.togglePack(first.coupleId, view.spouses.esposo.id, "gorro", true);
  assert.equal("error" in husbandPack && husbandPack.error === "prohibido", true);
  const wifePack = await couples.acknowledgePack(first.coupleId, view.spouses.esposa.id);
  assert.equal("view" in wifePack, true);
  if ("view" in wifePack) {
    assert.equal(wifePack.view.spouses.esposa.packingAck, true);
    assert.equal(wifePack.view.progress.blocks.find((block) => block.key === "packing")?.state, "completado");
  }
  const signed = await couples.signWaiverExample(first.coupleId, {
    participantId: view.spouses.esposo.id,
    signedName: "Carlos Uno Ficticio",
    printedName: "Carlos Uno Ficticio",
    signedOn: "2026-11-21",
  });
  assert.equal("error" in signed, false);
  if (!("error" in signed)) {
    assert.equal(signed.view.waiver.spouses.esposo.status, "firmado");
  }

  const login = await couples.loginCouple(first.code, "uno.esposa@example.com", first.accessKey);
  assert.equal(login, first.coupleId);
  assert.equal(await couples.loginCouple(first.code, "dos.esposo@example.com", first.accessKey), null);

  await couples.setModality(first.coupleId, "total", true, "general");
  const payment = await couples.addPayment(first.coupleId, {
    amount: 150,
    paidOn: "2027-01-02",
    method: "transferencia",
    note: "PAGO FICTICIO",
  });
  assert.equal(payment.view.finance.paidCents, 0);
  assert.equal(payment.view.finance.claimPaidInFull, true);

  await auth.createAdministrator({
    email: "organizador@example.com",
    name: "Organizador Prueba",
    password: "ClaveSegura2027",
    role: "owner",
  });
  const adminId = await auth.authenticateAdmin("organizador@example.com", "ClaveSegura2027");
  assert.ok(adminId);
  await admin.saveEvent(
    { id: adminId!, email: "organizador@example.com", name: "Organizador Prueba", role: "owner" },
    {
      slogan: "AMOR A PRUEBA DE HIELO",
      subtitle: "PRIMER REM EN LA NIEVE",
      emotionalLine: "Una experiencia para fortalecer nuestro matrimonio y vivir juntos un nuevo reto.",
      city: "Denver",
      region: "Colorado",
      country: "USA",
      startsOn: "2027-01-23",
      endsOn: "2027-01-24",
      eventYear: 2027,
      currency: "USD",
      price: 500,
      hotelPrice: 1280,
      priceConfigured: true,
      shirtSizes: ["XS", "S", "M", "L", "XL", "XXL", "Otra / Por confirmar"],
      jacketSizes: ["XS", "S", "M", "L", "XL", "XXL", "Otra / Por confirmar"],
      semaforoMode: "external",
      semaforoExternalUrl: "https://matrimoniosrem.com/semaforo-rem-paso-1/",
      semaforoPerSpouse: true,
      semaforoGroupSize: 1,
      waiverRequiresBoth: true,
      retentionMonths: 24,
    },
  );
  const priced = await couples.assemble(first.coupleId, "es");
  assert.equal(priced.finance.totalCents, 50000);
  assert.equal(priced.finance.balanceCents, 50000);
  const verified = await admin.verifyPayment(
    { id: adminId!, email: "organizador@example.com", name: "Organizador Prueba", role: "owner" },
    first.code,
    payment.id,
    "verificado",
    "",
  );
  assert.equal(verified?.finance.paidCents, 15000);
  assert.equal(verified?.finance.balanceCents, 35000);

  const invited = await couples.chooseInvitation(second.coupleId, false);
  assert.equal(invited.invitation.status, "no_aplica");
  assert.equal(invited.progress.blocks.find((block) => block.key === "invitation")?.state, "no_aplica");

  const key = await couples.setAnswerKey(first.coupleId, view.spouses.esposo.id, "clave-privada-esposo");
  assert.equal("ok" in key, true);
  assert.equal(await couples.ownAnswers(first.coupleId, view.spouses.esposa.id, "clave-privada-esposo"), null);
  const foreign = await couples.saveAnswers(second.coupleId, {
    participantId: view.spouses.esposo.id,
    answerKey: "clave-privada-esposo",
    answers: [],
    submit: false,
  });
  assert.equal("error" in foreign, true);
});
