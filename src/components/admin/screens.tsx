"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { CoupleView } from "@/lib/types";
import type { EventConfig } from "@/server/event";

type Stats = {
  total: number;
  demos: number;
  completos: number;
  incompletos: number;
  pagosVerificados: number;
  balancePendiente: number;
  cartas: number;
  waivers: number;
  cuestionarios: number;
  sizes: Record<string, number>;
  cities: Record<string, number>;
  priceConfigured: boolean;
};

export function AdminLogin() {
  const [error, setError] = useState("");
  return (
    <div className="mx-auto grid max-w-lg gap-8 px-4 py-10">
      <form className="grid gap-3 rounded-3xl bg-white p-5" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError("");
        try {
          await api("/api/admin/ingresar", { method: "POST", body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
          window.location.href = "/admin";
        } catch (caught) {
          setError(caught instanceof ApiError ? "No pudimos entrar." : "No pudimos entrar.");
        }
      }}>
        <h1 className="text-3xl text-[#073B69]">Acceso del equipo organizador</h1>
        <label className="grid gap-1">Correo<Input className="h-12" name="email" type="email" required /></label>
        <label className="grid gap-1">Contraseña<Input className="h-12" name="password" type="password" minLength={12} required /></label>
        {error ? <p role="alert" className="text-[#9F1239]">{error}</p> : null}
        <Button type="submit" className="h-12">Entrar al panel</Button>
      </form>
      <form className="grid gap-3 rounded-3xl border border-[#C5E4F2] bg-white p-5" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError("");
        try {
          await api("/api/admin/activar", {
            method: "POST",
            body: JSON.stringify({
              token: data.get("token"),
              email: data.get("email"),
              name: data.get("name"),
              password: data.get("password"),
              role: "owner",
            }),
          });
          window.location.href = "/admin";
        } catch {
          setError("No se pudo crear el administrador. Revisa el token o si ya existe una cuenta.");
        }
      }}>
        <h2 className="text-xl">Crear el primer administrador</h2>
        <p className="text-sm text-[#1A4468]">En el servidor publicado hace falta ADMIN_BOOTSTRAP_TOKEN. En local, si todavía no hay administradores, puedes dejar el token vacío.</p>
        <label className="grid gap-1">Nombre<Input className="h-12" name="name" required minLength={3} /></label>
        <label className="grid gap-1">Correo<Input className="h-12" name="email" type="email" required /></label>
        <label className="grid gap-1">Contraseña<Input className="h-12" name="password" type="password" minLength={12} required /></label>
        <label className="grid gap-1">Token de activación<Input className="h-12" name="token" autoComplete="off" /></label>
        <Button type="submit" variant="outline" className="h-12">Crear administrador</Button>
      </form>
    </div>
  );
}

