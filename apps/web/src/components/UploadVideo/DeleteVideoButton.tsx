"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const s = await r.json();
        if (alive) setRole((s?.role as Role) ?? null);
      } catch {
        if (alive) setRole(null);
      } finally {
        if (alive) setLoadingRole(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const doDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");

      onDeleted?.();
      router.refresh(); // ✅ refresca lista si aplica
      setOpen(false);
    } catch {
      alert("Error eliminando el elemento.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole) return null;
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
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

