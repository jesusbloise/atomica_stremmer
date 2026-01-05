"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

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
  const router = useRouter();

  const doDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      onDeleted?.();
      router.refresh();
      setOpen(false);
    } catch {
      alert("Error eliminando el elemento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* disparador con ícono solamente */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-md border border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-500 disabled:opacity-50"
        disabled={disabled}
        aria-label="Eliminar"
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* modal de confirmación (puede seguir diciendo “Eliminar” adentro) */}
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
