
"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoInfo, FilterKey } from "./types";
import Toolbar from "./Toolbar";
import BulkActionsBar from "./BulkActionsBar";
import FileGrid from "./FileGrid";
import Pagination from "./Pagination";
import { navSubscribe } from "@/components/layout/navBus";

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

      const conUrl = Array.isArray(files) ? files.filter((f: any) => !!f?.url) : [];

      const formateados: VideoInfo[] = conUrl.map((file: any) => {
        const subtituloTexto = Array.isArray(subtitulos)
          ? subtitulos
              .filter((s: any) => s.video_id === file.id)
              .map((s: any) => s.text)
              .join(" ")
              .toLowerCase()
          : undefined;

        const mimeType: string | undefined =
          file.contentType || file.mimeType || file.type || undefined;

        return {
          id: file.id,
          name: file.file_name || file.name || "sin_nombre",
          url: file.url,
          subtituloTexto,
          mimeType,
          sizeBytes: file.size || file.sizeBytes,
          created_at: file.created_at,
        };
      });

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
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

        let resultados: VideoInfo[] = Array.isArray(data?.results) ? data.results : [];

        if (activeFilter === "con_subtitulos") resultados = resultados.filter((x) => !!x.subtituloTexto);
        else if (activeFilter === "sin_subtitulos") resultados = resultados.filter((x) => !x.subtituloTexto);

        setFiltered(resultados);
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
      {/* Contenedor centrado y con gutters simétricos */}
      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-4">
        <h1 className="text-center text-3xl font-bold mb-3">Todos los archivos subidos</h1>

        <BulkActionsBar
          selectedIds={selectedIds}
          clearSelection={clearSelection}
          onBulkDeleted={handleBulkDeleted}
        />

        {/* FileGrid centrado dentro del contenedor */}
        <div className="mt-4 mx-auto">
          <FileGrid
            items={currentItems}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onDeleted={handleDeleted}
            makeHref={(id) => `/videos/${id}`}
          />
        </div>

        {/* Paginación centrada en el mismo ancho */}
        <div className="mt-6">
          <Pagination current={currentPage} total={totalPages} onChange={setCurrentPage} />
        </div>
      </div>
    </div>
  );
}

