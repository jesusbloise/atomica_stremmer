"use client";

import React, { useEffect, useRef } from "react";

type Subtitulo = {
  time_start: number;
  time_end: number;
  text: string;
};

type Props = {
  data: Subtitulo[];
  searchTerm?: string;
  matchIndices?: number[];
  currentMatchIndex?: number;
  setMatchIndices?: React.Dispatch<React.SetStateAction<number[]>>;
  setCurrentMatchIndex?: React.Dispatch<React.SetStateAction<number>>;
  autoScrollOnMatch?: boolean; // 👈 NUEVO
};

export default function TablaSubtitulos({
  data,
  searchTerm = "",
  matchIndices = [],
  currentMatchIndex = 0,
  setMatchIndices,
  setCurrentMatchIndex,
  autoScrollOnMatch = true, // 👈 por defecto scroll activo
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // recalcular matches cuando cambia searchTerm
  useEffect(() => {
    if (!searchTerm.trim()) {
      setMatchIndices?.([]);
      return;
    }

    const indices: number[] = [];
    data.forEach((sub, i) => {
      if (sub.text.toLowerCase().includes(searchTerm.toLowerCase())) {
        indices.push(i);
      }
    });
    setMatchIndices?.(indices);
  }, [searchTerm, data, setMatchIndices]);

  // scroll hacia coincidencia activa
// scroll hacia coincidencia activa SOLO dentro del contenedor (sin mover la página)
useEffect(() => {
  if (matchIndices.length === 0) return;
  const container = containerRef.current;
  const row = rowRefs.current[matchIndices[currentMatchIndex]];
  if (!container || !row) return;

  // centra la fila dentro del contenedor
  const rowTop = row.offsetTop;               // posición de la fila respecto al contenedor
  const rowH = row.offsetHeight;
  const targetTop = Math.max(0, rowTop - (container.clientHeight - rowH) / 2);

  container.scrollTo({ top: targetTop, behavior: "smooth" });
}, [currentMatchIndex, matchIndices]);


  const resaltarCoincidencia = (texto: string) => {
    if (!searchTerm.trim()) return texto;
    const partes = texto.split(new RegExp(`(${searchTerm})`, "gi"));

    return partes.map((parte, i) =>
      parte.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300 text-black px-1 rounded">
          {parte}
        </mark>
      ) : (
        <React.Fragment key={i}>{parte}</React.Fragment>
      )
    );
  };

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (!data || data.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="font-bold mb-4 text-sm text-gray-300 text-center">
        Tabla de subtítulos detectados
      </h2>
      <div className="border border-zinc-700 rounded-lg overflow-hidden shadow">
        <table className="w-full table-fixed text-xs text-left border-collapse">
          <thead className="bg-zinc-800 text-gray-400 uppercase text-[11px]">
            <tr>
              <th className="px-3 py-2 w-24">Inicio</th>
              <th className="px-3 py-2 w-24">Fin</th>
              <th className="px-3 py-2">Texto</th>
            </tr>
          </thead>
        </table>
        <div ref={containerRef} className="max-h-60 overflow-y-auto bg-zinc-900">
          <table className="w-full table-fixed text-xs text-left">
            <tbody>
              {data.map((sub, idx) => (
                <tr
                  key={idx}
                  ref={(el: HTMLTableRowElement | null) => {
                    rowRefs.current[idx] = el;
                  }}
                  className={`border-t border-zinc-800 transition ${
                    matchIndices.includes(idx)
                      ? idx === matchIndices[currentMatchIndex]
                        ? "bg-yellow-500/20"
                        : "bg-zinc-800"
                      : "hover:bg-zinc-800"
                  }`}
                >
                  <td
                    className="px-3 py-2 text-gray-400 w-24"
                    title={`${sub.time_start.toFixed(2)}s`}
                  >
                    {formatTime(sub.time_start)}
                  </td>
                  <td
                    className="px-3 py-2 text-gray-400 w-24"
                    title={`${sub.time_end.toFixed(2)}s`}
                  >
                    {formatTime(sub.time_end)}
                  </td>
                  <td className="px-3 py-2 text-gray-100">
                    {resaltarCoincidencia(sub.text)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

