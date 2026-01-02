// Orquestador del visor de documentos.
// - Detecta la extensión (pdf, docx, txt, etc).
// - Renderiza el visor específico correspondiente.
// - Devuelve un mensaje si el tipo no está soportado.
// - Acepta registerNavApi y se la pasa a los viewers para navegación (Enter/Shift+Enter)

"use client";
import React, { forwardRef } from "react";
import dynamic from "next/dynamic";
import TextViewer, { isTextExt } from "./TextViewer";

const PdfViewer  = dynamic(() => import("./PdfViewer"),  { ssr: false });
const DocxViewer = dynamic(() => import("./DocxViewer"), { ssr: false });

const getExt = (nameOrUrl = "") =>
  (nameOrUrl.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();

export type DocumentViewerHandle = {
  findAll: (query: string) => number;
  goToMatch: (index: number) => void;
  step: (dir: 1 | -1) => number;
};

type Props = {
  url: string;
  fileName?: string;
  searchTerm: string;
  // 👇 NUEVO: el padre (VideoDetailPage) puede registrar la API de navegación
  registerNavApi?: (api: Partial<DocumentViewerHandle>) => void;
};

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(function DocumentViewer(
  { url, fileName, searchTerm, registerNavApi },
  ref
) {
  const ext = getExt(fileName || url);

  if (ext === "pdf") {
    return <PdfViewer url={url} searchTerm={searchTerm} registerNavApi={registerNavApi} />;
  }
  if (ext === "docx") {
    return <DocxViewer url={url} searchTerm={searchTerm} registerNavApi={registerNavApi} />;
  }
  if (isTextExt(ext)) {
    return <TextViewer url={url} searchTerm={searchTerm} registerNavApi={registerNavApi} />;
  }

  return (
    <div className="p-4 border border-zinc-800 rounded-md text-sm text-zinc-300">
      Tipo no soportado para vista previa.
    </div>
  );
});

export default DocumentViewer;

