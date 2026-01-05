"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  texto: string;
  searchTerm: string;
  url?: string | null;
  matchIndices: number[];
  currentMatchIndex: number;
  setMatchIndices: React.Dispatch<React.SetStateAction<number[]>>;
  setCurrentMatchIndex: React.Dispatch<React.SetStateAction<number>>;
};

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default function TablaDocumento({
  texto,
  searchTerm,
  url,
  matchIndices,
  currentMatchIndex,
  setMatchIndices,
  setCurrentMatchIndex,
}: Props) {
  const lineas = useMemo(
    () =>
      texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [texto]
  );

  const totalLineas = lineas.length;
  const lineasPorPagina = 40;
  const paginasEstimadas = Math.ceil(totalLineas / lineasPorPagina);
  const resumen = lineas.slice(0, 3).join(" ");

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = useMemo(() => {
    if (!searchTerm) return null;
    return new RegExp(`(${escapeRegExp(searchTerm)})`, "gi");
  }, [searchTerm]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { rows, indices } = useMemo(() => {
    let globalMatchCounter = 0;
    const newIndices: number[] = [];

    const built = lineas.map((linea, idxLinea) => {
      const lineaNumero = idxLinea + 1;
      const paginaNumero = Math.floor(idxLinea / lineasPorPagina) + 1;

      if (!regex) {
        return (
          <tr key={idxLinea} className="odd:bg-zinc-800 even:bg-zinc-900">
            <td className="px-3 py-2 border-b border-zinc-700">{lineaNumero}</td>
            <td className="px-3 py-2 border-b border-zinc-700">{paginaNumero}</td>
            <td className="px-3 py-2 border-b border-zinc-700">{linea}</td>
          </tr>
        );
      }

      const parts = linea.split(regex);
      if (parts.length === 1) {
        return (
          <tr key={idxLinea} className="odd:bg-zinc-800 even:bg-zinc-900">
            <td className="px-3 py-2 border-b border-zinc-700">{lineaNumero}</td>
            <td className="px-3 py-2 border-b border-zinc-700">{paginaNumero}</td>
            <td className="px-3 py-2 border-b border-zinc-700">{linea}</td>
          </tr>
        );
      }

      const content = parts.map((part, i) => {
        const isMatch = !!searchTerm && part.toLowerCase() === searchTerm.toLowerCase();
        if (!isMatch) return <span key={i}>{part}</span>;

        const thisMatchIndex = globalMatchCounter++;
        newIndices.push(thisMatchIndex);

        const spanId = `doc-match-${thisMatchIndex}`;
        const active = thisMatchIndex === currentMatchIndex;

        return (
          <span
            id={spanId}
            key={i}
            className={active ? "bg-yellow-400 text-black px-0.5 rounded"
                              : "bg-yellow-300 text-black px-0.5 rounded"}
          >
            {part}
          </span>
        );
      });

      return (
        <tr key={idxLinea} className="odd:bg-zinc-800 even:bg-zinc-900">
          <td className="px-3 py-2 border-b border-zinc-700">{lineaNumero}</td>
          <td className="px-3 py-2 border-b border-zinc-700">{paginaNumero}</td>
          <td className="px-3 py-2 border-b border-zinc-700">{content}</td>
        </tr>
      );
    });

    return { rows: built, indices: newIndices };
  }, [lineas, regex, searchTerm, currentMatchIndex]);

  useEffect(() => {
    if (!regex) {
      if (matchIndices.length) setMatchIndices([]);
      return;
    }
    if (!arraysEqual(indices, matchIndices)) {
      setMatchIndices(indices);
      if (indices.length > 0 && currentMatchIndex >= indices.length) {
        setCurrentMatchIndex(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indices, regex]);

  useEffect(() => {
    if (!matchIndices.length) return;
    const id = `doc-match-${currentMatchIndex}`;
    const el = document.getElementById(id);
    if (!el) return;

    const container = scrollContainerRef.current;
    if (container) {
      const elRect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      const topDelta = elRect.top - cRect.top - container.clientHeight / 2 + elRect.height / 2;
      container.scrollBy({ top: topDelta, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentMatchIndex, matchIndices.length]);

  return (
    <div className="mt-6 border rounded bg-zinc-800 border-zinc-700 text-white p-4">
      {/* Resumen */}
      <div className="mb-6">
        <h3 className="text-lg font-bold mb-2">Resumen del Documento</h3>
        <ul className="list-disc pl-5 text-sm text-zinc-300">
          <li><strong>Líneas:</strong> {totalLineas}</li>
          <li><strong>Páginas (estimadas):</strong> {paginasEstimadas}</li>
          <li><strong>Resumen:</strong> {resumen || "No disponible"}</li>
        </ul>
      </div>

      {/* Navegación entre coincidencias */}
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
        <span>
          Coincidencias: {matchIndices.length ? `${currentMatchIndex + 1}/${matchIndices.length}` : "0/0"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!matchIndices.length) return;
            const prev = (currentMatchIndex - 1 + matchIndices.length) % matchIndices.length;
            setCurrentMatchIndex(prev);
          }}
          className="px-2 py-1 rounded border border-zinc-600 hover:bg-zinc-700"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => {
            if (!matchIndices.length) return;
            const next = (currentMatchIndex + 1) % matchIndices.length;
            setCurrentMatchIndex(next);
          }}
          className="px-2 py-1 rounded border border-zinc-600 hover:bg-zinc-700"
        >
          Siguiente
        </button>
        <span className="ml-auto text-zinc-500">
          Enter: siguiente — Shift+Enter: anterior
        </span>
      </div>

      {/* Tabla de líneas */}
      <div ref={scrollContainerRef} className="overflow-y-auto max-h-[400px] border rounded">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 border-b border-zinc-700">Línea</th>
              <th className="text-left px-3 py-2 border-b border-zinc-700">Página</th>
              <th className="text-left px-3 py-2 border-b border-zinc-700">Texto</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

