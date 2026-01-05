// Hook personalizado para obtener subtítulos de un video por polling.
// - Llama periódicamente al endpoint de subtítulos.
// - Devuelve el array de subtítulos, estado de polling y funciones start/stop.
// - Normaliza cada fila con __startSec (segundos) para facilitar el seek del video.
// - Se limpia automáticamente al desmontar el componente.

"use client";
import { useEffect, useRef, useState } from "react";

type AnyRow = Record<string, any>;

function parseHMS(str: string): number | null {
  // Soporta HH:MM:SS(.mmm) o MM:SS(.mmm)
  const s = str.trim();

  // HH:MM:SS(.mmm)
  let m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (m) {
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    const ms = m[4] ? parseInt(m[4].padEnd(3, "0"), 10) : 0;
    return hh * 3600 + mm * 60 + ss + ms / 1000;
  }

  // MM:SS(.mmm)
  m = s.match(/^(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const ss = parseInt(m[2], 10);
    const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
    return mm * 60 + ss + ms / 1000;
  }

  return null;
}

function toSeconds(row: AnyRow): number | null {
  // Campos que podrían venir del backend
  const candidates = [
    row?.start_s,
    row?.start_sec,
    row?.start_seconds,
    row?.startSeconds,
    row?.start_ms,            // milisegundos
    row?.start_msec,          // milisegundos
    row?.start,               // string HH:MM:SS.mmm o número
    row?.inicio,              // por si acaso
    row?.time,                // por si acaso
  ];

  for (const val of candidates) {
    if (val == null) continue;

    // numérico
    if (typeof val === "number") {
      // si parece ms (muy grande), convertir
      return val > 10_000 ? val / 1000 : val;
    }

    if (typeof val === "string") {
      // intentar HH:MM:SS(.mmm) o MM:SS(.mmm)
      const h = parseHMS(val);
      if (h != null) return h;

      // intentar como número
      const asNum = Number(val);
      if (!Number.isNaN(asNum)) {
        return asNum > 10_000 ? asNum / 1000 : asNum;
      }
    }
  }

  return null;
}

function normalizeRow(row: AnyRow): AnyRow {
  // añade __startSec sin tocar tus campos originales
  const sec = toSeconds(row);
  if (typeof row?.__startSec === "number") return row; // ya normalizado
  return { ...row, __startSec: sec ?? null };
}

export function useSubtitlesPolling(id: string | null) {
  const [subtitulos, _setSubtitulos] = useState<AnyRow[]>([]);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Reemplazo drop-in: mismo nombre, pero normaliza antes de guardar
  const setSubtitulos = (rows: AnyRow[]) => {
    const norm = Array.isArray(rows) ? rows.map(normalizeRow) : [];
    _setSubtitulos(norm);
  };

  const getStartSecFor = (index: number): number | null => {
    const r = subtitulos[index];
    if (!r) return null;
    const v = typeof r.__startSec === "number" ? r.__startSec : toSeconds(r);
    return v ?? null;
  };

  const start = () => {
    if (!id || polling) return;
    setPolling(true);
    // @ts-ignore
    intervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/subtitulos/${id}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          stop();
          setSubtitulos(data); // 👈 normaliza aquí
          setPolling(false);
        }
      } catch {}
    }, 2000);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPolling(false);
  };

  useEffect(() => () => stop(), []);

  return {
    subtitulos,
    setSubtitulos,  // 👈 usa siempre este (ya normaliza)
    polling,
    start,
    stop,
    getStartSecFor, // 👈 util para hacer seek
  };
}

