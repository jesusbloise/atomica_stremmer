// SUBCOMPONENTE: DeleteVideoButton
// Propósito: Botón (icon-only) para eliminar un archivo individual con confirmación.
// Props:
//  - id: string        -> id del archivo
//  - nombre?: string   -> nombre visible en el modal
//  - onDeleted?: () => void -> callback tras eliminar (para limpiar estado en el padre)
//  - disabled?: boolean -> deshabilitar botón (ej. en modo selección)
// Flujo:
//  click ícono → modal → confirmar → DELETE /api/videos/[id] → onDeleted() → cerrar.

// SUBCOMPONENTE: DeleteVideoButton
// Ahora: solo ADMIN ve el botón (se oculta para ESTUDIANTE/otros)

"use client";

import { useEffect, useState } from "react";

type Role = "ADMIN" | "PROFESOR" | "ESTUDIANTE";

export default function DeleteVideoButton({
  id,
  nombre,
  onDeleted,
  disabled = false,
}: {
  id: string;
  nombre?: string;
  onDeleted?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔐 rol de sesión
  const [role, setRole] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const s = await r.json(); // puede ser null
        if (alive) setRole((s?.role as Role) ?? null);
      } catch {
        if (alive) setRole(null);
      } finally {
        if (alive) setLoadingRole(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const doDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      onDeleted?.();
      setOpen(false);
    } catch {
      alert("Error eliminando el elemento.");
    } finally {
      setLoading(false);
    }
  };

  // ⛔ Mientras carga el rol, no renderizamos (evita parpadeo)
  if (loadingRole) return null;

  // ⛔ Si NO es admin, no mostrar el botón ni el modal
  if (role !== "ADMIN") return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-md border border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-500 disabled:opacity-50"
        disabled={disabled}
        aria-label="Eliminar"
        title="Eliminar"
      >
        {/* SVG de basurero */}
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Eliminar</h3>
            <p className="text-sm text-zinc-300 mb-4">
              {nombre ? `¿Eliminar “${nombre}”?` : "¿Eliminar este elemento?"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded border border-zinc-600"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={doDelete}
                className="px-3 py-1 rounded border border-red-600 text-red-400 hover:bg-red-600/10 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// "use client";

// import { useState } from "react";

// export default function DeleteVideoButton({
//   id,
//   nombre,
//   onDeleted,
//   disabled = false,
// }: {
//   id: string;
//   nombre?: string;
//   onDeleted?: () => void;
//   disabled?: boolean;
// }) {
//   const [open, setOpen] = useState(false);
//   const [loading, setLoading] = useState(false);

//   const doDelete = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
//       if (!res.ok) throw new Error("No se pudo eliminar");
//       onDeleted?.();
//       setOpen(false);
//     } catch {
//       alert("Error eliminando el elemento.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <button
//         onClick={() => setOpen(true)}
//         className="p-2 rounded-md border border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-500 disabled:opacity-50"
//         disabled={disabled}
//         aria-label="Eliminar"
//         title="Eliminar"
//       >
//         {/* SVG de basurero */}
//         <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//           <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
//           <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
//           <path d="M10 11v6"/><path d="M14 11v6"/>
//         </svg>
//       </button>

//       {open && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
//           <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-lg p-4">
//             <h3 className="text-lg font-semibold mb-2">Eliminar</h3>
//             <p className="text-sm text-zinc-300 mb-4">
//               {nombre ? `¿Eliminar “${nombre}”?` : "¿Eliminar este elemento?"}
//             </p>
//             <div className="flex justify-end gap-2">
//               <button
//                 onClick={() => setOpen(false)}
//                 className="px-3 py-1 rounded border border-zinc-600"
//                 disabled={loading}
//               >
//                 Cancelar
//               </button>
//               <button
//                 onClick={doDelete}
//                 className="px-3 py-1 rounded border border-red-600 text-red-400 hover:bg-red-600/10 disabled:opacity-50"
//                 disabled={loading}
//               >
//                 {loading ? "Eliminando..." : "Eliminar"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }
