"use client";

// Visor de archivos de texto plano (txt, srt, vtt, md, csv, log).
// - Carga el archivo como string y lo muestra en <pre>.
// - (Opcional) Resalta términos buscados.
// - (Opcional) Permite navegar entre coincidencias.
// - (Opcional) Registra API de navegación para DocumentViewer (findAll/goToMatch/step).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { highlightPlainToHTML } from "@/lib/highlight";

type NavApi = {
  findAll: (query: string) => number;
  goToMatch: (index: number) => void;
  step: (dir: 1 | -1) => number;
};

type Props = {
  url: string;
  /** opcional: si no lo pasan, funciona como visor simple */
  searchTerm?: string;
  /** opcional: DocumentViewer pasa esto para registrar la API imperativa */
  registerNavApi?: (api: Partial<NavApi>) => void;
};

const TEXT_EXT = ["txt", "srt", "vtt", "md", "csv", "log"] as const;

export function isTextExt(ext: string) {
  return (TEXT_EXT as readonly string[]).includes(ext);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function TextViewer({ url, searchTerm = "", registerNavApi }: Props) {
  const [plainText, setPlainText] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const currentIdxRef = useRef<number>(0);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const res = await fetch(url, { credentials: "omit", cache: "no-store" });
        const t = await res.text();
        if (!cancel) setPlainText(t || "(Archivo vacío)");
      } catch {
        if (!cancel) setPlainText("Error al cargar el archivo de texto.");
      }
    })();

    return () => {
      cancel = true;
    };
  }, [url]);

  const count = useMemo(() => {
    if (!searchTerm || !plainText) return 0;
    const re = new RegExp(escapeRegExp(searchTerm), "ig");
    return (plainText.match(re) || []).length;
  }, [plainText, searchTerm]);

  const getMarks = useCallback((): HTMLElement[] => {
    const root = ref.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll("mark")) as HTMLElement[];
  }, []);

  const activate = useCallback(
    (idx: number) => {
      const marks = getMarks();
      if (!marks.length) return;

      const safe = ((idx % marks.length) + marks.length) % marks.length;
      marks.forEach((m, i) => (m.dataset.active = i === safe ? "1" : "0"));

      currentIdxRef.current = safe;
      marks[safe].scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [getMarks]
  );

  const gotoMatch = useCallback(
    (dir: 1 | -1) => {
      const marks = getMarks();
      if (!marks.length) return;

      const current = currentIdxRef.current ?? -1;
      const next =
        ((current < 0 ? 0 : current) + (dir === 1 ? 1 : -1) + marks.length) %
        marks.length;

      activate(next);
    },
    [activate, getMarks]
  );

  // Seleccionar el primer match al cambiar término o contenido
  useEffect(() => {
    if (!searchTerm) return; // si no hay búsqueda, no hacemos nada
    const root = ref.current;
    if (!root) return;

    currentIdxRef.current = 0;

    const t = setTimeout(() => {
      const first = root.querySelector("mark") as HTMLElement | null;
      if (first) {
        getMarks().forEach((m) => (m.dataset.active = "0"));
        first.dataset.active = "1";
        first.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);

    return () => clearTimeout(t);
  }, [searchTerm, plainText, getMarks]);

  // 👉 Registrar API para DocumentViewer (Enter/Shift+Enter desde el padre)
  useEffect(() => {
    if (!registerNavApi) return;

    registerNavApi({
      findAll: () => getMarks().length,
      goToMatch: (i: number) => activate(i),
      step: (dir: 1 | -1) => {
        const marks = getMarks();
        if (!marks.length) return 0;

        const next =
          (currentIdxRef.current + (dir === 1 ? 1 : -1) + marks.length) %
          marks.length;

        activate(next);
        return next;
      },
    });
  }, [registerNavApi, getMarks, activate]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="text-zinc-200">Texto</span>

        {!!searchTerm && (
          <span className="text-xs text-zinc-400">
            {count} resultado{count === 1 ? "" : "s"}
          </span>
        )}

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto underline text-zinc-300"
        >
          Abrir en pestaña
        </a>
      </div>

      {!!searchTerm && (
        <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
          <button
            onClick={() => gotoMatch(-1)}
            className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
            disabled={!count}
          >
            ‹ Coincidencia
          </button>
          <button
            onClick={() => gotoMatch(1)}
            className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
            disabled={!count}
          >
            Coincidencia ›
          </button>
        </div>
      )}

      <div
        ref={ref}
        className="bg-black/40 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-[70vh]"
      >
        {/* Cuando hay searchTerm usamos HTML con <mark>, si no, render normal */}
        {searchTerm ? (
          <pre
            className="whitespace-pre-wrap break-words text-sm"
            dangerouslySetInnerHTML={{
              __html: highlightPlainToHTML(plainText || "Cargando...", searchTerm),
            }}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words text-sm">
            {plainText || "Cargando..."}
          </pre>
        )}
      </div>
    </div>
  );
}

