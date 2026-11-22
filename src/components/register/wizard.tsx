"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { CALLING_CODES } from "@/lib/catalog";
import { api, ApiError } from "@/lib/client";
import { formatMoney, formatWhen } from "@/lib/format";
import type { CoupleView, SpouseRole } from "@/lib/types";
import { messages, type Locale, type Messages } from "@/i18n/messages";

const STEPS = ["datos", "pagos", "docs", "maleta", "fin"] as const;

export function Wizard({
  initial,
  locale,
  shirtSizes,
  jacketSizes,
}: {
  initial: CoupleView;
  locale: Locale;
  shirtSizes: string[];
  jacketSizes: string[];
}) {
  const copy = messages[locale];
  const [view, setView] = useState(initial);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function run(work: () => Promise<CoupleView | { view: CoupleView } | { id: string; view: CoupleView }>) {
    setError("");
    setStatus(copy.saving);
    try {
      const result = await work();
      const next = "view" in result ? result.view : result;
      setView(next);
      setStatus(copy.saved);
    } catch (caught) {
      setStatus("");
      setError(text(caught, copy));
    }
  }

  const titles = [copy.stepDatos, copy.stepPagos, copy.stepDocs, copy.stepMaleta, copy.stepFin];
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-[#C5E4F2] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-sm text-[#1A4468]">{view.code}</p>
          {view.isDemo ? <span className="rounded-full bg-[#FF75A5]/20 px-2 py-1 text-xs font-semibold text-[#9F1239]">{copy.demoBadge}</span> : null}
        </div>
        <Progress value={view.progress.percent} aria-label={copy.progress} className="mt-3">
          <ProgressLabel>{copy.progress}</ProgressLabel>
          <ProgressValue />
        </Progress>
        <p className="mt-2 text-sm font-semibold">{registrationLabel(view.status, copy)}</p>
        {view.progress.needsReview ? <p className="text-sm text-[#9F1239]">{copy.status.requiere_revision}</p> : null}
        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {titles.map((title, index) => (
            <li key={title}>
              <button
                type="button"
                className={`min-h-11 w-full rounded-2xl px-2 py-2 text-left text-sm ${step === index ? "bg-[#073B69] text-white" : "bg-[#E7F3F8] text-[#073B69]"}`}
                aria-current={step === index ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                {index + 1}. {title}
              </button>
            </li>
          ))}
        </ol>
        <ul className="mt-3 flex flex-wrap gap-2">
          {view.progress.blocks.map((block) => (
            <li key={block.key} className="rounded-full bg-[#E5F6FC] px-2 py-1 text-xs text-[#073B69]">
              {copy.blocks[block.key]}: {copy.status[block.state]}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[#1A4468]" role="status">{driveText(view, copy)} {status}</p>
        {error ? <p role="alert" className="mt-2 text-sm text-[#9F1239]">{error}</p> : null}
      </div>

      {step === 0 ? <DataStep view={view} copy={copy} shirtSizes={shirtSizes} jacketSizes={jacketSizes} onSave={(body) => run(() => api("/api/registro", { method: "PATCH", body: JSON.stringify(body) }))} /> : null}
      {step === 1 ? <PayStep view={view} copy={copy} locale={locale} onView={(next) => setView(next)} onError={setError} /> : null}
      {step === 2 ? <DocsStep view={view} copy={copy} onView={(next) => setView(next)} onError={setError} /> : null}
      {step === 3 ? <PackStep view={view} copy={copy} onView={(next) => setView(next)} onError={setError} /> : null}
      {step === 4 ? <ConfirmStep view={view} copy={copy} locale={locale} onView={(next) => setView(next)} /> : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#C5E4F2] bg-[#F7FCFF]/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button type="button" variant="outline" className="h-12 flex-1" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>{copy.back}</Button>
          <Button type="button" className="h-12 flex-1" disabled={step === STEPS.length - 1} onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>{copy.saveNext}</Button>
        </div>
      </div>
    </div>
  );
}

function DataStep({
  view,
  copy,
  shirtSizes,
  jacketSizes,
  onSave,
}: {
  view: CoupleView;
  copy: Messages;
  shirtSizes: string[];
  jacketSizes: string[];
  onSave: (body: unknown) => void;
}) {
  const [form, setForm] = useState(() => ({
    esposo: spousePayload(view, "esposo"),
    esposa: spousePayload(view, "esposa"),
    city: view.city,
    region: view.region,
    country: view.country,
    updatedAt: view.updatedAt,
  }));
  return (
    <form
      className="grid gap-4 lg:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...form, updatedAt: view.updatedAt });
      }}
    >
      {(["esposo", "esposa"] as const).map((role) => (
        <section key={role} className="grid gap-3 rounded-3xl border border-[#C5E4F2] bg-white p-4">
          <h2 className="text-xl">{role === "esposo" ? copy.husband : copy.wife}</h2>
          <label className="grid gap-1 text-sm">{copy.fullName}<Input className="h-12" value={form[role].fullName} onChange={(event) => setForm({ ...form, [role]: { ...form[role], fullName: event.target.value } })} /></label>
          <label className="grid gap-1 text-sm">{copy.shirt}<Select value={form[role].shirtSize} options={shirtSizes} onChange={(value) => setForm({ ...form, [role]: { ...form[role], shirtSize: value } })} /></label>
          <label className="grid gap-1 text-sm">{copy.jacket}<Select value={form[role].jacketSize} options={jacketSizes} onChange={(value) => setForm({ ...form, [role]: { ...form[role], jacketSize: value } })} /></label>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <label className="grid gap-1 text-sm">{copy.phoneCode}
              <select className="h-12 rounded-lg border border-[#B7D7E8] bg-white px-2" value={form[role].phoneCountry} onChange={(event) => setForm({ ...form, [role]: { ...form[role], phoneCountry: event.target.value } })}>
                {CALLING_CODES.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">{copy.phone}<Input className="h-12" inputMode="tel" value={form[role].phone} onChange={(event) => setForm({ ...form, [role]: { ...form[role], phone: event.target.value } })} /></label>
          </div>
          <label className="grid gap-1 text-sm">{copy.email}<Input className="h-12" type="email" value={form[role].email} onChange={(event) => setForm({ ...form, [role]: { ...form[role], email: event.target.value } })} /></label>
        </section>
      ))}
      <div className="lg:col-span-2">
        <Button type="submit" className="h-12 px-5">{copy.save}</Button>
      </div>
    </form>
  );
}

function PayStep({ view, copy, locale, onView, onError }: { view: CoupleView; copy: Messages; locale: Locale; onView: (view: CoupleView) => void; onError: (value: string) => void }) {
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("2027-01-10");
  const [method, setMethod] = useState("transferencia");
  const money = (cents: number) => formatMoney(cents, view.finance.currency, locale);
  return (
    <section className="grid gap-4 rounded-3xl border border-[#C5E4F2] bg-white p-4">
      <h2 className="text-2xl">{copy.financeTitle}</h2>
      <fieldset className="grid gap-2 rounded-2xl bg-[#F7FCFF] p-3">
        <legend className="font-semibold">{copy.packageTitle}</legend>
        {(["general", "hotel"] as const).map((kind) => (
          <label key={kind} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="package"
              checked={view.finance.packageKind === kind}
              onChange={() => savePackage(kind, onView, onError, copy)}
            />
            <span>{copy.packages[kind]} — {money(view.finance.packages[kind])}</span>
          </label>
        ))}
      </fieldset>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Info label={copy.total} value={view.finance.priceConfigured && view.finance.packageKind ? money(view.finance.totalCents) : copy.packageMissing} />
        <Info label={copy.currency} value={view.finance.currency} />
        <Info label={copy.paid} value={money(view.finance.paidCents)} />
        <Info label={copy.balance} value={view.finance.balanceCents == null ? copy.packageMissing : money(view.finance.balanceCents)} />
        <Info label={copy.lastPayment} value={formatWhen(view.finance.lastPaymentOn, locale)} />
        <Info label={copy.verification} value={view.finance.payments.some((payment) => payment.status === "verificado") ? copy.payStatus.verificado : copy.payStatus.pendiente} />
      </dl>
      <p className="text-sm text-[#1A4468]">{copy.notes}: {view.finance.adminNotes || "—"}</p>
      <div className="grid gap-2">
        <label className="flex items-center gap-2"><input type="radio" name="modality" checked={view.finance.modality === "total"} onChange={() => saveModality(view, "total", view.finance.claimPaidInFull, onView, onError, copy)} /> {copy.payAll}</label>
        <label className="flex items-center gap-2"><input type="radio" name="modality" checked={view.finance.modality === "cuotas"} onChange={() => saveModality(view, "cuotas", false, onView, onError, copy)} /> {copy.payParts}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={view.finance.claimPaidInFull} disabled={view.finance.modality !== "total"} onChange={(event) => saveModality(view, "total", event.target.checked, onView, onError, copy)} /> {copy.claimFull}</label>
        <p className="text-sm text-[#1A4468]">{copy.claimHint}</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={(view.finance.balanceCents ?? 0) > 0} disabled readOnly /> {copy.balanceFlag}</label>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const result = await api<{ view: CoupleView }>("/api/pagos", {
              method: "POST",
              body: JSON.stringify({ amount: Number(amount), paidOn, method, note: "" }),
            });
            onView(result.view);
            setAmount("");
          } catch (caught) {
            onError(text(caught, copy));
          }
        }}
      >
        <h3 className="sm:col-span-2 text-lg">{copy.addPayment}</h3>
        <label className="grid gap-1 text-sm">{copy.amount}<Input className="h-12" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <label className="grid gap-1 text-sm">{copy.date}<Input className="h-12" type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required /></label>
        <label className="grid gap-1 text-sm">{copy.method}
          <select className="h-12 rounded-lg border border-[#B7D7E8] bg-white px-3" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="transferencia">{copy.methods.transferencia}</option>
            <option value="efectivo">{copy.methods.efectivo}</option>
            <option value="otro">{copy.methods.otro}</option>
          </select>
        </label>
        <Button type="submit" className="h-12 sm:self-end">{copy.save}</Button>
      </form>
      <h3 className="text-lg">{copy.history}</h3>
      {view.finance.payments.length === 0 ? <p>{copy.emptyPayments}</p> : (
        <ul className="grid gap-2">
          {view.finance.payments.map((payment) => (
            <li key={payment.id} className="rounded-2xl bg-[#F7FCFF] p-3 text-sm">
              <p>{formatWhen(payment.paidOn, locale)} · {money(payment.amountCents)} · {copy.payStatus[payment.status]}</p>
              <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  onView(await api(`/api/pagos/${payment.id}/comprobante`, { method: "POST", body: data }));
                } catch (caught) {
                  onError(text(caught, copy));
                }
              }}>
                <label className="text-sm">{copy.receipt}<input className="mt-1 block" type="file" name="file" accept="application/pdf,image/png,image/jpeg" required /></label>
                <Button type="submit" variant="outline" className="h-11">{copy.upload}</Button>
                {payment.hasReceipt ? <a className="underline" href={`/api/pagos/${payment.id}/comprobante`}>{copy.download}</a> : null}
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DocsStep({ view, copy, onView, onError }: { view: CoupleView; copy: Messages; onView: (view: CoupleView) => void; onError: (value: string) => void }) {
  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-[#C5E4F2] bg-white p-4">
        <h2 className="text-xl">{copy.inviteQuestion}</h2>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant={view.invitation.needed === true ? "default" : "outline"} onClick={() => choose(true, onView, onError, copy)}>{copy.yes}</Button>
          <Button type="button" variant={view.invitation.needed === false ? "default" : "outline"} onClick={() => choose(false, onView, onError, copy)}>{copy.no}</Button>
        </div>
        <p className="mt-3 text-sm text-[#1A4468]">{copy.inviteNote}</p>
        {view.invitation.needed ? <p className="mt-2 font-semibold">{copy.status[view.invitation.status as keyof Messages["status"]] ?? view.invitation.status}</p> : null}
        {view.invitation.fileName && (view.invitation.status === "entregada" || view.invitation.status === "aprobada") ? <a className="mt-2 inline-block underline" href="/api/invitacion">{copy.download}</a> : null}
      </section>
      <section className="rounded-3xl border border-[#C5E4F2] bg-white p-4">
        <h2 className="text-xl">{copy.waiverTitle}</h2>
        <p className="mt-2 text-sm text-[#1A4468]">{copy.waiverLegal}</p>
        {!view.waiver.configured ? <p className="mt-3 font-semibold">{copy.waiverMissing}</p> : (
          <div className="mt-3 grid gap-3">
            <p className="text-sm font-semibold text-[#9F1239]">{copy.waiverProvisional}</p>
            <a className="underline" href="/api/waiver" target="_blank" rel="noreferrer">{copy.openWaiver}</a>
            <p className="text-sm">{copy.providerOff}</p>
            {(["esposo", "esposa"] as const).map((role) => (
              <WaiverSignForm key={role} role={role} view={view} copy={copy} onView={onView} onError={onError} />
            ))}
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-[#C5E4F2] bg-white p-4">
        <h2 className="text-xl">{copy.semaforoTitle}</h2>
        <p className="mt-2 text-sm text-[#1A4468]">{copy.semaforoPrivate}</p>
        {view.semaforo.mode === "external" ? (
          <div className="mt-3 grid gap-3">
            <p className="text-sm">{copy.semaforoExternal}</p>
            <a className="inline-flex h-12 items-center justify-center rounded-xl bg-[#073B69] px-4 text-[#F7FCFF]" href={view.semaforo.externalUrl} target="_blank" rel="noreferrer">{copy.semaforoButton}</a>
            {(["esposo", "esposa"] as const).map((role) => (
              <Button key={role} type="button" variant="outline" onClick={async () => {
                try {
                  onView(await api("/api/semaforo", { method: "POST", body: JSON.stringify({ kind: "externo", participantId: view.spouses[role].id }) }));
                } catch (caught) {
                  onError(text(caught, copy));
                }
              }}>{role === "esposo" ? copy.husband : copy.wife}: {copy.openedForm}</Button>
            ))}
          </div>
        ) : view.semaforo.questionsLoaded ? (
          <div className="mt-3 flex flex-col gap-2">
            <Link className="inline-flex h-12 items-center justify-center rounded-xl bg-[#073B69] px-4 text-[#F7FCFF]" href="/registro/semaforo?quien=esposo">{copy.husband}: {copy.semaforoButton}</Link>
            <Link className="inline-flex h-12 items-center justify-center rounded-xl border border-[#073B69] px-4" href="/registro/semaforo?quien=esposa">{copy.wife}: {copy.semaforoButton}</Link>
          </div>
        ) : <p className="mt-3 font-semibold">{copy.semaforoMissing}</p>}
      </section>
    </div>
  );
}

function PackStep({ view, copy, onView, onError }: { view: CoupleView; copy: Messages; onView: (view: CoupleView) => void; onError: (value: string) => void }) {
  const groups = ["ropa", "accesorios", "documentos", "evento"] as const;
  const spouse = view.spouses.esposa;
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-2xl">{copy.packingTitle}</h2>
        <p className="mt-2 text-[#1A4468]">{copy.packingSubtitle}</p>
        <p className="mt-3 rounded-2xl bg-[#FFF1F2] p-3 text-sm font-semibold text-[#9F1239]">{copy.packingWifeNote}</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-[#1A4468]">{copy.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        <p className="mt-2 text-sm">{copy.winterNote}</p>
      </div>
      <article className="rounded-3xl border border-[#C5E4F2] bg-white p-4">
            <h3 className="text-xl">{copy.wife} · {spouse.packingChecked}/{view.packing.items.length}</h3>
            {groups.map((group) => (
              <div key={group} className="mt-3">
                <h4 className="font-semibold">{copy.groups[group]}</h4>
                <ul className="mt-2 grid gap-2">
                  {view.packing.items.filter((item) => item.group === group).map((item) => {
                    const checked = view.packing.checks[spouse.id]?.includes(item.key) ?? false;
                    return (
                      <li key={item.key}>
                        <label className="flex min-h-11 items-start gap-3 text-base">
                          <input
                            type="checkbox"
                            className="mt-1 size-5"
                            checked={checked}
                            onChange={async (event) => {
                              try {
                                onView(await api("/api/maleta", { method: "POST", body: JSON.stringify({ participantId: spouse.id, itemKey: item.key, checked: event.target.checked }) }));
                              } catch (caught) {
                                onError(text(caught, copy));
                              }
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <label className="mt-4 flex items-start gap-3 font-semibold">
              <input type="checkbox" className="mt-1 size-5" checked={spouse.packingAck} onChange={async (event) => {
                if (!event.target.checked) return;
                try {
                  onView(await api("/api/maleta", { method: "POST", body: JSON.stringify({ kind: "ack", participantId: spouse.id, acknowledged: true }) }));
                } catch (caught) {
                  onError(text(caught, copy));
                }
              }} />
              <span>{copy.packingAck}</span>
            </label>
          </article>
      <a className="inline-flex h-12 items-center justify-center rounded-xl border border-[#073B69] px-4" href="/api/maleta">{copy.packingPdf}</a>
    </section>
  );
}

function ConfirmStep({ view, copy, locale, onView }: { view: CoupleView; copy: Messages; locale: Locale; onView: (view: CoupleView) => void }) {
  return (
    <section className="grid gap-3 rounded-3xl border border-[#C5E4F2] bg-white p-4">
      <h2 className="text-2xl">{copy.confirmTitle}</h2>
      <p className="text-lg font-semibold">{registrationLabel(view.status, copy)} · {view.progress.percent}%</p>
      <Info label={copy.code} value={view.code} />
      <Info label={copy.coupleId} value={view.code} />
      <Info label={copy.husband} value={view.spouses.esposo.fullName} />
      <Info label={copy.wife} value={view.spouses.esposa.fullName} />
      <Info label={copy.city} value={`${view.city}, ${view.country}`} />
      <Info label={copy.sizes} value={`${view.spouses.esposo.shirtSize}/${view.spouses.esposo.jacketSize} · ${view.spouses.esposa.shirtSize}/${view.spouses.esposa.jacketSize}`} />
      <Info label={copy.balance} value={view.finance.balanceCents == null ? copy.packageMissing : formatMoney(view.finance.balanceCents, view.finance.currency, locale)} />
      <Info label={copy.blocks.invitation} value={copy.status[view.invitation.status as keyof Messages["status"]] ?? view.invitation.status} />
      <Info label={copy.blocks.waiver} value={`${view.waiver.spouses.esposo.status} / ${view.waiver.spouses.esposa.status}`} />
      <Info label={copy.blocks.semaforo} value={`${view.spouses.esposo.semaforoStatus} / ${view.spouses.esposa.semaforoStatus}`} />
      <Info label={copy.blocks.packing} value={view.spouses.esposa.packingAck ? copy.status.completado : copy.status.pendiente} />
      <p className="text-sm text-[#1A4468]">{copy.certificateHint}</p>
      <p className="text-sm font-semibold">{view.progress.percent === 100 && view.status === "completado" ? copy.certificateQr : copy.certificateNoQr}</p>
      <a className="inline-flex h-12 items-center justify-center rounded-xl bg-[#073B69] px-4 text-[#F7FCFF]" href="/api/constancia">{copy.certificate}</a>
      {view.deletionRequested ? <p role="status">{copy.deleteAsked}</p> : (
        <Button type="button" variant="outline" onClick={async () => onView(await api("/api/eliminacion", { method: "POST" }))}>{copy.deleteAsk}</Button>
      )}
    </section>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select className="h-12 rounded-lg border border-[#B7D7E8] bg-white px-3" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-[#1A4468]">{label}</dt><dd className="text-base">{value}</dd></div>;
}

function spousePayload(view: CoupleView, role: SpouseRole) {
  const spouse = view.spouses[role];
  return {
    fullName: spouse.fullName,
    shirtSize: spouse.shirtSize,
    jacketSize: spouse.jacketSize,
    phoneCountry: spouse.phoneCountry,
    phone: spouse.phone,
    email: spouse.email,
  };
}

async function savePackage(packageKind: "general" | "hotel", onView: (view: CoupleView) => void, onError: (value: string) => void, copy: Messages) {
  try {
    onView(await api("/api/pagos", { method: "POST", body: JSON.stringify({ kind: "paquete", packageKind }) }));
  } catch (caught) {
    onError(text(caught, copy));
  }
}

async function saveModality(view: CoupleView, modality: "total" | "cuotas", claimPaidInFull: boolean, onView: (view: CoupleView) => void, onError: (value: string) => void, copy: Messages) {
  try {
    onView(await api("/api/pagos", { method: "POST", body: JSON.stringify({ kind: "modalidad", modality, claimPaidInFull, packageKind: view.finance.packageKind || undefined }) }));
  } catch (caught) {
    onError(text(caught, copy));
  }
}

function WaiverSignForm({
  role,
  view,
  copy,
  onView,
  onError,
}: {
  role: SpouseRole;
  view: CoupleView;
  copy: Messages;
  onView: (view: CoupleView) => void;
  onError: (value: string) => void;
}) {
  const spouse = view.spouses[role];
  const signed = view.waiver.spouses[role];
  const [signedName, setSignedName] = useState(signed.signedName || spouse.fullName);
  const [printedName, setPrintedName] = useState(signed.signedName || spouse.fullName);
  const [signedOn, setSignedOn] = useState(new Date().toISOString().slice(0, 10));
  return (
    <form
      className="grid gap-2 rounded-2xl bg-[#F7FCFF] p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          const result = await api<{ signingUrl: string | null; view: CoupleView }>("/api/waiver", {
            method: "POST",
            body: JSON.stringify({ participantId: spouse.id, signedName, printedName, signedOn }),
          });
          onView(result.view);
          if (result.signingUrl) window.location.href = result.signingUrl;
        } catch (caught) {
          onError(text(caught, copy));
        }
      }}
    >
      <p className="font-semibold">{role === "esposo" ? copy.husband : copy.wife}</p>
      <p className="text-sm">{copy.status[signed.status as keyof Messages["status"]] ?? signed.status}</p>
      <label className="grid gap-1 text-sm">{copy.waiverSignName}<Input className="h-12" value={signedName} onChange={(event) => setSignedName(event.target.value)} required minLength={3} /></label>
      <label className="grid gap-1 text-sm">{copy.waiverPrintName}<Input className="h-12" value={printedName} onChange={(event) => setPrintedName(event.target.value)} required minLength={3} /></label>
      <label className="grid gap-1 text-sm">{copy.waiverDate}<Input className="h-12" type="date" value={signedOn} onChange={(event) => setSignedOn(event.target.value)} required /></label>
      <Button type="submit" className="h-11">{copy.waiverSignSubmit}</Button>
      {view.waiver.providerConfigured ? (
        <Button type="button" variant="outline" className="h-11" onClick={async () => {
          try {
            const result = await api<{ signingUrl: string | null; view: CoupleView }>("/api/waiver", {
              method: "POST",
              body: JSON.stringify({ participantId: spouse.id }),
            });
            onView(result.view);
            if (result.signingUrl) window.location.href = result.signingUrl;
          } catch (caught) {
            onError(text(caught, copy));
          }
        }}>{copy.openWaiver}</Button>
      ) : null}
      {signed.status === "firmado" ? <a className="mt-1 block underline" href={`/api/waiver/${spouse.id}`}>{copy.download}</a> : null}
    </form>
  );
}

async function choose(needed: boolean, onView: (view: CoupleView) => void, onError: (value: string) => void, copy: Messages) {
  try {
    onView(await api("/api/invitacion", { method: "POST", body: JSON.stringify({ needed }) }));
  } catch (caught) {
    onError(text(caught, copy));
  }
}

function registrationLabel(status: CoupleView["status"], copy: Messages) {
  if (status === "documentacion_pendiente") return copy.status.documentacion_pendiente;
  if (status === "pendiente_verificacion") return copy.status.pendiente_verificacion;
  if (status === "completado") return copy.status.completado_reg;
  return copy.status.en_proceso_reg;
}

function driveText(view: CoupleView, copy: Messages) {
  if (view.integrations.drive === "sincronizado") return copy.driveOk;
  if (view.integrations.drive === "error") return copy.driveError;
  if (view.integrations.drive === "pendiente") return copy.drivePending;
  return copy.driveOff;
}

function text(error: unknown, copy: Messages) {
  if (error instanceof ApiError) return copy.errors[error.code as keyof Messages["errors"]] ?? copy.errors.error;
  return copy.errors.error;
}
