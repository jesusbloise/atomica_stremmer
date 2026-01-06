"use client";

import PdfViewer from "./PdfViewer";
import DocxViewer from "./DocxViewer";
import TextViewer, { isTextExt } from "./TextViewer";

const getExt = (nameOrUrl = "") =>
  (nameOrUrl.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();

export default function FileViewer(props: {
  url: string;
  name?: string;
  contentType?: string;
}) {
  const ct = (props.contentType || "").toLowerCase();
  const ext = getExt(props.name || props.url);

  const isPdf = ct.startsWith("application/pdf") || ext === "pdf";
  const isDocx =
    ct.includes("wordprocessingml.document") || ext === "docx";
  const isTxt = ct.startsWith("text/") || isTextExt(ext);

  if (isPdf) return <PdfViewer url={props.url} searchTerm="" />;
  if (isDocx) return <DocxViewer url={props.url} searchTerm="" />;
  if (isTxt) return <TextViewer url={props.url} searchTerm="" />;

  return (
    <div className="p-4 border border-zinc-800 rounded-lg">
      <p className="text-sm text-zinc-300">
        Tipo de archivo no soportado para vista previa. Puedes abrirlo en una pestaña aparte.
      </p>
      <a
        href={props.url}
        target="_blank"
        rel="noreferrer"
        className="underline mt-2 inline-block"
      >
        Abrir archivo
      </a>
    </div>
  );
}
