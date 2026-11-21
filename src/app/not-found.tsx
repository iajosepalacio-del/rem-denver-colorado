import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl text-[#073B69]">Esta página no está en el recorrido</h1>
      <Link className="text-[#073B69] underline" href="/">Volver al inicio</Link>
    </div>
  );
}
