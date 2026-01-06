
"use client";

import { useState, useTransition } from "react";

export default function BulkActionsBar({
  selectedIds,
  clearSelection,
  onBulkDeleted,
}: {
  selectedIds: string[];
  clearSelection: () => void;
  onBulkDeleted?: (deletedCount: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedIds.length === 0) return null;

  const doBulkDelete = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/videos/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        });

        const data = await res.json();
        onBulkDeleted?.(data.count || 0);
        clearSelection();
        setConfirmOpen(false);
      } catch {
        alert("Error en borrado masivo");
      }
    });
  };

  return (
    <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
      <div className="text-sm">{selectedIds.length} seleccionados</div>

      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1 border border-zinc-600 rounded"
          onClick={clearSelection}
          disabled={isPending}
        >
          Cancelar
        </button>

        <button
          className="px-3 py-1 border border-red-600 text-red-400 rounded hover:bg-red-600/10"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          aria-label="Eliminar seleccionados"
          title="Eliminar seleccionados"
        >
          Eliminar
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Eliminar seleccionados</h3>
            <p className="text-sm text-zinc-300 mb-4">
              Se eliminarán {selectedIds.length} elementos.
            </p>

            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded border border-zinc-600"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </button>

              <button
                className="px-3 py-1 rounded border border-red-600 text-red-400 hover:bg-red-600/10"
                onClick={doBulkDelete}
                disabled={isPending}
              >
                {isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

