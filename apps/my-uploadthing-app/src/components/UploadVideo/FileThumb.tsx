// src/components/UploadVideo/FileThumb.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoInfo } from "./types";
import { getExt, getKind, isVideoExt, isPdfExt } from "./helpers";
import { IconDoc, IconPdf, IconAudio } from "./icons"; // íconos en .tsx



export default function FileThumb({
  item,
  controls = true,
  height = 192,
}: {
  item: VideoInfo;
  controls?: boolean;
  height?: number;
}) {
  const ext  = useMemo(() => getExt(item.name || item.url), [item]);
  const kind = useMemo(() => getKind(item.mimeType, item.name, item.url), [item]);

  // Thumbnail de PDF
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdfExt(ext)) return;
    let cancelled = false;

    (async () => {
      // 👉 importar pdfjs SOLO en cliente
      const { pdfjs } = await import("react-pdf");
      // Worker desde CDN (unpkg siempre tiene todas las versiones)
      const version = pdfjs.version;
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

      const task = pdfjs.getDocument({ url: item.url });
      const pdf  = await task.promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 0.35 });
      const canvas   = document.createElement("canvas");
      const ctx      = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width  = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ 
        canvasContext: ctx, 
        viewport,
        canvas // ✅ Requerido por la API de PDF.js
      }).promise;
      if (!cancelled) setThumbUrl(canvas.toDataURL("image/png"));
      pdf.destroy();
    })().catch((e) => {
      console.warn("PDF thumb error:", e);
    });

    return () => { cancelled = true; };
  }, [item.url, ext]);

  // --- Renders por tipo ---
  if (kind === "video" || isVideoExt(ext)) {
    return (
      <div className="w-full overflow-hidden bg-black z-0" style={{ height }}>
        <video controls={controls} src={item.url} className="w-full h-full object-cover" preload="metadata" />
      </div>
    );
  }

  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt={item.name} className="w-full object-cover" style={{ height }} />;
  }

  if (kind === "audio") {
    return (
      <div className="w-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700" style={{ height }}>
        <div className="flex items-center gap-2 text-indigo-100">
          <IconAudio className="w-6 h-6" />
          <span className="text-xs uppercase tracking-wide">AUDIO</span>
        </div>
      </div>
    );
  }

  if (isPdfExt(ext)) {
    return (
      <div className="w-full bg-zinc-950 border-b border-zinc-800" style={{ height }}>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="PDF thumbnail" className="w-full h-full object-contain bg-black" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-rose-900 to-rose-700">
            <div className="flex items-center gap-2 text-rose-100">
              <IconPdf className="w-7 h-7" />
              <span className="text-xs font-semibold">PDF</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DOCX / otros docs
   // DOCX / otros docs
  return (
      <div className="w-full bg-zinc-950 border-b border-zinc-800 flex items-center justify-center" style={{ height }}>
      <img
        src="/docx2.png"
        alt="Documento DOCX"
        className="h-48 object-contain"
      />
    </div>
  );

}
