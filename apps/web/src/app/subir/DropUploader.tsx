"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ====================== Categorías (se mantiene) ====================== */
type CatSlug = "publicidad" | "entretenimiento" | "vxf" | "ia";

const VALID_CATS: CatSlug[] = ["publicidad", "entretenimiento", "vxf", "ia"];
const DEFAULT_CAT: CatSlug = "publicidad";

const CATEGORIES: { value: CatSlug; label: string; hint?: string }[] = [
  { value: "publicidad", label: "Publicidad", hint: "Piezas y campañas publicitarias." },
  { value: "entretenimiento", label: "Entretenimiento", hint: "Contenido y piezas de entretenimiento." },
  {
  value: "vxf",
  label: "Corporativo",
  hint: "Contenido corporativo, institucional y nuevos negocios.",
},
  {
  value: "ia",
  label: "IA",
  hint: "Contenido generado, asistido o procesado con inteligencia artificial.",
},
];

// Por ahora SIN subcategorías
const SUBCATS: Record<CatSlug, string[]> = {
  publicidad: ["Marca", "Agencia", "Productora", "Contacto", "Oficina", "Tipo"],
  entretenimiento: ["Estudio", "Productora", "Director", "Productor", "Oficina", "Tipo"],
  vxf: ["Producción", "Corporativo", "Nuevos Negocios"],
  ia: ["Generativo", "Edición IA", "Video IA", "Imagen IA", "Audio IA"],
};

const isValidSubcat = (cat: CatSlug, sub: string) => SUBCATS[cat]?.includes(sub) ?? false;
const categoryHasSubcats = (cat: CatSlug) => SUBCATS[cat].length > 0;

/* ====================== Metadata ====================== */
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
};

const TIPO_OPTIONS = ["Color", "3D", "IA", "Musica", "Sonido", "VFX", "Edicion"] as const;
const OFICINA_OPTIONS = ["Chile", "Mexico"] as const;

const TEXT_FIELDS: Array<{ key: keyof UploadMeta; label: string; placeholder?: string }> = [
  { key: "titulo", label: "Título", placeholder: "Ej: Campaña Verano 2026 - Master" },

  { key: "marca", label: "Marca" },
  { key: "agencia", label: "Agencia" },
  { key: "productora", label: "Productora" },
  { key: "contacto", label: "Contacto" },

  { key: "estudio", label: "Estudio" },
  { key: "director", label: "Director" },
  { key: "productor", label: "Productor" },

  { key: "produccion", label: "Producción" },
  { key: "corporativo", label: "Corporativo" },
  { key: "nuevosNegocios", label: "Nuevos Negocios" },
];

/* ====================== Config ====================== */
// Cloud Run corta requests HTTP grandes antes de llegar al handler.
// Dejamos este umbral bajo para mandar archivos grandes por subida directa a GCS.
const LARGE_FILE_THRESHOLD_MB = 30;

/* ====================== Componente ====================== */
export default function DropUploader({
  onUploaded,
  accept = ".mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.gif,.webp,.avif,.pdf,.doc,.docx,.txt",
  maxSizeMB = 4096,
}: {
  onUploaded?: (payload: { id?: string; category: CatSlug }) => void;
  accept?: string;
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [category, setCategory] = useState<CatSlug>(() => {
    if (typeof window === "undefined") return DEFAULT_CAT;
    const stored = localStorage.getItem("uploadCategoryV3") as CatSlug | null;
    return stored && VALID_CATS.includes(stored) ? stored : DEFAULT_CAT;
  });

  const subcats = useMemo(() => SUBCATS[category] || [], [category]);

  const [subcategory, setSubcategory] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const storedCat =
      (localStorage.getItem("uploadCategoryV3") as CatSlug | null) || DEFAULT_CAT;
    const key = `uploadSub_${storedCat}`;
    return localStorage.getItem(key) || "";
  });

  useEffect(() => {
    localStorage.setItem("uploadCategoryV3", category);
    const key = `uploadSub_${category}`;
    const saved = localStorage.getItem(key) || "";
    setSubcategory(categoryHasSubcats(category) && isValidSubcat(category, saved) ? saved : "");
  }, [category]);

  useEffect(() => {
    if (subcategory && categoryHasSubcats(category)) {
      localStorage.setItem(`uploadSub_${category}`, subcategory);
    }
  }, [subcategory, category]);

  const [meta, setMeta] = useState<UploadMeta>({
    titulo: "",
    oficina: "",
    tipo: [],
  });

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

    setMeta((prev) => {
      const hasTitle = !!(prev.titulo && String(prev.titulo).trim());
      if (hasTitle) return prev;
      const base = f.name.replace(/\.[^/.]+$/, "");
      return { ...prev, titulo: base };
    });
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleSelect(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleSelect(f);
  };

  const requiresSub = categoryHasSubcats(category);
  const titleRequired = true;

  const uploadDisabled =
    !file ||
    uploading ||
    (requiresSub && !subcategory) ||
    (titleRequired && !(meta.titulo && meta.titulo.trim().length > 0));

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

      // =========================
      // 1) Flujo actual: archivos chicos
      // =========================
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

        setMsg("✅ Subido correctamente");
        setFile(null);
        onUploaded?.({ id, category });
        return;
      }

      // =========================
      // 2) Flujo nuevo: archivo grande -> subida directa a GCS
      // =========================
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

      setMsg("✅ Subido correctamente");
      setFile(null);
      onUploaded?.({ id, category });
    } catch (e: any) {
      setMsg(`❌ Error: ${e?.message || "falló la subida"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full min-h-screen text-white bg-transparent">
      <div className="w-full py-4 border-b border-zinc-800 bg-transparent">
        <div className="px-0">
          <p className="text-sm text-zinc-300 mb-2">Guardar en categoría:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm text-left transition",
                    active
                      ? "border-orange-400/70 bg-orange-500/10"
                      : "border-zinc-700/80 bg-transparent hover:bg-white/5",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  <div className="font-medium">{c.label}</div>
                  {c.hint && <div className="text-xs text-zinc-400 mt-0.5">{c.hint}</div>}
                </button>
              );
            })}
          </div>

          {requiresSub && (
            <div className="mt-3">
              <label className="text-sm text-zinc-300">Subcategoría</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-700/80 bg-transparent text-sm"
              >
                <option value="">Selecciona subcategoría…</option>
                {subcats.map((s) => (
                  <option key={s} value={s} className="bg-black">
                    {s}
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
          <p className="text-[12px] text-zinc-400 mt-1">Completa lo necesario antes de subir.</p>

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
              <label className="block text-[11px] text-zinc-400 mb-1">Oficina</label>
              <select
                value={meta.oficina ?? ""}
                onChange={(e) => setMetaField("oficina", e.target.value as any)}
                className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
              >
                <option value="" className="bg-black">
                  Selecciona…
                </option>
                {OFICINA_OPTIONS.map((o) => (
                  <option key={o} value={o} className="bg-black">
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
          </div>
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
          onDrop={onDrop}
          className={`w-full min-h-44 sm:min-h-56 lg:min-h-64
                      rounded-xl border-2
                      ${dragOver ? "border-orange-300/80" : "border-orange-500/60"}
                      bg-transparent hover:bg-white/5 transition
                      grid place-items-center text-center cursor-pointer select-none`}
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
            onChange={onInputChange}
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
              setMsg(null);
            }}
            className="px-4 py-2 rounded border border-zinc-700/80 hover:border-zinc-500 text-sm"
          >
            Limpiar archivo
          </button>

          {msg && <div className="text-sm text-zinc-300 break-words">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
