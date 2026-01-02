// SUBCOMPONENTE: Pagination
// Propósito: Control de paginación compacto.
// Props:
//  - current: number
//  - total: number
//  - onChange: (page:number) => void
//  - windowSize?: number (cuántos botones visibles)

"use client";

export default function Pagination({
  current,
  total,
  onChange,
  windowSize = 4,
}: {
  current: number;
  total: number;
  onChange: (page: number) => void;
  windowSize?: number;
}) {
  if (total <= 1) return null;

  const start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(total, start + windowSize - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex justify-center mt-10">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 bg-zinc-700 text-white px-4 py-2 rounded-full text-sm">
        <button disabled={current === 1} onClick={() => onChange(1)} className="px-2 disabled:opacity-30">
          ««
        </button>
        <button disabled={current === 1} onClick={() => onChange(Math.max(current - 1, 1))} className="px-2 disabled:opacity-30">
          ‹
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1 rounded ${current === p ? "bg-white text-black font-bold" : "hover:bg-zinc-600"}`}
          >
            {p}
          </button>
        ))}

        <button disabled={current === total} onClick={() => onChange(Math.min(current + 1, total))} className="px-2 disabled:opacity-30">
          ›
        </button>
        <button disabled={current === total} onClick={() => onChange(total)} className="px-2 disabled:opacity-30">
          »»
        </button>
      </div>
    </div>
  );
}
