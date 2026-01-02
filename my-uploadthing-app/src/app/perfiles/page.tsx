"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Row = { user_id: string; name: string; email: string; generacion?: string; facultad?: string; avatar_url?: string | null };

export default function PerfilesPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (query = "") => {
    setLoading(true);
    try {
      const url = `/api/perfiles${query ? `?search=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Perfiles</h1>
      <div className="mb-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email" className="px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-white w-full max-w-md" />
        <button onClick={() => load(q)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded text-white">Buscar</button>
      </div>

      {loading ? <div className="text-zinc-400">Cargando…</div> : rows.length === 0 ? <div className="text-zinc-400">Sin resultados</div> : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <li key={r.user_id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-full overflow-hidden bg-zinc-800">
                {r.avatar_url ? <img src={r.avatar_url} alt={r.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-xs text-zinc-400">Sin foto</div>}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{r.name}</p>
                <p className="text-xs text-zinc-400 truncate">{r.email}</p>
                <p className="text-xs text-zinc-500 truncate">{r.generacion ? `Gen. ${r.generacion} · ` : ""}{r.facultad || ""}</p>
              </div>
              <div className="ml-auto">
                <Link href={`/perfiles/${r.user_id}`} className="text-sm text-orange-400 hover:text-orange-500 underline">Ver perfil</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
