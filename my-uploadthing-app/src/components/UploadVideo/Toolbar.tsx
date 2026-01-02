// SUBCOMPONENTE: Toolbar
// Propósito: Buscador + botón de filtros (dropdown interno) + toggle de selección múltiple.
// Props:
//  - searchTerm: string
//  - onSearchChange: (v:string) => void
//  - selectionMode: boolean
//  - onToggleSelection: () => void
//  - onApplyFilter: (key: "con_subtitulos" | "sin_subtitulos" | "hoy" | null) => void

"use client";

import { useState } from "react";
import type { FilterKey } from "./types";

export default function Toolbar({
  searchTerm,
  onSearchChange,
  selectionMode,
  onToggleSelection,
  onApplyFilter,
}: {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  selectionMode: boolean;
  onToggleSelection: () => void;
  onApplyFilter: (key: FilterKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex justify-center gap-4 px-4 sm:px-8 relative">
      <input
        type="text"
        placeholder="Buscar por nombre, subtítulos o texto..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full max-w-screen-md bg-zinc-800 text-white border border-zinc-600 rounded p-2 mb-6"
      />

      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-orange-400 hover:text-orange-500 border border-orange-400 hover:border-orange-500 px-3 py-2 rounded h-fit mt-1"
      >
        Filtros
      </button>

      <button
        onClick={onToggleSelection}
        className={`text-xs px-3 py-2 rounded h-fit mt-1 border ${
          selectionMode
            ? "text-red-400 border-red-500 hover:text-red-300 hover:border-red-400"
            : "text-zinc-300 border-zinc-500 hover:text-white hover:border-zinc-300"
        }`}
        title={selectionMode ? "Salir de selección" : "Seleccionar varios"}
      >
        {selectionMode ? "Cancelar selección" : "Seleccionar"}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded shadow text-sm z-10 w-60">
          <button
            onClick={() => { onApplyFilter("con_subtitulos"); setOpen(false); }}
            className="block w-full text-left px-4 py-2 hover:bg-zinc-700"
          >
            Con subtítulos
          </button>
          <button
            onClick={() => { onApplyFilter("sin_subtitulos"); setOpen(false); }}
            className="block w-full text-left px-4 py-2 hover:bg-zinc-700"
          >
            Sin subtítulos
          </button>
          <button
            onClick={() => { onApplyFilter("hoy"); setOpen(false); }}
            className="block w-full text-left px-4 py-2 hover:bg-zinc-700"
          >
            Subidos hoy
          </button>
          <button
            onClick={() => { onApplyFilter(null); setOpen(false); }}
            className="block w-full text-left px-4 py-2 text-red-400 hover:bg-zinc-700"
          >
            Resetear filtros
          </button>
        </div>
      )}
    </div>
  );
}
