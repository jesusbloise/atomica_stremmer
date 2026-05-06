"use client";

import React, { useEffect, useMemo, useRef, useCallback } from "react";

type Subtitulo = {
  time_start: number;
  time_end: number;
  text: string;
  [k: string]: any;
};

type Props = {
  data: Subtitulo[];
  searchTerm: string;
  matchIndices: number[];
  currentMatchIndex: number;
  setMatchIndices: (v: number[]) => void;
  setCurrentMatchIndex: (n: number) => void;
};

function pad2(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${pad2(mm)}:${pad2(ss)}`;
  return `${mm}:${pad2(ss)}`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightParts(text: string, q: string) {
  const query = q.trim();
  if (!query) return [{ t: text, m: false }];

  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(re);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ t: p, m: re.test(p) }));
}

export default function TablaSubtitulos({
  data,
  searchTerm,
  matchIndices,
  currentMatchIndex,
  setMatchIndices,
  setCurrentMatchIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const q = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  // Recalcula matches cuando cambia el searchTerm
 useEffect(() => {
  if (!q) {
    if (matchIndices.length) setMatchIndices([]);
    return;
  }

  const indices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const t = (data[i]?.text || "").toLowerCase();
    if (t.includes(q)) indices.push(i);
  }

  const same =
    indices.length === matchIndices.length &&
    indices.every((v, i) => v === matchIndices[i]);

  if (!same) {
    setMatchIndices(indices);
    setCurrentMatchIndex(0);
  }
}, [q, data.length, matchIndices, setMatchIndices, setCurrentMatchIndex]);

  const activeRowIndex = useMemo(() => {
    if (!matchIndices.length) return null;
    return matchIndices[currentMatchIndex] ?? matchIndices[0] ?? null;
  }, [matchIndices, currentMatchIndex]);

  // Scroll suave al match activo
  useEffect(() => {
    if (activeRowIndex == null) return;
    const el = rowRefs.current[activeRowIndex];
    const root = containerRef.current;
    if (!el || !root) return;

    const elRect = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    const topVisible = elRect.top >= rootRect.top + 12;
    const bottomVisible = elRect.bottom <= rootRect.bottom - 12;

    if (!topVisible || !bottomVisible) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeRowIndex]);

  const handleClickRow = useCallback(
    (rowIndex: number) => {
      // Si hay búsqueda activa, sincroniza al match correspondiente
      if (q) {
        const pos = matchIndices.indexOf(rowIndex);
        if (pos >= 0) {
          setCurrentMatchIndex(pos);
          return;
        }
        // si el click cae fuera de matches pero hay q, hacemos que ese row sea el único match
        setMatchIndices([rowIndex]);
        setCurrentMatchIndex(0);
        return;
      }

      // Si NO hay búsqueda, igual queremos que el click haga "jump":
      // el parent solo hace jump cuando matchIndices tiene algo,
      // así que seteamos el row como match único.
      setMatchIndices([rowIndex]);
      setCurrentMatchIndex(0);
    },
    [q, matchIndices, setCurrentMatchIndex, setMatchIndices]
  );

  return (
    <div className="mb-10">
      {/* Contenedor minimal (sin burbujas, sin tabla) */}
      <div className="border border-zinc-800/70 bg-black/20">
        {/* Header discreto */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">Transcripción</div>
            <div className="text-xs text-zinc-500">
              {data.length} líneas{q ? ` · ${matchIndices.length} coincidencias` : ""}
            </div>
          </div>

          <div className="text-xs text-zinc-500 tabular-nums">
            {q ? (matchIndices.length ? `${currentMatchIndex + 1}/${matchIndices.length}` : "0/0") : ""}
          </div>
        </div>

        {/* Lista */}
        <div ref={containerRef} className="max-h-[520px] overflow-auto">
          {!data.length ? (
            <div className="text-sm text-zinc-500 text-center py-10">
              No hay transcripción disponible.
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {data.map((row, i) => {
                const text = (row.text || "").trim();
                if (!text) return null;

                const parts = highlightParts(text, searchTerm);
                const isActive = activeRowIndex === i;
                const isMatch = matchIndices.includes(i);

                return (
                  <div
                    key={`row-${i}`}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    onClick={() => handleClickRow(i)}
                    className={[
                      "group cursor-pointer px-4 py-3 transition",
                      "hover:bg-zinc-950/40",
                      isActive ? "bg-zinc-950/55" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      {/* Indicador ultra sutil */}
                      <div className="mt-1 w-2 shrink-0">
                        <div
                          className={[
                            "h-4 w-[2px] rounded-full transition-opacity",
                            isActive
                              ? "bg-yellow-400/80 opacity-100"
                              : isMatch
                              ? "bg-zinc-600/70 opacity-70 group-hover:opacity-90"
                              : "bg-transparent opacity-0 group-hover:opacity-40",
                          ].join(" ")}
                        />
                      </div>

                      {/* Tiempo */}
                      <div className="shrink-0 w-[70px] text-xs text-zinc-500 tabular-nums">
                        {formatTime(Number(row.time_start) || 0)}
                      </div>

                      {/* Texto “flotante” */}
                      <div className="text-sm leading-6 text-zinc-200">
                        {parts.map((p, pi) =>
                          p.m ? (
                            <mark
                              key={`m-${i}-${pi}`}
                              className="rounded px-1 bg-yellow-300/10 text-yellow-200"
                            >
                              {p.t}
                            </mark>
                          ) : (
                            <span key={`t-${i}-${pi}`}>{p.t}</span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Hint sutil */}
                    <div className="mt-1 pl-[82px] text-[11px] text-zinc-600 opacity-0 group-hover:opacity-100 transition">
                      Click para saltar al tiempo
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer súper discreto */}
        {q && (
          <div className="px-4 py-3 border-t border-zinc-900 text-xs text-zinc-600">
            Enter avanza coincidencias · Shift+Enter retrocede
          </div>
        )}
      </div>
    </div>
  );
}



// "use client";

// import React, { useEffect, useRef } from "react";

// type Subtitulo = {
//   time_start: number;
//   time_end: number;
//   text: string;
// };

// type Props = {
//   data: Subtitulo[];
//   searchTerm?: string;
//   matchIndices?: number[];
//   currentMatchIndex?: number;
//   setMatchIndices?: React.Dispatch<React.SetStateAction<number[]>>;
//   setCurrentMatchIndex?: React.Dispatch<React.SetStateAction<number>>;
//   autoScrollOnMatch?: boolean; // 👈 NUEVO
// };

// export default function TablaSubtitulos({
//   data,
//   searchTerm = "",
//   matchIndices = [],
//   currentMatchIndex = 0,
//   setMatchIndices,
//   setCurrentMatchIndex,
//   autoScrollOnMatch = true, // 👈 por defecto scroll activo
// }: Props) {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

//   // recalcular matches cuando cambia searchTerm
//   useEffect(() => {
//     if (!searchTerm.trim()) {
//       setMatchIndices?.([]);
//       return;
//     }

//     const indices: number[] = [];
//     data.forEach((sub, i) => {
//       if (sub.text.toLowerCase().includes(searchTerm.toLowerCase())) {
//         indices.push(i);
//       }
//     });
//     setMatchIndices?.(indices);
//   }, [searchTerm, data, setMatchIndices]);

//   // scroll hacia coincidencia activa
// // scroll hacia coincidencia activa SOLO dentro del contenedor (sin mover la página)
// useEffect(() => {
//   if (matchIndices.length === 0) return;
//   const container = containerRef.current;
//   const row = rowRefs.current[matchIndices[currentMatchIndex]];
//   if (!container || !row) return;

//   // centra la fila dentro del contenedor
//   const rowTop = row.offsetTop;               // posición de la fila respecto al contenedor
//   const rowH = row.offsetHeight;
//   const targetTop = Math.max(0, rowTop - (container.clientHeight - rowH) / 2);

//   container.scrollTo({ top: targetTop, behavior: "smooth" });
// }, [currentMatchIndex, matchIndices]);


//   const resaltarCoincidencia = (texto: string) => {
//     if (!searchTerm.trim()) return texto;
//     const partes = texto.split(new RegExp(`(${searchTerm})`, "gi"));

//     return partes.map((parte, i) =>
//       parte.toLowerCase() === searchTerm.toLowerCase() ? (
//         <mark key={i} className="bg-yellow-300 text-black px-1 rounded">
//           {parte}
//         </mark>
//       ) : (
//         <React.Fragment key={i}>{parte}</React.Fragment>
//       )
//     );
//   };

//   function formatTime(seconds: number): string {
//     const mins = Math.floor(seconds / 60);
//     const secs = Math.floor(seconds % 60);
//     return `${mins}:${secs.toString().padStart(2, "0")}`;
//   }

//   if (!data || data.length === 0) return null;

//   return (
//     <div className="mt-8">
//       <h2 className="font-bold mb-4 text-sm text-gray-300 text-center">
//         Tabla de subtítulos detectados
//       </h2>
//       <div className="border border-zinc-700 rounded-lg overflow-hidden shadow">
//         <table className="w-full table-fixed text-xs text-left border-collapse">
//           <thead className="bg-zinc-800 text-gray-400 uppercase text-[11px]">
//             <tr>
//               <th className="px-3 py-2 w-24">Inicio</th>
//               <th className="px-3 py-2 w-24">Fin</th>
//               <th className="px-3 py-2">Texto</th>
//             </tr>
//           </thead>
//         </table>
//         <div ref={containerRef} className="max-h-60 overflow-y-auto bg-zinc-900">
//           <table className="w-full table-fixed text-xs text-left">
//             <tbody>
//               {data.map((sub, idx) => (
//                 <tr
//                   key={idx}
//                   ref={(el: HTMLTableRowElement | null) => {
//                     rowRefs.current[idx] = el;
//                   }}
//                   className={`border-t border-zinc-800 transition ${
//                     matchIndices.includes(idx)
//                       ? idx === matchIndices[currentMatchIndex]
//                         ? "bg-yellow-500/20"
//                         : "bg-zinc-800"
//                       : "hover:bg-zinc-800"
//                   }`}
//                 >
//                   <td
//                     className="px-3 py-2 text-gray-400 w-24"
//                     title={`${sub.time_start.toFixed(2)}s`}
//                   >
//                     {formatTime(sub.time_start)}
//                   </td>
//                   <td
//                     className="px-3 py-2 text-gray-400 w-24"
//                     title={`${sub.time_end.toFixed(2)}s`}
//                   >
//                     {formatTime(sub.time_end)}
//                   </td>
//                   <td className="px-3 py-2 text-gray-100">
//                     {resaltarCoincidencia(sub.text)}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

