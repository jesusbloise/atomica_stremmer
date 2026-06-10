"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Category = {
  id: string;
  slug: string;
  label: string;
  description?: string;
  cover?: string;
  is_active: boolean;
  sort_order: number;
  subcategories: {
    id: string;
    label: string;
    is_active: boolean;
    sort_order: number;
  }[];
};

type UploadMeta = {
  titulo?: string;
  marca?: string;
  agencia?: string;
  productora?: string;
  contacto?: string;
  oficina?: "Chile" | "Mexico" | "";
  tipo?: string[];
  estudio?: string;
  director?: string;
  productor?: string;
  produccion?: string;
  corporativo?: string;
  nuevosNegocios?: string;
  otros?: string;
  duracion?: string | null;
  formato?: string | null;
  version?: string | null;
  fecha?: string | null;
};

type LocalThumbnailCandidate = {
  previewUrl: string;
  file: File;
  timeSec: number;
};

const FALLBACK_CATEGORIES: Category[] = [
  {
    id: "fallback-publicidad",
    slug: "publicidad",
    label: "Publicidad",
    description: "Piezas y campañas publicitarias.",
    cover: "/Publicidad.avif",
    is_active: true,
    sort_order: 1,
    subcategories: [
      { id: "marca", label: "Marca", is_active: true, sort_order: 1 },
      { id: "agencia", label: "Agencia", is_active: true, sort_order: 2 },
      { id: "productora", label: "Productora", is_active: true, sort_order: 3 },
      { id: "contacto", label: "Contacto", is_active: true, sort_order: 4 },
      { id: "oficina", label: "Oficina", is_active: true, sort_order: 5 },
      { id: "tipo", label: "Tipo", is_active: true, sort_order: 6 },
    ],
  },
];

const TIPO_OPTIONS = [
  "Color",
  "3D",
  "IA",
  "Musica",
  "Sonido",
  "VFX",
  "Edicion",
  "Motion",
  "Dailies",
  "Master & Deliveries",
] as const;
const OFICINA_OPTIONS = ["Chile", "Mexico"] as const;

const TEXT_FIELDS: Array<{ key: keyof UploadMeta; label: string; placeholder?: string }> = [
  { key: "titulo", label: "Título", placeholder: "Ej: Campaña Verano 2026 - Master" },
  { key: "marca", label: "Marca" },
  { key: "agencia", label: "Agencia" },
  { key: "productora", label: "Productora" },
  { key: "contacto", label: "Contacto" },

  { key: "duracion", label: "Duración", placeholder: "Ej: 00:30 / 1:20 / 2 min" },
  { key: "formato", label: "Formato", placeholder: "Ej: 16:9 / 9:16 / 4:5 / 1:1" },
  { key: "version", label: "Versión", placeholder: "Ej: V1 / V2 / Master / Final" },
  { key: "fecha", label: "Fecha", placeholder: "Ej: 2026-06-09" },

  { key: "produccion", label: "Producción" },
  { key: "corporativo", label: "Corporativo" },
  { key: "nuevosNegocios", label: "Nuevos Negocios" },
];

const LARGE_FILE_THRESHOLD_MB = 30;
const DEFAULT_CAT = "publicidad";