export function DashboardScreen() {
  const [data, setData] = useState<{ stats: Stats; list: CoupleView[] } | null>(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    api<{ stats: Stats; list: CoupleView[] }>(`/api/admin/resumen?${params.toString()}`)
      .then(setData)
      .catch(() => setError("No pudimos cargar el panel."));
  }, [q, estado]);
  if (!data) return <p>{error || "Cargando"}</p>;
  const cards = [
    ["Inscripciones", data.stats.total],
    ["Completas", data.stats.completos],
    ["Incompletas", data.stats.incompletos],
    ["Pagos verificados USD", (data.stats.pagosVerificados / 100).toFixed(2)],
    ["Balance pendiente USD", (data.stats.balancePendiente / 100).toFixed(2)],
    ["Cartas abiertas", data.stats.cartas],
    ["Waivers pendientes", data.stats.waivers],
    ["SEMÁFORO pendiente", data.stats.cuestionarios],
  ];
  return (
    <div className="grid gap-4">
      <p className="text-sm text-[#1A4468]">Las filas marcadas como ficticias son datos de prueba, no participantes reales. {!data.stats.priceConfigured ? "El precio oficial todavía no está configurado." : ""}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl bg-white p-4"><p className="text-sm text-[#1A4468]">{label}</p><p className="text-2xl">{value}</p></article>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <List title="Tallas" items={data.stats.sizes} />
        <List title="Ciudades" items={data.stats.cities} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input className="h-12" placeholder="Buscar por nombre, correo o código" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="h-12 rounded-lg border border-[#B7D7E8] bg-white px-3" value={estado} onChange={(event) => setEstado(event.target.value)} aria-label="Estado">
          <option value="">Todos</option>
          <option value="en_proceso">Registro en proceso</option>
          <option value="documentacion_pendiente">Documentación pendiente</option>
          <option value="pendiente_verificacion">Pendiente de verificación</option>
          <option value="completado">Registro completado</option>
        </select>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- el enlace descarga un CSV */}
        <a className="inline-flex h-12 items-center justify-center rounded-xl border px-4" href="/api/admin/export">Exportar CSV</a>
      </div>
      <div className="grid gap-2">
        {data.list.length === 0 ? <p>Todavía no hay registros.</p> : data.list.map((view) => (
          <Link key={view.code} href={`/admin/parejas/${view.code}`} className="rounded-2xl bg-white p-4">
            <span className="font-mono">{view.code}</span> {view.isDemo ? <em className="text-[#9F1239]">FICTICIO</em> : null}
            <span className="mt-1 block">{view.spouses.esposo.fullName} y {view.spouses.esposa.fullName} · {view.city} · {view.progress.percent}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: Record<string, number> }) {
  const rows = Object.entries(items);
  return (
    <section className="rounded-2xl bg-white p-4">
      <h2 className="text-lg">{title}</h2>
      {rows.length === 0 ? <p className="text-sm">Sin datos</p> : rows.map(([name, count]) => <p key={name} className="text-sm">{name}: {count}</p>)}
    </section>
  );
}

export function CoupleScreen({ code }: { code: string }) {
  const [data, setData] = useState<{ view: CoupleView; internalNotes: string } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setData(await api(`/api/admin/parejas/${code}`));
  }, [code]);
  useEffect(() => { load().catch(() => setError("No encontramos la pareja.")); }, [load]);
  if (!data) return <p>{error || "Cargando"}</p>;
  const view = data.view;
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl">{view.code} {view.isDemo ? "· FICTICIO" : ""}</h1>
      <p>{view.spouses.esposo.fullName} y {view.spouses.esposa.fullName}</p>
      <p>{view.city}, {view.country} · {view.progress.percent}% · {view.status}</p>
      <p>Saldo: {view.finance.balanceCents == null ? "precio no configurado" : formatMoney(view.finance.balanceCents, view.finance.currency, "es")}</p>
      <p>Notas internas: {data.internalNotes || "—"}</p>
      <ul className="grid gap-2">
        {view.finance.payments.map((payment) => (
          <li key={payment.id} className="rounded-2xl bg-white p-3 text-sm">
            {formatMoney(payment.amountCents, payment.currency, "es")} · {payment.status}
            {payment.hasReceipt ? <a className="ml-2 underline" href={`/api/admin/comprobante/${payment.id}`}>Comprobante</a> : null}
            {payment.status === "pendiente" ? (
              <span className="ml-2 inline-flex gap-2">
                <Button type="button" className="h-10" onClick={() => act(`/api/admin/pagos`, { code: view.code, paymentId: payment.id, decision: "verificado", note: "" }, load, setError)}>Verificar</Button>
                <Button type="button" variant="outline" className="h-10" onClick={() => act(`/api/admin/pagos`, { code: view.code, paymentId: payment.id, decision: "rechazado", note: "" }, load, setError)}>Rechazar</Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => act("/api/admin/invitacion", { code: view.code, status: "en_revision", note: "" }, load, setError)}>Carta en revisión</Button>
        <Button type="button" onClick={() => act("/api/admin/invitacion", { code: view.code, status: "entregada", note: "" }, load, setError)}>Marcar carta entregada</Button>
        <Button type="button" variant="outline" onClick={() => act("/api/admin/drive", { code: view.code }, load, setError)}>Reintentar Drive</Button>
      </div>
      <form className="grid gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const file = new FormData(event.currentTarget);
        file.set("code", view.code);
        await fetch("/api/admin/invitacion", { method: "POST", body: file });
        await load();
      }}>
        <label>PDF de la carta del organizador<input type="file" name="file" accept="application/pdf" required /></label>
        <Button type="submit" variant="outline">Cargar carta</Button>
      </form>
      {(["esposo", "esposa"] as const).map((role) => (
        <div key={role} className="rounded-2xl bg-white p-3">
          <p>{role}: SEMÁFORO {view.spouses[role].semaforoStatus} · waiver {view.waiver.spouses[role].status}</p>
          <Button type="button" className="mt-2 h-10" onClick={() => act("/api/admin/semaforo", { code: view.code, participantId: view.spouses[role].id, action: "verificar" }, load, setError)}>Verificar SEMÁFORO externo</Button>
        </div>
      ))}
      {error ? <p role="alert" className="text-[#9F1239]">{error}</p> : null}
    </div>
  );
}

async function act(path: string, body: unknown, reload: () => Promise<void>, setError: (value: string) => void) {
  setError("");
  try {
    await api(path, { method: "POST", body: JSON.stringify(body) });
    await reload();
  } catch {
    setError("La acción no se completó.");
  }
}

export function EventScreen() {
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { api<EventConfig>("/api/admin/evento").then(setEvent).catch(() => setMessage("No pudimos cargar el evento.")); }, []);
  if (!event) return <p>{message || "Cargando"}</p>;
  return (
    <form className="grid gap-3 rounded-3xl bg-white p-4" onSubmit={async (formEvent) => {
      formEvent.preventDefault();
      const data = new FormData(formEvent.currentTarget);
      try {
        const saved = await api<EventConfig>("/api/admin/evento", {
          method: "PATCH",
          body: JSON.stringify({
            slogan: data.get("slogan"),
            subtitle: data.get("subtitle"),
            emotionalLine: data.get("emotionalLine"),
            city: data.get("city"),
            region: data.get("region"),
            country: data.get("country"),
            startsOn: data.get("startsOn"),
            endsOn: data.get("endsOn"),
            eventYear: Number(data.get("eventYear")),
            currency: data.get("currency"),
            price: Number(data.get("price")),
            hotelPrice: Number(data.get("hotelPrice")),
            priceConfigured: data.get("priceConfigured") === "on",
            shirtSizes: String(data.get("shirtSizes")).split(",").map((item) => item.trim()).filter(Boolean),
            jacketSizes: String(data.get("jacketSizes")).split(",").map((item) => item.trim()).filter(Boolean),
            semaforoMode: data.get("semaforoMode"),
            semaforoExternalUrl: data.get("semaforoExternalUrl"),
            semaforoPerSpouse: data.get("semaforoPerSpouse") === "on",
            semaforoGroupSize: Number(data.get("semaforoGroupSize")),
            waiverRequiresBoth: data.get("waiverRequiresBoth") === "on",
            retentionMonths: Number(data.get("retentionMonths")),
          }),
        });
        setEvent(saved);
        setMessage("Guardado.");
      } catch {
        setMessage("No se pudo guardar. Revisa las fechas, el enlace https y las tallas.");
      }
    }}>
      <h1 className="text-3xl">Evento</h1>
      <label>Eslogan<Input className="h-12" name="slogan" defaultValue={event.slogan} /></label>
      <label>Subtítulo<Input className="h-12" name="subtitle" defaultValue={event.subtitle} /></label>
      <label>Texto emocional<Textarea name="emotionalLine" defaultValue={event.emotionalLine} /></label>
      <label>Ciudad<Input className="h-12" name="city" defaultValue={event.city} /></label>
      <label>Región<Input className="h-12" name="region" defaultValue={event.region} /></label>
      <label>País<Input className="h-12" name="country" defaultValue={event.country} /></label>
      <label>Inicio<Input className="h-12" type="date" name="startsOn" defaultValue={event.startsOn} /></label>
      <label>Fin<Input className="h-12" type="date" name="endsOn" defaultValue={event.endsOn} /></label>
      <label>Año<Input className="h-12" name="eventYear" type="number" defaultValue={event.eventYear} /></label>
      <label>Moneda<Input className="h-12" name="currency" defaultValue={event.currency} maxLength={3} /></label>
      <label>Tarifa general USD<input className="h-12 w-full rounded-lg border px-3" name="price" type="number" step="0.01" defaultValue={event.priceCents / 100} /></label>
      <label>Paquete con hotel USD<input className="h-12 w-full rounded-lg border px-3" name="hotelPrice" type="number" step="0.01" defaultValue={event.hotelPriceCents / 100} /></label>
      <label className="flex gap-2"><input type="checkbox" name="priceConfigured" defaultChecked={event.priceConfigured} /> Los precios ya son oficiales</label>
      <label>Tallas de camiseta<Input className="h-12" name="shirtSizes" defaultValue={event.shirtSizes.join(", ")} /></label>
      <label>Tallas de chaqueta<Input className="h-12" name="jacketSizes" defaultValue={event.jacketSizes.join(", ")} /></label>
      <label>SEMÁFORO
        <select className="h-12 w-full rounded-lg border px-3" name="semaforoMode" defaultValue={event.semaforoMode}>
          <option value="external">Enlace oficial externo</option>
          <option value="internal">Formulario interno</option>
        </select>
      </label>
      <label>Enlace externo<Input className="h-12" name="semaforoExternalUrl" defaultValue={event.semaforoExternalUrl} /></label>
      <label className="flex gap-2"><input type="checkbox" name="semaforoPerSpouse" defaultChecked={event.semaforoPerSpouse} /> Cada cónyuge responde</label>
      <label>Preguntas por pantalla<Input className="h-12" type="number" name="semaforoGroupSize" defaultValue={event.semaforoGroupSize} /></label>
      <label className="flex gap-2"><input type="checkbox" name="waiverRequiresBoth" defaultChecked={event.waiverRequiresBoth} /> El waiver pide las dos firmas</label>
      <label>Meses de retención<Input className="h-12" type="number" name="retentionMonths" defaultValue={event.retentionMonths} /></label>
      {message ? <p role="status">{message}</p> : null}
      <Button type="submit" className="h-12">Guardar</Button>
    </form>
  );
}

