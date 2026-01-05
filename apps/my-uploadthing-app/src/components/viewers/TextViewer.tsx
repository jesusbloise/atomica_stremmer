"use client";

import { useEffect, useState } from "react";

export default function TextViewer({ url }: { url: string }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        const t = await res.text();
        if (!cancel) setText(t);
      } catch (e) {
        if (!cancel) setText("Error al cargar el archivo de texto.");
      }
    };
    load();
    return () => { cancel = true; };
  }, [url]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span>Texto</span>
        <a href={url} target="_blank" rel="noreferrer" className="ml-auto underline text-zinc-300">Abrir en pestaña</a>
      </div>
      <div className="bg-black/40 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-[70vh]">
        <pre className="whitespace-pre-wrap break-words text-sm">{text || "Cargando..."}</pre>
      </div>
    </div>
  );
}
