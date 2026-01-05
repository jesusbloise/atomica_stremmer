"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker desde CDN (unpkg siempre tiene todas las versiones)
const version = pdfjs.version;
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

// react-pdf con ssr desactivado
const Document = dynamic(() => import("react-pdf").then(m => m.Document), { ssr: false });
const Page     = dynamic(() => import("react-pdf").then(m => m.Page),     { ssr: false });

// (Opcional) Hook de debounce si luego añades búsqueda/highlight
function useDebounce<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Detecta errores “benignos” de cancelación del render de la TextLayer
const isAbortError = (err: unknown) => {
  const name = String((err as any)?.name ?? "");
  const msg  = String((err as any)?.message ?? "");
  return (
    name.includes("Abort") ||
    name.includes("RenderingCancelled") ||
    msg.toLowerCase().includes("cancel")
  );
};

export default function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);

  const onDocLoad = ({ numPages: n }: { numPages: number }) => setNumPages(n);

  const prev    = () => setPageNumber(p => Math.max(1, p - 1));
  const next    = () => setPageNumber(p => Math.min(numPages, p + 1));
  const zoomIn  = () => setScale(s => Math.min(2.5, s + 0.1));
  const zoomOut = () => setScale(s => Math.max(0.6, s - 0.1));

  // (Opcional) si luego pasas searchTerm para resaltar texto:
  // const debouncedTerm = useDebounce(searchTerm, 250);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 text-sm">
        <button onClick={prev} className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30" disabled={pageNumber <= 1}>
          Anterior
        </button>
        <span>Página {pageNumber} / {numPages || "?"}</span>
        <button onClick={next} className="px-2 py-1 border border-zinc-700 rounded disabled:opacity-30" disabled={pageNumber >= numPages}>
          Siguiente
        </button>
        <span className="ml-4" />
        <button onClick={zoomOut} className="px-2 py-1 border border-zinc-700 rounded">-</button>
        <button onClick={zoomIn} className="px-2 py-1 border border-zinc-700 rounded">+</button>
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto underline text-zinc-300">Abrir en pestaña</a>
      </div>

      <div className="bg-black/40 border border-zinc-800 rounded-lg overflow-auto max-h-[70vh] flex justify-center">
        <Document
          key={url} // re-monta si cambia la URL
          file={url}
          onLoadSuccess={onDocLoad}
          onLoadError={(e) => console.error("PDF load error:", e)}
          loading={<div className="p-6">Cargando PDF...</div>}
          error={<div className="p-4 text-red-300">No se pudo abrir el PDF.</div>}
          noData={<div className="p-4 text-zinc-300">Sin datos.</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer
            renderAnnotationLayer
            // Si agregas resaltado:
            // customTextRenderer={({ str }) => highlightInline(str, debouncedTerm)}
            onRenderError={(err) => {
              if (isAbortError(err)) return; // silencioso para aborts/cancel
              console.error("PDF text layer render error:", err);
            }}
            // Si NO usas links/anotaciones, puedes desactivarlas para mejorar performance:
            // renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}
