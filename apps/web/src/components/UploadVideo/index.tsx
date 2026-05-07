"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoInfo, FilterKey } from "./types";
import Toolbar from "./Toolbar";
import BulkActionsBar from "./BulkActionsBar";
import FileGrid from "./FileGrid";
import Pagination from "./Pagination";
import { navSubscribe } from "@/components/layout/navBus";

/**
 * Detecta si un hostname es local/privado o un nombre interno de docker.
 * En esos casos, el navegador NO podrá acceder => conviene usar /api/proxy.
 */
function shouldProxyAbsoluteUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();

    // localhost
    if (host === "localhost" || host === "127.0.0.1") return true;

    // redes privadas típicas
    if (host.startsWith("192.168.")) return true;
    if (host.startsWith("5.")) return true;
    if (host.startsWith("12.")) {
      // 172.16.0.0 – 172.31.255.255
      const p = host.split(".");
      const n = Number(p[1]);
      if (!Number.isNaN(n) && n >= 16 && n <= 31) return true;
    }

    // nombres internos que suelen romper en el browser (docker DNS)
    // (si tu url viene como http://minio:9000/..., desde el browser no resuelve)
    if (host === "minio" || host === "minio-old" || host.includes("minio")) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * ✅ Devuelve una URL usable por el navegador.
 * - Si ya es absoluta y NO es privada => se usa tal cual (como el componente que te funciona).
 * - Si es absoluta privada => se envuelve en /api/proxy
 * - Si es relativa => se deja tal cual.
 */
function normalizePlayableUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";

  if (s.startsWith("/api/proxy?url=")) return s;

  if (s.startsWith("gs://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

  if (s.startsWith("http://") || s.startsWith("https://")) {
    if (shouldProxyAbsoluteUrl(s)) return `/api/proxy?url=${encodeURIComponent(s)}`;
    return s;
  }

  if (s.startsWith("/archivos/")) {
    const base =
      process.env.NEXT_PUBLIC_MINIO_PUBLIC_BASE?.replace(/\/+$/, "") ||
      "http://192.168.5.12:9100";
    const abs = `${base}${s}`;
    return `/api/proxy?url=${encodeURIComponent(abs)}`;
  }

  return s;
}

/**
 * ✅ Normaliza una fila cualquiera a VideoInfo.
 * Prioriza:
 * 1) file.url (porque en tu sistema ESTE es el que sí funciona para previews)
 * 2) file.file_path / file.path
 * 3) /api/files/file_key
 */
function mapAnyToVideoInfo(file: any, subtitulos: any[]): VideoInfo | null {
  if (!file?.id) return null;

  const subtituloTexto = Array.isArray(subtitulos)
    ? subtitulos
        .filter((s: any) => s.video_id === file.id)
        .map((s: any) => s.text)
        .join(" ")
        .toLowerCase()
    : undefined;

  const mimeType: string | undefined =
    file.contentType || file.mimeType || file.type || undefined;

  // ✅ PRIORIDAD: url (lo que ya te funciona) -> file_path -> path -> api/files
  const rawUrl: string =
    file.url ||
    file.file_path ||
    file.path ||
    (file.file_key ? `/api/files/${file.file_key}` : "");

  if (!rawUrl) return null;

  return {
    id: file.id,
    name: file.file_name || file.name || "sin_nombre",
    url: normalizePlayableUrl(rawUrl),
    subtituloTexto,
    mimeType,
    sizeBytes: file.size || file.sizeBytes,
    created_at: file.created_at || file.uploaded_at,
  };
}

export default function UploadVideo() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [filtered, setFiltered] = useState<VideoInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const videosPerPage = 8;

  const loadVideos = async () => {
    try {
      const [videosRes, subtitulosRes] = await Promise.all([
        fetch("/api/videos?only=all", { cache: "no-store" }),
        fetch("/api/subtitulos-completos", { cache: "no-store" }),
      ]);

      const files = await videosRes.json();
      const subtitulos = await subtitulosRes.json();

      const arrFiles = Array.isArray(files) ? files : [];
      const arrSubs = Array.isArray(subtitulos) ? subtitulos : [];

      const formateados: VideoInfo[] = arrFiles
        .map((f: any) => mapAnyToVideoInfo(f, arrSubs))
        .filter(Boolean) as VideoInfo[];

      setVideos(formateados);
      setFiltered(formateados);
      setCurrentPage(1);
    } catch (e) {
      console.error("Error cargando videos:", e);
      setVideos([]);
      setFiltered([]);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const clearSelection = () => setSelectedIds([]);

  const handleDeleted = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    setFiltered((prev) => {
      const next = prev.filter((v) => v.id !== id);
      const maxPage = Math.max(1, Math.ceil(next.length / videosPerPage));
      setCurrentPage((p) => Math.min(p, maxPage));
      return next;
    });
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleBulkDeleted = (_n: number) => {
    const ids = new Set(selectedIds);
    const nextVideos = videos.filter((v) => !ids.has(v.id));
    const nextFiltered = filtered.filter((v) => !ids.has(v.id));

    setVideos(nextVideos);
    setFiltered(nextFiltered);
    setSelectedIds([]);
    setSelectionMode(false);

    const maxPage = Math.max(1, Math.ceil(nextFiltered.length / videosPerPage));
    setCurrentPage((p) => Math.min(p, maxPage));
  };

  const debouncedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  useEffect(() => {
    const unsubscribe = navSubscribe({
      onSearch: (q) => setSearchTerm(q ?? ""),
      onFilter: (key) => {
        setActiveFilter(key);
        if (!debouncedSearch) {
          let base = [...videos];
          if (key === "con_subtitulos") base = base.filter((v) => v.subtituloTexto);
          else if (key === "sin_subtitulos") base = base.filter((v) => !v.subtituloTexto);
          else if (key === "hoy") {
            const hoy = new Date().toISOString().split("T")[0];
            base = base.filter((v) => v.created_at?.startsWith(hoy));
          }
          setFiltered(base);
          setCurrentPage(1);
        }
      },
      onToggleSelect: () => {
        setSelectionMode((v) => {
          const next = !v;
          if (!next) clearSelection();
          return next;
        });
      },
    });
    return () => unsubscribe();
  }, [debouncedSearch, videos]);

  useEffect(() => {
    const run = async () => {
      if (!debouncedSearch) {
        let base = [...videos];
        if (activeFilter === "con_subtitulos") base = base.filter((v) => v.subtituloTexto);
        else if (activeFilter === "sin_subtitulos") base = base.filter((v) => !v.subtituloTexto);
        else if (activeFilter === "hoy") {
          const hoy = new Date().toISOString().split("T")[0];
          base = base.filter((v) => v.created_at?.startsWith(hoy));
        }
        setFiltered(base);
        setCurrentPage(1);
        return;
      }

      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(debouncedSearch)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();

        let resultados: any[] = Array.isArray(data?.results) ? data.results : [];

        // ✅ normalizamos igual que en load
        let mapped: VideoInfo[] = resultados
          .map((r: any) => {
            const rawUrl: string =
              r.url ||
              r.file_path ||
              r.path ||
              (r.file_key ? `/api/files/${r.file_key}` : "");
            if (!rawUrl) return null;

            return {
              id: r.id,
              name: r.file_name || r.name || "sin_nombre",
              url: normalizePlayableUrl(rawUrl),
              subtituloTexto: r.subtituloTexto,
              mimeType: r.contentType || r.mimeType || r.type || undefined,
              sizeBytes: r.size || r.sizeBytes,
              created_at: r.created_at || r.uploaded_at,
            } as VideoInfo;
          })
          .filter(Boolean) as VideoInfo[];

        if (activeFilter === "con_subtitulos") mapped = mapped.filter((x) => !!x.subtituloTexto);
        else if (activeFilter === "sin_subtitulos") mapped = mapped.filter((x) => !x.subtituloTexto);

        setFiltered(mapped);
        setCurrentPage(1);
      } catch (e) {
        console.error("buscar falló:", e);
        setFiltered([]);
        setCurrentPage(1);
      }
    };

    run();
  }, [debouncedSearch, activeFilter, videos]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / videosPerPage));
  const currentItems = filtered.slice(
    (currentPage - 1) * videosPerPage,
    currentPage * videosPerPage
  );

  return (
    <div className="text-white">
      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-4">
        <h1 className="text-center text-3xl font-bold mb-3">Todos los archivos subidos</h1>

        <BulkActionsBar
          selectedIds={selectedIds}
          clearSelection={clearSelection}
          onBulkDeleted={handleBulkDeleted}
        />

        <div className="mt-4 mx-auto">
          <FileGrid
            items={currentItems}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onDeleted={handleDeleted}
            makeHref={(id) => {
  const q = searchTerm.trim();
  return q ? `/videos/${id}?q=${encodeURIComponent(q)}` : `/videos/${id}`;
}}
          />
        </div>

        <div className="mt-6">
          <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
        </div>
      </div>
    </div>
  );
}
