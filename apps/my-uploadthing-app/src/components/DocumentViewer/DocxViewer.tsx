"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { highlightHTMLSafe } from "@/lib/highlight";

type NavApi = {
  findAll: (query: string) => number;
  goToMatch: (index: number) => void;
  step: (dir: 1 | -1) => number;
};

type Props = {
  url: string;
  searchTerm: string;
  registerNavApi?: (api: Partial<NavApi>) => void;
};

export default function DocxViewer({ url, searchTerm, registerNavApi }: Props) {
  const [docxHtml, setDocxHtml] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const currentIdxRef = useRef<number>(0);

  // URL segura (espacios y caracteres)
  const safeUrl = useMemo(() => {
    // Si ya es absoluta, codifica solo la parte del path
    // En la práctica, encodeURI cubre espacios => %20
    return encodeURI(url);
  }, [url]);

  useEffect(() => {
    let cancel = false;
    const controller = new AbortController();

    const loadDocx = async () => {
      try {
        setErrorMsg(null);
        setDocxHtml("");
        const mammothMod = await import("mammoth/mammoth.browser");
        const mammoth = (mammothMod as any).default ?? mammothMod;

        const res = await fetch(safeUrl, {
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          // Muestra motivo concreto (404, 403, etc.)
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        // (Opcional) Validar Content-Type
        const ctype = res.headers.get("content-type") || "";
        if (!/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(ctype)) {
          // Algunos servidores no envían el mime correcto, así que no bloqueamos;
          // pero deja un log para depurar si hace falta.
          console.warn("DOCX content-type sospechoso:", ctype);
        }

        const buf = await res.arrayBuffer();

        const { value } = await mammoth.convertToHtml(
          { arrayBuffer: buf },
          { includeDefaultStyleMap: true }
        );

        if (!cancel) {
          setDocxHtml(value || "<p>(Documento vacío)</p>");
        }
      } catch (err: any) {
        console.error("DOCX load error:", err);
        if (!cancel) {
          setErrorMsg(
            typeof err?.message === "string" ? err.message : "Error al cargar el documento."
          );
          setDocxHtml("<p>Error al cargar el documento.</p>");
        }
      }
    };

    loadDocx();
    return () => {
      cancel = true;
      controller.abort();
    };
  }, [safeUrl]);

  const count = useMemo(() => {
    if (!searchTerm || !docxHtml) return 0;
    const re = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    return (docxHtml.match(re) || []).length;
  }, [docxHtml, searchTerm]);

  const getMarks = useCallback((): HTMLElement[] => {
    const root = docxRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll("mark")) as HTMLElement[];
  }, []);

  const activate = useCallback((idx: number) => {
    const marks = getMarks();
    if (!marks.length) return;
    const safe = ((idx % marks.length) + marks.length) % marks.length;
    marks.forEach((m, i) => (m.dataset.active = i === safe ? "1" : "0"));
    currentIdxRef.current = safe;
    marks[safe].scrollIntoView({ behavior: "smooth", block: "center" });
  }, [getMarks]);

  const gotoMatch = useCallback((dir: 1 | -1) => {
    const marks = getMarks();
    if (!marks.length) return;
    const current = currentIdxRef.current ?? -1;
    const next = ((current < 0 ? 0 : current) + (dir === 1 ? 1 : -1) + marks.length) % marks.length;
    activate(next);
  }, [activate, getMarks]);

  // Seleccionar el primer match al cambiar término o HTML
  useEffect(() => {
    const root = docxRef.current;
    if (!root) return;
    currentIdxRef.current = 0;
    const t = setTimeout(() => {
      const first = root.querySelector("mark") as HTMLElement | null;
      if (first) {
        getMarks().forEach(m => (m.dataset.active = "0"));
        first.dataset.active = "1";
        first.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [searchTerm, docxHtml, getMarks]);

  // API imperativa para el contenedor (DocumentViewer)
  useEffect(() => {
    if (!registerNavApi) return;
    registerNavApi({
      findAll: () => getMarks().length,
      goToMatch: (i: number) => activate(i),
      step: (dir: 1 | -1) => {
        const marks = getMarks();
        if (!marks.length) return 0;
        const next = ((currentIdxRef.current + (dir === 1 ? 1 : -1)) + marks.length) % marks.length;
        activate(next);
        return next;
      },
    });
  }, [registerNavApi, getMarks, activate]);

  return (
    <div className="w-full">
      {!!searchTerm && (
        <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
          {count} resultado{count === 1 ? "" : "s"}
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
          {errorMsg && <span className="ml-2 text-red-300">• {errorMsg}</span>}
        </div>
      )}

      <div
        ref={docxRef}
        className="prose prose-invert max-w-none bg-black/40 border border-zinc-800 rounded-md p-4 overflow-auto max-h-[500px]"
        dangerouslySetInnerHTML={{
          __html: docxHtml
            ? highlightHTMLSafe(docxHtml, searchTerm)
            : "<p>Cargando DOCX...</p>",
        }}
      />
    </div>
  );
}
