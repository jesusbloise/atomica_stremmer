// Hook personalizado para buscar coincidencias dentro de un PDF.
// - Normaliza el texto (acentos, ligaduras).
// - Devuelve páginas que contienen el término y el índice actual.
// - Maneja cambios de término y actualiza el estado.


"use client";
import { useEffect, useState } from "react";

const normalize = (s: string) =>
  s
    .replace(/\u00AD/g, "")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function usePdfSearch(url: string | null, searchTerm: string) {
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    if (!url || !searchTerm) {
      setMatchPages([]);
      setMatchIndex(0);
      return;
    }
    let cancelled = false;
    const { pdfjs } = require("react-pdf");
    // Worker desde CDN (unpkg siempre tiene todas las versiones)
    const version = pdfjs.version;
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

    (async () => {
      try {
        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;
        const term = normalize(searchTerm);
        const pages: number[] = [];

        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled) break;
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const text = normalize(textContent.items.map((i: any) => i.str || "").join(" "));
          if (text.includes(term)) pages.push(p);
        }

        if (!cancelled) {
          setMatchPages(pages);
          setMatchIndex(0);
        }
      } catch {
        if (!cancelled) {
          setMatchPages([]);
          setMatchIndex(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, searchTerm]);

  return { matchPages, matchIndex, setMatchIndex };
}
