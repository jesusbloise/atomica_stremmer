"use client";

import PdfViewer from "./PdfViewer";
import DocxViewer from "./DocxViewer";
import TextViewer from "./TextViewer";

const getExt = (nameOrUrl = "") =>
  (nameOrUrl.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();

const getKind = (contentType?: string, name?: string, url?: string) => {
  const ct = (contentType || "").toLowerCase();
  const ext = getExt(name || url || "");
  if (ct.startsWith("application/pdf") || ext === "pdf") return "pdf";
  if (ct.includes("wordprocessingml.document") || ext === "docx") return "docx";
  if (ct.startsWith("text/") || ["txt", "srt", "vtt", "md", "csv", "log"].includes(ext)) return "txt";
  return "unknown";
};

export default function FileViewer(props: { url: string; name?: string; contentType?: string }) {
  const kind = getKind(props.contentType, props.name, props.url);

  if (kind === "pdf") return <PdfViewer url={props.url} />;
  if (kind === "docx") return <DocxViewer url={props.url} />;
  if (kind === "txt") return <TextViewer url={props.url} />;

  return (
    <div className="p-4 border border-zinc-800 rounded-lg">
      <p className="text-sm text-zinc-300">
        Tipo de archivo no soportado para vista previa. Puedes abrirlo en una pestaña aparte.
      </p>
      <a href={props.url} target="_blank" rel="noreferrer" className="underline mt-2 inline-block">
        Abrir archivo
      </a>
    </div>
  );
}