export function DocumentsScreen() {
  const [message, setMessage] = useState("");
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl">Documentos oficiales</h1>
      <form className="grid gap-3 rounded-3xl bg-white p-4" onSubmit={async (event) => {
        event.preventDefault();
        const body = new FormData(event.currentTarget);
        const response = await fetch("/api/admin/waiver", { method: "POST", body });
        setMessage(response.ok ? "El PDF del waiver quedó activo." : "No se pudo cargar el PDF.");
      }}>
        <h2 className="text-xl">Waiver</h2>
        <label>Versión<Input className="h-12" name="version" required /></label>
        <label>PDF oficial<input type="file" name="file" accept="application/pdf" required /></label>
        <Button type="submit" className="h-12">Cargar PDF oficial del waiver</Button>
      </form>
      <form className="grid gap-3 rounded-3xl bg-white p-4" onSubmit={async (event) => {
        event.preventDefault();
        const body = new FormData(event.currentTarget);
        const response = await fetch("/api/admin/firma", { method: "POST", body });
        setMessage(response.ok ? "Se registró el PDF del proveedor." : "No se registró la firma. Revisa el proveedor y la referencia.");
      }}>
        <h2 className="text-xl">Firma devuelta por el proveedor</h2>
        <p className="text-sm text-[#1A4468]">Solo cuenta como firmado si SIGNATURE_PROVIDER_NAME está configurado y adjuntas el PDF que devolvió ese proveedor.</p>
        <label>Código<Input className="h-12" name="code" required /></label>
        <label>ID del cónyuge<Input className="h-12" name="participantId" required /></label>
        <label>Referencia<Input className="h-12" name="providerRef" required /></label>
        <label>Decisión
          <select className="h-12 w-full rounded-lg border px-3" name="decision" defaultValue="firmado">
            <option value="firmado">Firmado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </label>
        <label>Nota<Input className="h-12" name="note" /></label>
        <label>PDF<input type="file" name="file" accept="application/pdf" required /></label>
        <Button type="submit" variant="outline" className="h-12">Registrar PDF</Button>
      </form>
      <form className="grid gap-3 rounded-3xl bg-white p-4" onSubmit={async (event) => {
        event.preventDefault();
        const body = new FormData(event.currentTarget);
        const response = await fetch("/api/admin/logo", { method: "POST", body });
        setMessage(response.ok ? "El logotipo autorizado quedó publicado." : "El logotipo debe ser JPG o PNG.");
      }}>
        <h2 className="text-xl">Logotipo autorizado</h2>
        <p className="text-sm">Si no hay archivo, el sitio usa la palabra REM. No reconstruimos un logotipo protegido.</p>
        <input type="file" name="file" accept="image/png,image/jpeg" required />
        <Button type="submit" variant="outline">Cargar logotipo</Button>
      </form>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

export function QuestionsScreen() {
  const [message, setMessage] = useState("");
  return (
    <form className="grid gap-3 rounded-3xl bg-white p-4" onSubmit={async (event) => {
      event.preventDefault();
      const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const json = JSON.parse(await file.text());
        await api("/api/admin/cuestionario", { method: "POST", body: JSON.stringify(json) });
        setMessage(`Quedó activa la versión ${json.version} con ${json.questions?.length ?? 0} preguntas. No hay interpretación clínica.`);
      } catch {
        setMessage("El archivo no tiene la estructura esperada: version, title y questions.");
      }
    }}>
      <h1 className="text-3xl">SEMÁFORO</h1>
      <p className="text-sm text-[#1A4468]">El archivo JSON lo entrega la organización. Esta plataforma no incluye las 50 preguntas.</p>
      <input type="file" name="file" accept="application/json,.json" required />
      <Button type="submit" className="h-12">Cargar archivo oficial de preguntas</Button>
      {message ? <p role="status">{message}</p> : null}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- el enlace descarga un CSV */}
      <a className="underline" href="/api/admin/respuestas">Exportar respuestas (permiso de cuestionario)</a>
    </form>
  );
}

