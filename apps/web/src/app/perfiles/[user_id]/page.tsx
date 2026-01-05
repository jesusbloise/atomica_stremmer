"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Participacion = { fecha?: string; nombre?: string; miniatura?: string; ruta?: string };
type Perfil = {
  user_id: string; name: string; email: string;
  generacion?: string; facultad?: string; descripcion?: string;
  avatar_url?: string | null;
  instagram?: string; facebook?: string; whatsapp?: string;
  participaciones?: Participacion[];
};

export default function PerfilPublicPage({ params }: { params: { user_id: string } }) {
  const [data, setData] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/perfiles/${params.user_id}`, { cache: "no-store" });
      if (res.ok) {
        const row = await res.json();
        if (!Array.isArray(row.participaciones)) row.participaciones = [];
        setData(row);
      }
      setLoading(false);
    })();
  }, [params.user_id]);

  if (loading) return <div className="p-6 text-zinc-400">Cargando…</div>;
  if (!data)   return <div className="p-6 text-zinc-400">Perfil no encontrado</div>;

  return (
    <div className="p-6 text-white">
      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
          {data.avatar_url ? (
            <Image src={data.avatar_url} alt={data.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full grid place-items-center text-xs text-zinc-400">Sin foto</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-zinc-400">{data.email}</p>
          <p className="text-sm text-zinc-500">
            {data.generacion ? `Generación ${data.generacion} · ` : ""}{data.facultad || ""}
          </p>
          {data.descripcion && (
            <p className="mt-3 text-zinc-200 whitespace-pre-wrap">{data.descripcion}</p>
          )}
          <div className="mt-4 flex gap-3 text-sm">
            {data.instagram && <a className="text-orange-400 hover:text-orange-500 underline" href={data.instagram} target="_blank">Instagram</a>}
            {data.facebook  && <a className="text-orange-400 hover:text-orange-500 underline" href={data.facebook}  target="_blank">Facebook</a>}
            {data.whatsapp  && <a className="text-orange-400 hover:text-orange-500 underline" href={`https://wa.me/${data.whatsapp.replace(/\D/g,"")}`} target="_blank">WhatsApp</a>}
          </div>
        </div>
      </div>

      {/* Participaciones */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Participaciones</h2>
        {!data.participaciones?.length ? (
          <p className="text-zinc-400">Sin participaciones registradas.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.participaciones.map((p, i) => (
              <li key={i} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <div className="flex gap-3">
                  <div className="relative w-24 h-16 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                    {p.miniatura ? (
                      <Image src={p.miniatura} alt={p.nombre || "miniatura"} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[11px] text-zinc-400">Sin imagen</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.nombre || "—"}</p>
                    <p className="text-xs text-zinc-500">{p.fecha || "—"}</p>
                    {p.ruta ? (
                      <Link className="text-xs text-orange-400 hover:text-orange-500 underline" href={p.ruta} target="_blank">
                        Abrir proyecto
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-500">Sin ruta</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


// "use client";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// type Participacion = { fecha?: string; nombre?: string; miniatura?: string; ruta?: string };
// type Perfil = {
//   user_id: string; name: string; email: string; role?: string;
//   generacion?: string; facultad?: string; descripcion?: string;
//   avatar_url?: string | null; instagram?: string; facebook?: string; whatsapp?: string;
//   participaciones?: Participacion[];
// };

// export default function PerfilDetail({ params }: { params: { user_id: string } }) {
//   const [data, setData] = useState<Perfil | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch(`/api/perfiles/${params.user_id}`, { cache: "no-store" });
//         if (res.ok) setData(await res.json());
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [params.user_id]);

//   if (loading) return <div className="p-6 text-zinc-400">Cargando…</div>;
//   if (!data) return <div className="p-6 text-zinc-400">Perfil no encontrado</div>;

//   return (
//     <div className="p-6 text-white">
//       <div className="flex items-start gap-6">
//         <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
//           {data.avatar_url ? <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-xs text-zinc-400">Sin foto</div>}
//         </div>

//         <div className="flex-1 min-w-0">
//           <h1 className="text-2xl font-bold">{data.name}</h1>
//           <p className="text-sm text-zinc-400">{data.email}</p>
//           <p className="text-sm text-zinc-500">{data.generacion ? `Generación ${data.generacion} · ` : ""}{data.facultad || ""}</p>
//           {data.descripcion && <p className="mt-3 text-zinc-200 whitespace-pre-wrap">{data.descripcion}</p>}
//           <div className="mt-4 flex gap-3 text-sm">
//             {data.instagram && <a className="text-orange-400 hover:text-orange-500 underline" href={data.instagram} target="_blank">Instagram</a>}
//             {data.facebook && <a className="text-orange-400 hover:text-orange-500 underline" href={data.facebook} target="_blank">Facebook</a>}
//             {data.whatsapp && <a className="text-orange-400 hover:text-orange-500 underline" href={`https://wa.me/${data.whatsapp.replace(/\D/g,"")}`} target="_blank">WhatsApp</a>}
//           </div>
//         </div>
//       </div>

//       <div className="mt-8">
//         <h2 className="text-xl font-semibold mb-3">Participaciones</h2>
//         {!data.participaciones?.length ? (
//           <p className="text-zinc-400">Sin participaciones registradas.</p>
//         ) : (
//           <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
//             {data.participaciones.map((p, i) => (
//               <li key={i} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
//                 <div className="flex gap-3">
//                   <div className="relative w-24 h-16 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
//                     {p.miniatura ? <img src={p.miniatura} alt={p.nombre || "miniatura"} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[11px] text-zinc-400">Sin imagen</div>}
//                   </div>
//                   <div className="min-w-0">
//                     <p className="font-semibold truncate">{p.nombre || "—"}</p>
//                     <p className="text-xs text-zinc-500">{p.fecha || "—"}</p>
//                     {p.ruta ? <Link className="text-xs text-orange-400 hover:text-orange-500 underline" href={p.ruta} target="_blank">Abrir proyecto</Link> : <span className="text-xs text-zinc-500">Sin ruta</span>}
//                   </div>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// }
