// SUBCOMPONENTE: Uploader
// Propósito: Subir un archivo a /api/upload-minio y notificar al padre.
// Props:
//  - onUploaded: () => void  -> callback para refrescar la lista tras subir

"use client";

import { useState } from "react";

export default function Uploader({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-minio", { method: "POST", body: formData });
      const result = await res.json();
      if (res.ok && result?.url) {
        onUploaded();
      } else {
        alert("No se pudo subir el archivo.");
      }
    } catch (e) {
      console.error("upload falló:", e);
      alert("Error subiendo archivo.");
    } finally {
      setBusy(false);
      setFile(null);
    }
  };

  return (
    <div className="flex flex-col items-center mb-6">
      <input
        type="file"
        accept=".mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.gif,.webp,.avif,.pdf,.doc,.docx,.txt"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="bg-white text-black px-2 py-1 rounded w-full sm:w-1/2"
      />
      <button
        onClick={handleUpload}
        disabled={!file || busy}
        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 mt-3 rounded shadow"
      >
        {busy ? "Subiendo..." : "Subir archivo"}
      </button>
    </div>
  );
}
