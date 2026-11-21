import Link from "next/link";
import { redirect } from "next/navigation";
import { adminFromCookies } from "@/server/auth";
import { ready } from "@/server/ready";

const links = [
  ["/", "Resumen"],
  ["/parejas", "Parejas"],
  ["/configuracion", "Evento"],
  ["/documentos", "Documentos"],
  ["/cuestionario", "SEMÁFORO"],
  ["/auditoria", "Auditoría"],
  ["/equipo", "Equipo"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ready();
  const admin = await adminFromCookies();
  if (!admin) redirect("/admin/ingresar");
  return (
    <div className="min-h-screen bg-[#F7FCFF] text-[#073B69]">
      <header className="border-b border-[#C5E4F2] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <img src="/brand/rem-logo.png" alt="REM, Reto de Empoderamiento Matrimonial" className="h-12 w-auto rounded-lg bg-[#04182C] px-2 py-1" />
            <p className="text-sm text-[#1A4468]">{admin.name} · {admin.role}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {links.map(([href, label]) => (
              <Link key={href} className="rounded-full bg-[#E7F3F8] px-3 py-2" href={`/admin${href === "/" ? "" : href}`}>{label}</Link>
            ))}
            <form action="/api/admin/salir" method="post"><button className="rounded-full px-3 py-2 underline" type="submit">Salir</button></form>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