export default function DropUploader({
  onUploaded,
  accept = ".mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.gif,.webp,.avif,.pdf,.doc,.docx,.txt",
  maxSizeMB = 4096,
}: {
  onUploaded?: (payload: { id?: string; category: string }) => void;
  accept?: string;
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false);
  const [thumbnailCandidates, setThumbnailCandidates] = useState<LocalThumbnailCandidate[]>([]);
  const [thumbnailLoadingCandidates, setThumbnailLoadingCandidates] = useState(false);
  const [selectedThumbnailPreview, setSelectedThumbnailPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [category, setCategory] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CAT;
    return localStorage.getItem("uploadCategoryV3") || DEFAULT_CAT;
  });

  const [subcategory, setSubcategory] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const storedCat = localStorage.getItem("uploadCategoryV3") || DEFAULT_CAT;
    return localStorage.getItem(`uploadSub_${storedCat}`) || "";
  });

  const [meta, setMeta] = useState<UploadMeta>({
    titulo: "",
    oficina: "",
    tipo: [],
  });

  useEffect(() => {
    let alive = true;

    async function loadCategories() {
      try {
        setLoadingCategories(true);

        const res = await fetch("/api/categories", {
          cache: "no-store",
        });

        const data = await res.json();

        const list: Category[] = Array.isArray(data?.categories)
          ? data.categories
          : [];

        if (!alive) return;

        const finalList = list.length ? list : FALLBACK_CATEGORIES;
        setCategories(finalList);

        const stored = localStorage.getItem("uploadCategoryV3") || "";
        const exists = finalList.some((c) => c.slug === stored);

        if (!exists) {
          const first = finalList[0]?.slug || DEFAULT_CAT;
          setCategory(first);
          localStorage.setItem("uploadCategoryV3", first);
        }
      } catch (err) {
        console.error("Error cargando categorías:", err);

        if (alive) {
          setCategories(FALLBACK_CATEGORIES);
        }
      } finally {
        if (alive) setLoadingCategories(false);
      }
    }

    loadCategories();

    return () => {
      alive = false;
    };
  }, []);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.slug === category) || categories[0] || null;
  }, [categories, category]);

  const subcats = useMemo(() => {
    return (activeCategory?.subcategories || []).filter((s) => s.is_active);
  }, [activeCategory]);

  const requiresSub = subcats.length > 0;
  const titleRequired = true;

  useEffect(() => {
    if (!category) return;

    localStorage.setItem("uploadCategoryV3", category);

    const key = `uploadSub_${category}`;
    const saved = localStorage.getItem(key) || "";
    const exists = subcats.some((s) => s.label === saved);

    setSubcategory(exists ? saved : "");
  }, [category, subcats]);

  useEffect(() => {
    if (subcategory && requiresSub) {
      localStorage.setItem(`uploadSub_${category}`, subcategory);
    }
  }, [subcategory, category, requiresSub]);

  const setMetaField = (k: keyof UploadMeta, v: any) =>
    setMeta((p) => ({ ...(p ?? {}), [k]: v }));

  const toggleTipo = (opt: (typeof TIPO_OPTIONS)[number]) => {
    setMeta((prev) => {
      const cur = new Set(prev.tipo ?? []);
      if (cur.has(opt)) cur.delete(opt);
      else cur.add(opt);
      return { ...prev, tipo: Array.from(cur) };
    });
  };

  const openPicker = () => inputRef.current?.click();

  const handleSelect = (f: File) => {
    if (!f) return;

    if (f.size > maxSizeMB * 1024 * 1024) {
      setMsg(`El archivo supera ${maxSizeMB}MB`);
      return;
    }

    setMsg(null);
    setFile(f);
    setThumbnailFile(null);
    setSelectedThumbnailPreview(null);
    setThumbnailCandidates([]);

    setMeta((prev) => {
      const hasTitle = !!(prev.titulo && String(prev.titulo).trim());
      if (hasTitle) return prev;
      const base = f.name.replace(/\.[^/.]+$/, "");
      return { ...prev, titulo: base };
    });

    if (isVideoFile(f)) {
      generateLocalThumbnailCandidates(f).catch((err) => {
        setThumbnailLoadingCandidates(false);
        setMsg(`No se pudieron generar capturas: ${err?.message || "error"}`);
      });
    }
  };
  const uploadDisabled =
    !file ||
    uploading ||
    loadingCategories ||
    !category ||
    (requiresSub && !subcategory) ||
    (titleRequired && !(meta.titulo && meta.titulo.trim().length > 0));

  const uploadThumbnailIfNeeded = async (uploadId?: string) => {
    if (!uploadId || !thumbnailFile) return;

    const fd = new FormData();
    fd.append("file", thumbnailFile);

    const res = await fetch(`/api/uploads/${uploadId}/thumbnail`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || "El archivo subió, pero falló la portada");
    }
  };


  function isVideoFile(f?: File | null) {
    if (!f) return false;
    return (
      f.type.startsWith("video/") ||
      /\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(f.name)
    );
  }
  async function generateLocalThumbnailCandidates(videoFile: File) {
    setThumbnailLoadingCandidates(true);
    setThumbnailCandidates([]);
    setThumbnailModalOpen(true);
    setMsg("Generando capturas del video...");

    const objectUrl = URL.createObjectURL(videoFile);
    const video = document.createElement("video");

    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("No se pudo leer el video"));
    });

    const duration = video.duration || 0;
    const times = [0.15, 0.3, 0.45, 0.6, 0.75].map((p) =>
      Math.max(1, Math.floor(duration * p))
    );

    const results: LocalThumbnailCandidate[] = [];

    for (const timeSec of times) {
      await new Promise<void>((resolve) => {
        video.currentTime = Math.min(timeSec, Math.max(duration - 1, 1));
        video.onseeked = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });

      if (!blob) continue;

      const file = new File([blob], `portada-${timeSec}s.jpg`, {
        type: "image/jpeg",
      });

      results.push({
        previewUrl: URL.createObjectURL(blob),
        file,
        timeSec,
      });
    }

    URL.revokeObjectURL(objectUrl);

    setThumbnailCandidates(results);
    setThumbnailLoadingCandidates(false);
    setMsg(results.length ? "Elige una portada o sube una imagen propia." : null);
  }

  const upload = async () => {
    if (!file || uploading) return;
    if (!category) return setMsg("Selecciona una categoría.");
    if (requiresSub && !subcategory) return setMsg("Selecciona una subcategoría.");

    if (titleRequired && !(meta.titulo && meta.titulo.trim())) {
      return setMsg("Completa el Título.");
    }

    try {
      setUploading(true);

      const isLarge = file.size > LARGE_FILE_THRESHOLD_MB * 1024 * 1024;

      if (!isLarge) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", category);
        fd.append("subcategory", requiresSub ? subcategory : "");
        fd.append("ficha", JSON.stringify(meta));

        const res = await fetch("/api/upload-minio", {
          method: "POST",
          body: fd,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        const id: string | undefined =
          data?.id || data?.upload?.id || data?.file?.id || data?.record?.id;

        if (thumbnailFile) {
          await uploadThumbnailIfNeeded(id);

          setMsg("Subido correctamente");
          setFile(null);
          setThumbnailFile(null);
          onUploaded?.({ id, category });
          return;
        }



        setMsg("Subido correctamente");
        setFile(null);
        setThumbnailFile(null);
        onUploaded?.({ id, category });
        return;
      }

      setMsg("Subiendo archivo grande...");

      const initRes = await fetch("/api/upload-minio", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "direct-gcs",
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          category,
          subcategory: requiresSub ? subcategory : "",
          ficha: meta,
        }),
      });

      const initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok) throw new Error(initData?.error || `HTTP ${initRes.status}`);

      const uploadUrl = initData?.uploadUrl as string | undefined;
      const finalizeToken = initData?.finalizeToken as string | undefined;

      if (!uploadUrl || !finalizeToken) {
        throw new Error("No se recibió URL de subida");
      }

      setMsg("Subiendo archivo a storage...");

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Error subiendo a GCS (${putRes.status})`);
      }

      setMsg("Finalizando registro del archivo...");

      const finalizeRes = await fetch("/api/upload-minio", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "finalize-direct-gcs",
          finalizeToken,
        }),
      });

      const finalizeData = await finalizeRes.json().catch(() => ({}));
      if (!finalizeRes.ok) {
        throw new Error(finalizeData?.error || `HTTP ${finalizeRes.status}`);
      }

      const id: string | undefined =
        finalizeData?.id ||
        finalizeData?.upload?.id ||
        finalizeData?.file?.id ||
        finalizeData?.record?.id;
      if (thumbnailFile) {
        await uploadThumbnailIfNeeded(id);

        setMsg("Subido correctamente");
        setFile(null);
        setThumbnailFile(null);
        onUploaded?.({ id, category });
        return;
      }



      setMsg("Subido correctamente");
      setFile(null);
      setThumbnailFile(null);
      onUploaded?.({ id, category });
      return;
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "falló la subida"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full min-h-screen text-white bg-transparent">
      <div className="w-full py-4 border-b border-zinc-800 bg-transparent">
        <div className="px-0">
          <p className="text-sm text-zinc-300 mb-2">Guardar en categoría:</p>

          {loadingCategories ? (
            <p className="text-sm text-zinc-500">Cargando categorías...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {categories.map((c) => {
                const active = category === c.slug;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.slug)}
                    className={[
                      "rounded-lg border px-3 py-2 text-sm text-left transition",
                      active
                        ? "border-orange-400/70 bg-orange-500/10"
                        : "border-zinc-700/80 bg-transparent hover:bg-white/5",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <div className="font-medium">{c.label}</div>

                    {c.description && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {c.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {requiresSub && (
            <div className="mt-3">
              <label className="text-sm text-zinc-300">Subcategoría</label>

              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-700/80 bg-black text-sm"
              >
                <option value="">Selecciona subcategoría…</option>

                {subcats.map((s) => (
                  <option key={s.id} value={s.label} className="bg-black">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="w-full py-5 bg-transparent">
        <div className="px-0">
          <h3 className="text-base font-semibold">Datos del archivo</h3>
          <p className="text-[12px] text-zinc-400 mt-1">
            Completa lo necesario antes de subir.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {TEXT_FIELDS.map(({ key, label, placeholder }) => (
              <div key={String(key)} className="flex flex-col">
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {label}
                  {key === "titulo" && titleRequired && (
                    <span className="text-orange-400 ml-1">*</span>
                  )}
                </label>

                <input
                  type="text"
                  value={(meta[key] as any) ?? ""}
                  onChange={(e) => setMetaField(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm placeholder:text-zinc-500"
                />
              </div>
            ))}

            <div className="flex flex-col">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Oficina
              </label>

              <select
                value={meta.oficina ?? ""}
                onChange={(e) => setMetaField("oficina", e.target.value as any)}
                className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-black text-sm"
              >
                <option value="">Selecciona…</option>

                {OFICINA_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:col-span-2 lg:col-span-3">
              <label className="block text-[11px] text-zinc-400 mb-2">
                Tipo (puede ser una o varias)
              </label>

              <div className="flex flex-wrap gap-2">
                {TIPO_OPTIONS.map((opt) => {
                  const active = (meta.tipo ?? []).includes(opt);

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTipo(opt)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs border transition",
                        active
                          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                          : "bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                Seleccionado:{" "}
                <span className="text-zinc-200">
                  {(meta.tipo ?? []).length ? (meta.tipo ?? []).join(", ") : "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:col-span-2 lg:col-span-4">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Otros
              </label>

              <textarea
                value={meta.otros ?? ""}
                onChange={(e) => setMetaField("otros", e.target.value)}
                rows={5}
                placeholder="Escribe una descripción, notas, comentarios o información adicional..."
                className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm placeholder:text-zinc-500 resize-y"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full py-4 bg-transparent">
        <div className="rounded-xl border border-zinc-800/80 bg-black/20 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Imagen de portada opcional
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Puedes elegir una captura del video o subir una imagen propia antes de subir el archivo.
              </p>
            </div>

            <button
              type="button"
              disabled={!file || !isVideoFile(file)}
              onClick={() => setThumbnailModalOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-orange-500/60 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/10 disabled:opacity-50"
            >
              Elegir portada
            </button>
          </div>

          {selectedThumbnailPreview && (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs text-zinc-400">Portada seleccionada:</p>

                <button
                  type="button"
                  onClick={() => {
                    setThumbnailFile(null);
                    setSelectedThumbnailPreview(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Quitar
                </button>
              </div>

              <img
                src={selectedThumbnailPreview}
                alt="Portada seleccionada"
                className="w-full max-w-xs rounded-lg border border-zinc-800 object-cover"
              />
            </div>
          )}
        </div>
      </div>

      <div className="w-full py-5 bg-transparent">
        <div
          role="button"
          aria-label="Zona para subir archivo"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleSelect(f);
          }}
          className={`w-full min-h-44 sm:min-h-56 lg:min-h-64 rounded-xl border-2 ${dragOver ? "border-orange-300/80" : "border-orange-500/60"
            } bg-transparent hover:bg-white/5 transition grid place-items-center text-center cursor-pointer select-none`}
        >
          <div className="px-4">
            <div className="text-white font-semibold text-base sm:text-lg lg:text-xl truncate">
              {file ? file.name : "Haz click o arrastra para subir un archivo"}
            </div>

            <div className="text-zinc-400 text-xs sm:text-sm mt-2">
              Video/Documento ({maxSizeMB}MB máximo)
            </div>

            <div className="text-zinc-500 text-[11px] mt-2">
              Archivos mayores a {LARGE_FILE_THRESHOLD_MB}MB usarán subida directa a storage.
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSelect(f);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 px-0">
          <button
            onClick={upload}
            disabled={uploadDisabled}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2 rounded"
          >
            {uploading ? "Subiendo..." : "Subir archivo"}
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              setFile(null);
              setThumbnailFile(null);
              setSelectedThumbnailPreview(null);
              setThumbnailCandidates([]);
              setThumbnailModalOpen(false);
              setMsg(null);
            }}
            className="px-4 py-2 rounded border border-zinc-700/80 hover:border-zinc-500 text-sm"
          >
            Limpiar archivo
          </button>

          {msg && <div className="text-sm text-zinc-300 break-words">{msg}</div>}
        </div>
      </div>

      {thumbnailModalOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Elegir portada</h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Selecciona una captura del video o sube una imagen propia.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setThumbnailModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <div className="mb-5 rounded-xl border border-zinc-800 bg-black/30 p-4">
              <p className="mb-3 text-sm text-zinc-300">
                Subir portada personalizada
              </p>

              <label className="inline-flex cursor-pointer rounded-lg border border-orange-500/70 bg-orange-500/10 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/20 transition">
                Seleccionar imagen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const img = e.target.files?.[0] || null;

                    if (img && !img.type.startsWith("image/")) {
                      setMsg("La portada debe ser una imagen.");
                      return;
                    }

                    if (img) {
                      const preview = URL.createObjectURL(img);
                      setThumbnailFile(img);
                      setSelectedThumbnailPreview(preview);
                      setThumbnailModalOpen(false);
                    }

                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="rounded-xl border border-dashed border-zinc-800 bg-black/20 p-4">
              <p className="text-sm text-zinc-300">
                Capturas automáticas del video
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {thumbnailLoadingCandidates ? (
                  <div className="col-span-full rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
                    Generando capturas del video...
                  </div>
                ) : thumbnailCandidates.length ? (
                  thumbnailCandidates.map((candidate) => (
                    <button
                      key={`${candidate.timeSec}-${candidate.previewUrl}`}
                      type="button"
                      onClick={() => {
                        setThumbnailFile(candidate.file);
                        setSelectedThumbnailPreview(candidate.previewUrl);
                        setThumbnailModalOpen(false);
                      }}
                      className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 hover:border-orange-500/70 transition"
                    >
                      <img
                        src={candidate.previewUrl}
                        alt={`Frame ${candidate.timeSec}s`}
                        className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                      />

                      <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                        {candidate.timeSec}s
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-full rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
                    Selecciona un video para generar capturas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}