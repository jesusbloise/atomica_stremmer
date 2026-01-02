"use client";

import { useEffect, useState } from "react";
import mammoth from "mammoth";

export default function DocxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf }, { includeDefaultStyleMap: true });
        if (!cancel) setHtml(value);
      } catch (e) {
        if (!cancel) setHtml("<p>Error al cargar el documento.</p>");
      }
    };
    load();
    return () => { cancel = true; };
  }, [url]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span>DOCX</span>
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto underline text-zinc-300">Abrir en pestaña</a>
      </div>
      <div className="prose prose-invert max-w-none bg-black/40 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-[70vh]">
        <div dangerouslySetInnerHTML={{ __html: html || "<p>Cargando DOCX...</p>" }} />
      </div>
    </div>
  );
}
