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

function fixMojibake(text: string) {
  return text
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã±", "ñ")
    .replaceAll("Ã", "Á")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã", "Í")
    .replaceAll("Ã“", "Ó")
    .replaceAll("Ãš", "Ú")
    .replaceAll("Ã‘", "Ñ")
    .replaceAll("Â¡", "¡")
    .replaceAll("Â¿", "¿")
    .replaceAll("Â", "");
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
    .map((p) => ({ t: p, m: p.toLowerCase() === query.toLowerCase() }));
}

function normalizeRows(rows: Subtitulo[]) {
  const seen = new Set<string>();

  return rows
    .map((row) => ({
      ...row,
      text: fixMojibake(String(row.text || "").trim()),
      time_start: Number(row.time_start) || 0,
      time_end: Number(row.time_end) || 0,
    }))
    .filter((row) => {
      if (!row.text) return false;

      const key = `${row.time_start}-${row.time_end}-${row.text.toLowerCase()}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
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

  const cleanData = useMemo(() => normalizeRows(data || []), [data]);

  const q = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  useEffect(() => {
    if (!q) {
      if (matchIndices.length) setMatchIndices([]);
      return;
    }

    const indices: number[] = [];

    for (let i = 0; i < cleanData.length; i++) {
      const t = (cleanData[i]?.text || "").toLowerCase();
      if (t.includes(q)) indices.push(i);
    }

    const same =
      indices.length === matchIndices.length &&
      indices.every((v, i) => v === matchIndices[i]);

    if (!same) {
      setMatchIndices(indices);
      setCurrentMatchIndex(0);
    }
  }, [q, cleanData, matchIndices, setMatchIndices, setCurrentMatchIndex]);

  const activeRowIndex = useMemo(() => {
    if (!matchIndices.length) return null;
    return matchIndices[currentMatchIndex] ?? matchIndices[0] ?? null;
  }, [matchIndices, currentMatchIndex]);

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
      if (q) {
        const pos = matchIndices.indexOf(rowIndex);
        if (pos >= 0) {
          setCurrentMatchIndex(pos);
          return;
        }

        setMatchIndices([rowIndex]);
        setCurrentMatchIndex(0);
        return;
      }

      setMatchIndices([rowIndex]);
      setCurrentMatchIndex(0);
    },
    [q, matchIndices, setCurrentMatchIndex, setMatchIndices]
  );

  return (
    <div className="mb-10">
      <div className="border border-zinc-800/70 bg-black/20">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">Transcripción</div>
            <div className="text-xs text-zinc-500">
              {cleanData.length} líneas{q ? ` · ${matchIndices.length} coincidencias` : ""}
            </div>
          </div>

          <div className="text-xs text-zinc-500 tabular-nums">
            {q
              ? matchIndices.length
                ? `${currentMatchIndex + 1}/${matchIndices.length}`
                : "0/0"
              : ""}
          </div>
        </div>

        <div ref={containerRef} className="max-h-[520px] overflow-auto">
          {!cleanData.length ? (
            <div className="text-sm text-zinc-500 text-center py-10">
              No hay transcripción disponible.
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {cleanData.map((row, i) => {
                const text = row.text;
                const parts = highlightParts(text, searchTerm);
                const isActive = activeRowIndex === i;
                const isMatch = matchIndices.includes(i);

                return (
                  <div
                    key={`${row.time_start}-${row.time_end}-${i}`}
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

                      <div className="shrink-0 w-[70px] text-xs text-zinc-500 tabular-nums">
                        {formatTime(row.time_start)}
                      </div>

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

                    <div className="mt-1 pl-[82px] text-[11px] text-zinc-600 opacity-0 group-hover:opacity-100 transition">
                      Click para saltar al tiempo
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {q && (
          <div className="px-4 py-3 border-t border-zinc-900 text-xs text-zinc-600">
            Enter avanza coincidencias · Shift+Enter retrocede
          </div>
        )}
      </div>
    </div>
  );
}