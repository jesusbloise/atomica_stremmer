
"use client";

// Visor de PDF con react-pdf (cliente-only).
// - Navegación, zoom
// - (Opcional) búsqueda + resaltado + navegación de coincidencias (via usePdfSearch)
// - Worker desde CDN (sin archivo local), configurado una sola vez
// - Compatible con ambos usos:
//   1) <PdfViewer url="..." />
//   2) <PdfViewer url="..." searchTerm="..." registerNavApi={...} />

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { highlightInline } from "@/lib/highlight";
import { usePdfSearch } from "@/hooks/usePdfSearch";

// react-pdf solo en cliente
const PdfDocument = dynamic(() => import("react-pdf").then((m) => m.Document), { ssr: false });
const PdfPage = dynamic(() => import("react-pdf").then((m) => m.Page), { ssr: false });

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

// Errores “benignos” comunes del render de TextLayer
const isAbortError = (err: unknown) => {
  const name = String((err as any)?.name ?? "");
  const msg = String((err as any)?.message ?? "");
  return (
    name.includes("Abort") ||
    name.includes("RenderingCancelled") ||
    msg.toLowerCase().includes("cancel")
  );
};

// Evita configurar el worker múltiples veces
let __pdfWorkerConfigured = false;

export default function PdfViewer({ url, searchTerm = "", registerNavApi }: Props) {
  const file = useMemo(() => ({ url }), [url]);

  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);

  const [pdfError, setPdfError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Configurar worker desde CDN una sola vez (y antes de montar Document)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!__pdfWorkerConfigured) {
          const { pdfjs } = await import("react-pdf");
          const v = pdfjs.version;
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;
          __pdfWorkerConfigured = true;
        }
      } catch (err) {
        console.error("Error configurando PDF worker:", err);
        // seguimos igual; react-pdf igual a veces funciona si el worker ya está
      } finally {
        if (mounted) setWorkerReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Hook búsqueda (solo tiene sentido si searchTerm viene)
  const { matchPages, matchIndex, setMatchIndex } = usePdfSearch(url, searchTerm);

  // Cuando cambia el término: si hay matches, ir al primero
  useEffect(() => {
    if (searchTerm && matchPages.length > 0) {
      setMatchIndex(0);
      setPageNumber(matchPages[0]);
    }
    // si borran el término, no tocamos la página actual
  }, [searchTerm, matchPages, setMatchIndex]);

  // Navegar coincidencias
  const gotoMatch = useCallback(
    (dir: 1 | -1) => {
      if (!matchPages.length) return;

      setMatchIndex((prev) => {
        const next =
          (prev + (dir === 1 ? 1 : -1) + matchPages.length) % matchPages.length;
        setPageNumber(matchPages[next]);
        return next;
      });
    },
    [matchPages, setMatchIndex]
  );

  // Registrar API para DocumentViewer
  useEffect(() => {
    if (!registerNavApi) return;

    registerNavApi({
      findAll: () => matchPages.length,
      goToMatch: (i: number) => {
        if (!matchPages.length) return;
        const idx = ((i % matchPages.length) + matchPages.length) % matchPages.length;
        setMatchIndex(idx);
        setPageNumber(matchPages[idx]);
      },
      step: (dir: 1 | -1) => {
        if (!matchPages.length) return 0;
        const next =
          (matchIndex + (dir === 1 ? 1 : -1) + matchPages.length) % matchPages.length;
        setMatchIndex(next);
        setPageNumber(matchPages[next]);
        return next;
      },
    });
  }, [registerNavApi, matchPages, matchIndex, setMatchIndex]);

  const totalMatches = searchTerm ? matchPages.length : 0;
  const currentPageMatch = totalMatches ? matchPages[matchIndex] : null;

  const prevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNumber((p) => Math.min(numPages || p + 1, p + 1));
  const zoomOut = () => setScale((s) => Math.max(0.6, +Math.max(0.6, s - 0.1).toFixed(2)));
  const zoomIn = () => setScale((s) => Math.min(2.5, +Math.min(2.5, s + 0.1).toFixed(2)));

  // Esperar worker
  if (!workerReady) {
    return (
      <div className="w-full bg-black/40 border border-zinc-800 rounded-md p-6 text-sm text-zinc-400">
        Preparando visor PDF...
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        <button
          onClick={prevPage}
          className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
          disabled={pageNumber <= 1}
        >
          Página ‹
        </button>

        <span>
          Página {numPages ? pageNumber : "?"} / {numPages || "?"}
        </span>

        <button
          onClick={nextPage}
          className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
          disabled={numPages ? pageNumber >= numPages : true}
        >
          Página ›
        </button>

        <span className="ml-2" />
        <button onClick={zoomOut} className="px-2 py-1 border border-zinc-700 rounded">
          -
        </button>
        <button onClick={zoomIn} className="px-2 py-1 border border-zinc-700 rounded">
          +
        </button>

        {!!searchTerm && (
          <>
            <span className="mx-2 text-zinc-400">
              • Coincidencias: {totalMatches || 0}
              {totalMatches ? ` (en pág. ${currentPageMatch})` : ""}
            </span>

            <button
              onClick={() => gotoMatch(-1)}
              className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
              disabled={!totalMatches}
            >
              ‹ Coincidencia
            </button>
            <button
              onClick={() => gotoMatch(1)}
              className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
              disabled={!totalMatches}
            >
              Coincidencia ›
            </button>
          </>
        )}

        <a href={url} target="_blank" rel="noreferrer" className="ml-auto underline text-zinc-300">
          Abrir en pestaña
        </a>
      </div>

      {/* Lienzo */}
      <div className="bg-black/40 border border-zinc-800 rounded-lg overflow-auto max-h-[70vh] flex justify-center">
        {isLoading && <div className="p-6 text-zinc-400">Cargando PDF...</div>}

        <PdfDocument
          // file como objeto para evitar re-montes raros
          file={file}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setIsLoading(false);
            setPdfError(null);
            // clamp page si venía fuera de rango
            setPageNumber((p) => Math.min(Math.max(1, p), numPages));
          }}
          onLoadError={(e) => {
            setPdfError((e as any)?.message || "No se pudo abrir el PDF");
            setIsLoading(false);
          }}
          loading={<div className="p-6">Preparando documento...</div>}
          error={<div className="p-4 text-red-300">{pdfError || "Error cargando PDF"}</div>}
          noData={<div className="p-4 text-zinc-300">Sin datos.</div>}
        >
          {!isLoading && (
            <PdfPage
              pageNumber={pageNumber}
              scale={scale}
              // Solo renderizamos textLayer si hay búsqueda (mejor performance)
              renderTextLayer={!!searchTerm}
              // Si no usas links/anotaciones, mejor desactivar
              renderAnnotationLayer={false}
              customTextRenderer={
                searchTerm ? ({ str }) => highlightInline(str, searchTerm) : undefined
              }
              loading={<div className="p-4 text-zinc-500">Cargando página {pageNumber}...</div>}
              onRenderError={(err) => {
                if (isAbortError(err)) return;
                console.error("PDF render error:", err);
              }}
            />
          )}
        </PdfDocument>
      </div>
    </div>
  );
}
