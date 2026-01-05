// Visor de archivos PDF con react-pdf (estable, sin bucles).
// - Navegación, zoom, búsqueda con resaltado.
// - Worker desde CDN (sin requerir archivo local).

"use client";
// CSS de react-pdf v10
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";
import { highlightInline } from "@/lib/highlight";
import { usePdfSearch } from "@/hooks/usePdfSearch";

// React-PDF (solo en cliente)
const PdfDocument = dynamic(() => import("react-pdf").then(m => m.Document), { ssr: false });
const PdfPage     = dynamic(() => import("react-pdf").then(m => m.Page),     { ssr: false });

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

export default function PdfViewer({ url, searchTerm, registerNavApi }: Props) {
  const file = useMemo(() => ({ url }), [url]);

  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPage]   = useState(1);
  const [scale, setScale]       = useState(1.1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Configurar worker desde CDN ANTES de montar Document
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { pdfjs } = await import("react-pdf");
        const v = pdfjs.version;
        // Usar unpkg que tiene todas las versiones disponibles
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;
        if (mounted) setWorkerReady(true);
      } catch (err) {
        console.error("Error configurando PDF worker:", err);
        if (mounted) setWorkerReady(true); // continuar de todos modos
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Hook de búsqueda existente
  const { matchPages, matchIndex, setMatchIndex } = usePdfSearch(url, searchTerm);

  // Cuando cambia el término y hay matches, ir al primero
  useEffect(() => {
    if (searchTerm && matchPages.length > 0) {
      setMatchIndex(0);
      setPage(matchPages[0]);
    }
  }, [searchTerm, matchPages, setMatchIndex]);

  // Botones «Coincidencia ‹ / ›»
  const gotoMatch = useCallback((dir: 1 | -1) => {
    if (!matchPages.length) return;
    setMatchIndex(prev => {
      const next = (prev + (dir === 1 ? 1 : -1) + matchPages.length) % matchPages.length;
      setPage(matchPages[next]);
      return next;
    });
  }, [matchPages, setMatchIndex]);

  // API para el padre (opcional)
  useEffect(() => {
    if (!registerNavApi) return;
    registerNavApi({
      findAll: () => matchPages.length,
      goToMatch: (i: number) => {
        if (!matchPages.length) return;
        const idx = ((i % matchPages.length) + matchPages.length) % matchPages.length;
        setMatchIndex(idx);
        setPage(matchPages[idx]);
      },
      step: (dir: 1 | -1) => {
        if (!matchPages.length) return 0;
        const next = ((matchIndex + (dir === 1 ? 1 : -1)) + matchPages.length) % matchPages.length;
        setMatchIndex(next);
        setPage(matchPages[next]);
        return next;
      },
    });
  }, [registerNavApi, matchPages, matchIndex, setMatchIndex]);

  const totalMatches     = matchPages.length;
  const currentPageMatch = totalMatches ? matchPages[matchIndex] : null;

  // Esperar a que el worker esté listo antes de mostrar el Document
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
          onClick={() => setPage(p => Math.max(1, p - 1))}
          className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
          disabled={pageNumber <= 1}
        >
          Página ‹
        </button>
        <span>Página {numPages ? pageNumber : "?"} / {numPages || "?"}</span>
        <button
          onClick={() => setPage(p => Math.min(numPages, p + 1))}
          className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30"
          disabled={numPages > 0 ? pageNumber >= numPages : true}
        >
          Página ›
        </button>

        <span className="ml-2" />
        <button onClick={() => setScale(s => Math.max(0.6, +(s - 0.1).toFixed(2)))} className="px-2 py-1 border border-zinc-700 rounded">-</button>
        <button onClick={() => setScale(s => Math.min(2.5, +(s + 0.1).toFixed(2)))} className="px-2 py-1 border border-zinc-700 rounded">+</button>

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
      </div>

      {/* Lienzo PDF */}
      <div className="bg-black/40 border border-zinc-800 rounded-md overflow-auto max-h-[500px] flex justify-center">
        {isLoading && (
          <div className="p-6 text-zinc-400">Cargando PDF...</div>
        )}
        <PdfDocument
          file={file}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setIsLoading(false);
          }}
          onLoadError={(e) => {
            setPdfError((e as any)?.message || "No se pudo abrir el PDF");
            setIsLoading(false);
          }}
          loading={<div className="p-6">Preparando documento...</div>}
          error={<div className="p-4 text-red-300">{pdfError || "Error cargando PDF"}</div>}
        >
          {!isLoading && (
            <PdfPage
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={!!searchTerm}
              renderAnnotationLayer={false}
              customTextRenderer={searchTerm ? ({ str }) => highlightInline(str, searchTerm) : undefined}
              loading={<div className="p-4 text-zinc-500">Cargando página {pageNumber}...</div>}
            />
          )}
        </PdfDocument>
      </div>
    </div>
  );
}



