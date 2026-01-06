"use client";

import { forwardRef, type ReactElement } from "react";
import dynamic from "next/dynamic";
import TextViewer, { isTextExt } from "./TextViewer";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });
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
  searchTerm?: string;
  registerNavApi?: (api: Partial<DocumentViewerHandle>) => void;
};

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(
  function DocumentViewerInner({ url, fileName, searchTerm = "", registerNavApi }, _ref): ReactElement {
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
  }
);

DocumentViewer.displayName = "DocumentViewer";

export default DocumentViewer;
