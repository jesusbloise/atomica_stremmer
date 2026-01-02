"use client";
import { useEffect, useState } from "react";

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto max-w-3xl rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

type Perfil = {
  user_id: string; name: string; email: string;
  generacion?: string; facultad?: string; descripcion?: string;
  avatar_url?: string | null; instagram?: string; facebook?: string; whatsapp?: string;
  participaciones?: { fecha?: string; nombre?: string; miniatura?: string; ruta?: string }[];
};

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function PerfilModal({ params }: { params: { user_id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<Perfil | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/perfiles/${params.user_id}`, { cache: "no-store" });
      if (res.ok) {
        const row = await res.json();
        if (!Array.isArray(row.participaciones)) row.participaciones = [];
        setData(row);
      }
    })();
  }, [params.user_id]);

  const close = () => router.back();

  if (!data) return null;

  return (
    <Modal onClose={close}>
      <div className="flex items-start gap-4">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
          {data.avatar_url ? (
            <Image src={data.avatar_url} alt={data.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full grid place-items-center text-xs text-zinc-400">Sin foto</div>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-white">{data.name}</h2>
          <p className="text-xs text-zinc-400">{data.email}</p>
          <p className="text-xs text-zinc-500">{data.generacion ? `Gen. ${data.generacion} · ` : ""}{data.facultad || ""}</p>
          {data.descripcion && <p className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">{data.descripcion}</p>}
          <div className="mt-3 flex gap-3 text-xs">
            {data.instagram && <a className="text-orange-400 hover:text-orange-500 underline" href={data.instagram} target="_blank">Instagram</a>}
            {data.facebook  && <a className="text-orange-400 hover:text-orange-500 underline" href={data.facebook}  target="_blank">Facebook</a>}
            {data.whatsapp  && <a className="text-orange-400 hover:text-orange-500 underline" href={`https://wa.me/${data.whatsapp.replace(/\D/g,"")}`} target="_blank">WhatsApp</a>}
          </div>
          <div className="mt-4">
            <Link href={`/perfiles/${data.user_id}`} className="text-xs text-orange-400 underline">
              Ver perfil completo
            </Link>
          </div>
        </div>
        <button onClick={close} className="ml-auto px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs">Cerrar</button>
      </div>
    </Modal>
  );
}