export function AuditScreen() {
  const [rows, setRows] = useState<{ id: string; at: string; action: string; entity: string; result: string }[]>([]);
  const [outbox, setOutbox] = useState<{ id: string; to_email: string; subject: string; status: string }[]>([]);
  useEffect(() => {
    api<typeof rows>("/api/admin/auditoria").then(setRows).catch(() => setRows([]));
    api<typeof outbox>("/api/admin/buzon").then(setOutbox).catch(() => setOutbox([]));
  }, []);
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl">Auditoría</h1>
      <ul className="grid gap-2">{rows.map((row) => <li key={row.id} className="rounded-2xl bg-white p-3 text-sm">{row.at} · {row.action} · {row.entity} · {row.result}</li>)}</ul>
      <h2 className="text-xl">Correos</h2>
      <ul className="grid gap-2">{outbox.map((row) => <li key={row.id} className="rounded-2xl bg-white p-3 text-sm">{row.status} · {row.to_email} · {row.subject}</li>)}</ul>
    </div>
  );
}

export function TeamScreen() {
  const [message, setMessage] = useState("");
  return (
    <form className="grid max-w-lg gap-3 rounded-3xl bg-white p-4" onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        await api("/api/admin/equipo", {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            email: data.get("email"),
            password: data.get("password"),
            role: data.get("role"),
          }),
        });
        setMessage("Cuenta creada.");
      } catch {
        setMessage("No se pudo crear. La contraseña necesita 12 caracteres, letras y números.");
      }
    }}>
      <h1 className="text-3xl">Equipo</h1>
      <label>Nombre<Input className="h-12" name="name" required /></label>
      <label>Correo<Input className="h-12" name="email" type="email" required /></label>
      <label>Contraseña<Input className="h-12" name="password" type="password" minLength={12} required /></label>
      <label>Rol
        <select className="h-12 w-full rounded-lg border px-3" name="role" defaultValue="viewer">
          <option value="viewer">Lectura</option>
          <option value="payments">Pagos</option>
          <option value="documents">Documentos</option>
          <option value="questionnaire">SEMÁFORO</option>
          <option value="owner">Responsable</option>
        </select>
      </label>
      {message ? <p role="status">{message}</p> : null}
      <Button type="submit" className="h-12">Crear cuenta</Button>
    </form>
  );
}
