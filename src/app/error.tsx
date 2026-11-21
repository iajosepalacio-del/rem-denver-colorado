"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl text-[#073B69]">No pudimos cargar esta página</h1>
      <p className="text-[#1A4468]">El registro sigue guardado si ya lo habías enviado. Puedes intentar de nuevo.</p>
      <button type="button" className="h-12 rounded-xl bg-[#073B69] px-4 text-[#F7FCFF]" onClick={() => reset()}>
        Reintentar
      </button>
    </div>
  );
}
