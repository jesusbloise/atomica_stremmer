"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FichaTecnicaData } from "@/components/FichaTecnica"; // solo tipo

/* ====================== Categorías y Subcategorías ====================== */
type CatSlug = "retail" | "moda" | "marca" | "comunicacion-interna";

const VALID_CATS: CatSlug[] = ["retail", "moda", "marca", "comunicacion-interna"];
const DEFAULT_CAT: CatSlug = "retail";

const CATEGORIES: { value: CatSlug; label: string; hint?: string }[] = [
  {
    value: "retail",
    label: "Retail",
    hint: "Armados, evento, precio y calendario comercial.",
  },
  {
    value: "moda",
    label: "Moda",
    hint: "Campañas, catálogos, lookbooks, contenido de moda…",
  },
  {
    value: "marca",
    label: "Marca",
    hint: "Branding, identidad visual, lanzamientos de marca…",
  },
  {
    value: "comunicacion-interna",
    label: "C. Interna",
    hint: "Comunicaciones internas, cultura, mensajes a colaboradores…",
  },
];

const SUBCATS: Record<CatSlug, string[]> = {
  retail: ["Calendario Comercial", "Eventos Precio", "Liquidación"],
  moda: ["Americanino", "Basement", "Invierno", "University Club", "Verano"],
  marca: ["Campaña Marca", "Dia Madre", "Escolares", "Navidad"],
  // Comunicación interna SIN subcategorías
  "comunicacion-interna": [],
};

const isValidSubcat = (cat: CatSlug, sub: string) =>
  SUBCATS[cat]?.includes(sub) ?? false;

const categoryHasSubcats = (cat: CatSlug) => SUBCATS[cat].length > 0;

/* ====================== Campos de Ficha ====================== */
const FIELDS: Array<{
  key: keyof FichaTecnicaData;
  label: string;
  type?: "text" | "textarea" | "datetime" | "checkbox" | "number";
}> = [
  { key: "titulo", label: "Título" },
  { key: "director", label: "Director" },
  { key: "productor", label: "Productor" },
  { key: "jefeProduccion", label: "Jefe de Producción" },
  { key: "directorFotografia", label: "Director de Fotografía" },
  { key: "sonido", label: "Sonido" },
  { key: "direccionArte", label: "Dirección de Arte" },
  { key: "asistenteDireccion", label: "Asistente de Dirección" },
  { key: "montaje", label: "Montaje" },
  { key: "otroCargo", label: "Otro cargo" },
  { key: "contactoPrincipal", label: "Contacto Principal" },
  { key: "correo", label: "Correo" },
  { key: "curso", label: "Curso" },
  { key: "profesor", label: "Profesor" },
  { key: "anio", label: "Año", type: "number" },
  { key: "duracion", label: "Duración" },
  { key: "sinopsis", label: "Sinopsis", type: "textarea" },
  { key: "procesoAnterior", label: "Proceso anterior", type: "textarea" },
  { key: "pendientes", label: "Pendientes", type: "textarea" },
  { key: "visto", label: "Visto", type: "checkbox" },
  { key: "reunion", label: "Reunión", type: "datetime" },
  { key: "formato", label: "Formato" },
  { key: "estado", label: "Estado" },
  { key: "deliveryEstimado", label: "Delivery estimado" },
  { key: "seleccion", label: "Selección" },
  { key: "link", label: "Link de visionado" },
  { key: "foto", label: "Foto (URL)" },
];

/* ====================== Componente ====================== */
export default function DropUploader({
  onUploaded,
  accept = ".mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.gif,.webp,.avif,.pdf,.doc,.docx,.txt",
  maxSizeMB = 4096,
}: {
  onUploaded?: (id?: string) => void;
  accept?: string;
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // categoría & subcategoría (persisten)
  const [category, setCategory] = useState<CatSlug>(() => {
    if (typeof window === "undefined") return DEFAULT_CAT;
    const stored = localStorage.getItem("uploadCategoryV3") as CatSlug | null;
    return stored && VALID_CATS.includes(stored) ? stored : DEFAULT_CAT;
  });

  const subcats = useMemo(() => SUBCATS[category] || [], [category]);

  const [subcategory, setSubcategory] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const storedCat =
      (localStorage.getItem("uploadCategoryV3") as CatSlug | null) ||
      DEFAULT_CAT;
    const key = `uploadSub_${storedCat}`;
    return localStorage.getItem(key) || "";
  });

  useEffect(() => {
    localStorage.setItem("uploadCategoryV3", category);
    const key = `uploadSub_${category}`;
    const saved = localStorage.getItem(key) || "";
    setSubcategory(
      categoryHasSubcats(category) && isValidSubcat(category, saved)
        ? saved
        : ""
    );
  }, [category]);

  useEffect(() => {
    if (subcategory && categoryHasSubcats(category)) {
      localStorage.setItem(`uploadSub_${category}`, subcategory);
    }
  }, [subcategory, category]);

  // Ficha técnica (sin preview)
  const [ficha, setFicha] = useState<FichaTecnicaData>({});
  const setField = (key: keyof FichaTecnicaData, val: any) =>
    setFicha((prev) => ({ ...prev, [key]: val }));

  // CSV
  const onImportFichaCSV = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSVToFicha(text);
    if (parsed) setFicha((prev) => ({ ...prev, ...parsed }));
    else setMsg("No se pudo leer el CSV. Verifica encabezados y comas.");
  };

  // File handlers
  const openPicker = () => inputRef.current?.click();
  const handleSelect = (f: File) => {
    if (!f) return;
    if (f.size > maxSizeMB * 1024 * 1024) {
      setMsg(`El archivo supera ${maxSizeMB}MB`);
      return;
    }
    setMsg(null);
    setFile(f);
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

  // Subida
  const upload = async () => {
    if (!file || uploading) return;
    if (!category) return setMsg("Selecciona una categoría.");

    const requiresSub = categoryHasSubcats(category);
    if (requiresSub && !subcategory) {
      return setMsg("Selecciona una subcategoría.");
    }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      // Para retail/moda/marca mandamos subcategoría; para C. interna puede ir vacío
      fd.append("subcategory", requiresSub ? subcategory : "");

      fd.append("ficha", JSON.stringify(ficha));

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
      onUploaded?.(id);
    } catch (e: any) {
      setMsg(`❌ Error: ${e?.message || "falló la subida"}`);
    } finally {
      setUploading(false);
    }
  };

  const requiresSub = categoryHasSubcats(category);
  const uploadDisabled =
    !file || uploading || (requiresSub && !subcategory);

  /* ====================== UI ====================== */
  return (
    <div className="w-full min-h-screen text-white bg-transparent">
      {/* Bloque categorías/subcategorías */}
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
                  {c.hint && (
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {c.hint}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Solo mostramos subcategoría si la categoría la necesita */}
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

      {/* Dropzone */}
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
                      ${
                        dragOver
                          ? "border-orange-300/80"
                          : "border-orange-500/60"
                      }
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
          {msg && (
            <div className="text-sm text-zinc-300 break-words">{msg}</div>
          )}
        </div>
      </div>

      {/* Ficha técnica */}
      <div className="w-full py-5 border-t border-zinc-800 bg-transparent">
        <div className="px-0">
          <div className="flex items.center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-semibold">Ficha Técnica</h3>
              <p className="text-[12px] text-zinc-400">
                Completa los campos o importa un CSV con los encabezados
                estándar.
              </p>
            </div>
            <label className="text-xs px-3 py-1.5 rounded border border-zinc-700/80 hover:border-zinc-500 cursor-pointer">
              Importar CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await onImportFichaCSV(f);
                }}
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map(({ key, label, type }) => (
              <div
                key={String(key)}
                className={
                  type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""
                }
              >
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {label}
                </label>

                {type === "textarea" ? (
                  <textarea
                    value={(ficha[key] as any) ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm placeholder:text-zinc-500"
                  />
                ) : type === "checkbox" ? (
                  <div className="h-9 flex items-center">
                    <input
                      type="checkbox"
                      checked={!!ficha[key]}
                      onChange={(e) => setField(key, e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                ) : type === "number" ? (
                  <input
                    type="number"
                    value={String(ficha[key] ?? "")}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
                  />
                ) : type === "datetime" ? (
                  <input
                    type="datetime-local"
                    value={toInputDatetime(
                      ficha[key] as string | undefined
                    )}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={(ficha[key] as any) ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================== Helpers ====================== */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

const COLMAP: Record<string, keyof FichaTecnicaData> = {
  titulo: "titulo",
  director: "director",
  productor: "productor",
  jefeproduccion: "jefeProduccion",
  directordefotografia: "directorFotografia",
  sonido: "sonido",
  direcciondearte: "direccionArte",
  asistentedireccion: "asistenteDireccion",
  montaje: "montaje",
  otrocargo: "otroCargo",
  contactoprincipal: "contactoPrincipal",
  correo: "correo",
  curso: "curso",
  profesor: "profesor",
  anio: "anio",
  año: "anio",
  duracion: "duracion",
  sinopsis: "sinopsis",
  procesoanterior: "procesoAnterior",
  pendientes: "pendientes",
  visto: "visto",
  reunion: "reunion",
  formato: "formato",
  estado: "estado",
  deliveryestimado: "deliveryEstimado",
  seleccion: "seleccion",
  link: "link",
  foto: "foto",
};

function mapRowToFicha(row: Record<string, any>): FichaTecnicaData {
  const out: FichaTecnicaData = {};
  for (const [k, v] of Object.entries(row)) {
    const key = COLMAP[norm(k)];
    if (!key) continue;
    if (key === "visto") {
      const vv = String(v).trim().toLowerCase();
      (out as any)[key] =
        vv === "si" || vv === "sí" || vv === "true" || vv === "1";
    } else if (key === "anio") {
      const n = Number(v);
      (out as any)[key] = isNaN(n) ? String(v ?? "") : n;
    } else {
      (out as any)[key] = v;
    }
  }
  return out;
}

function parseCSVToFicha(text: string): FichaTecnicaData | null {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;

  const splitter = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitter(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const first = splitter(lines[1]).map((c) => c.replace(/^"|"$/g, ""));
  const row: Record<string, any> = {};
  headers.forEach((h, i) => (row[h] = first[i]));
  return mapRowToFicha(row);
}

function toInputDatetime(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import type { FichaTecnicaData } from "@/components/FichaTecnica"; // solo tipo

// /* ====================== Categorías y Subcategorías ====================== */
// type CatSlug =
//   | "periodismo-comunicacion"
//   | "publicidad-marketing"
//   | "cine-comunicacion-audiovisual";

// const CATEGORIES: { value: CatSlug; label: string; hint?: string }[] = [
//   { value: "periodismo-comunicacion",      label: "Periodismo y Comunicación",      hint: "Reportajes, podcast, multimedios…" },
//   { value: "publicidad-marketing",         label: "Publicidad y Marketing",         hint: "Proyectos de título, exámenes…" },
//   { value: "cine-comunicacion-audiovisual",label: "Cine y Comunicación Audiovisual",hint: "Cortos, largos, tesinas…" },
// ];

// const SUBCATS: Record<CatSlug, string[]> = {
//   "periodismo-comunicacion": [
//     "Reportajes de información periodística",
//     "multimedios",
//     "podcast",
//     "audiovisuales",
//     "Revista Kiltra",
//     "Paper - artículos",
//     "poster de investigación notas informativas 2° año",
//     "noticiero radial 2° año",
//     "noticiero radial 3° año",
//   ],
//   "publicidad-marketing": [
//     "Proyectos de título: video casos",
//     "Exámenes de 1° año",
//     "Exámenes de 2° año",
//     "Exámenes de 3° año",
//     "Exámenes de 4° año",
//   ],
//   "cine-comunicacion-audiovisual": [
//     "Cortometrajes Ficción: 1° año",
//     "Cortometrajes Ficción: 2° año",
//     "Cortometrajes Ficción: 3° año",
//     "Cortometrajes Ficción: 4° año",
//     "Cortometrajes documentales: 1° año",
//     "Cortometrajes documentales: 2° año",
//     "Cortometrajes documentales: 3° año",
//     "Largometrajes",
//     "Tesinas",
//     "Artículos de investigación",
//   ],
// };

// const isValidSubcat = (cat: CatSlug, sub: string) => SUBCATS[cat]?.includes(sub) ?? false;

// /* ====================== Campos de Ficha ====================== */
// const FIELDS: Array<{
//   key: keyof FichaTecnicaData;
//   label: string;
//   type?: "text" | "textarea" | "datetime" | "checkbox" | "number";
// }> = [
//   { key: "titulo", label: "Título" },
//   { key: "director", label: "Director" },
//   { key: "productor", label: "Productor" },
//   { key: "jefeProduccion", label: "Jefe de Producción" },
//   { key: "directorFotografia", label: "Director de Fotografía" },
//   { key: "sonido", label: "Sonido" },
//   { key: "direccionArte", label: "Dirección de Arte" },
//   { key: "asistenteDireccion", label: "Asistente de Dirección" },
//   { key: "montaje", label: "Montaje" },
//   { key: "otroCargo", label: "Otro cargo" },
//   { key: "contactoPrincipal", label: "Contacto Principal" },
//   { key: "correo", label: "Correo" },
//   { key: "curso", label: "Curso" },
//   { key: "profesor", label: "Profesor" },
//   { key: "anio", label: "Año", type: "number" },
//   { key: "duracion", label: "Duración" },
//   { key: "sinopsis", label: "Sinopsis", type: "textarea" },
//   { key: "procesoAnterior", label: "Proceso anterior", type: "textarea" },
//   { key: "pendientes", label: "Pendientes", type: "textarea" },
//   { key: "visto", label: "Visto", type: "checkbox" },
//   { key: "reunion", label: "Reunión", type: "datetime" },
//   { key: "formato", label: "Formato" },
//   { key: "estado", label: "Estado" },
//   { key: "deliveryEstimado", label: "Delivery estimado" },
//   { key: "seleccion", label: "Selección" },
//   { key: "link", label: "Link de visionado" },
//   { key: "foto", label: "Foto (URL)" },
// ];

// /* ====================== Componente ====================== */
// export default function DropUploader({
//   onUploaded,
//   accept = ".mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.gif,.webp,.avif,.pdf,.doc,.docx,.txt",
//   maxSizeMB = 4096,
// }: {
//   onUploaded?: (id?: string) => void;
//   accept?: string;
//   maxSizeMB?: number;
// }) {
//   const inputRef = useRef<HTMLInputElement | null>(null);
//   const [dragOver, setDragOver] = useState(false);
//   const [file, setFile] = useState<File | null>(null);
//   const [uploading, setUploading] = useState(false);
//   const [msg, setMsg] = useState<string | null>(null);

//   // categoría & subcategoría (persisten)
//   const [category, setCategory] = useState<CatSlug>(() => {
//     if (typeof window === "undefined") return "periodismo-comunicacion";
//     return (localStorage.getItem("uploadCategoryV3") as CatSlug) || "periodismo-comunicacion";
//   });
//   const subcats = useMemo(() => SUBCATS[category] || [], [category]);
//   const [subcategory, setSubcategory] = useState<string>(() => {
//     if (typeof window === "undefined") return "";
//     const key = `uploadSub_${localStorage.getItem("uploadCategoryV3") || "periodismo-comunicacion"}`;
//     return localStorage.getItem(key) || "";
//   });
//   useEffect(() => {
//     localStorage.setItem("uploadCategoryV3", category);
//     const key = `uploadSub_${category}`;
//     const saved = localStorage.getItem(key) || "";
//     setSubcategory(isValidSubcat(category, saved) ? saved : "");
//   }, [category]);
//   useEffect(() => {
//     if (subcategory) localStorage.setItem(`uploadSub_${category}`, subcategory);
//   }, [subcategory, category]);

//   // Ficha técnica (sin preview)
//   const [ficha, setFicha] = useState<FichaTecnicaData>({});
//   const setField = (key: keyof FichaTecnicaData, val: any) =>
//     setFicha((prev) => ({ ...prev, [key]: val }));

//   // CSV
//   const onImportFichaCSV = async (file: File) => {
//     const text = await file.text();
//     const parsed = parseCSVToFicha(text);
//     if (parsed) setFicha((prev) => ({ ...prev, ...parsed }));
//     else setMsg("No se pudo leer el CSV. Verifica encabezados y comas.");
//   };

//   // File handlers
//   const openPicker = () => inputRef.current?.click();
//   const handleSelect = (f: File) => {
//     if (!f) return;
//     if (f.size > maxSizeMB * 1024 * 1024) {
//       setMsg(`El archivo supera ${maxSizeMB}MB`);
//       return;
//     }
//     setMsg(null);
//     setFile(f);
//   };
//   const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const f = e.target.files?.[0];
//     if (f) handleSelect(f);
//   };
//   const onDrop = (e: React.DragEvent) => {
//     e.preventDefault();
//     setDragOver(false);
//     const f = e.dataTransfer.files?.[0];
//     if (f) handleSelect(f);
//   };

//   // Subida
//   const upload = async () => {
//     if (!file || uploading) return;
//     if (!category) return setMsg("Selecciona una categoría.");
//     if (!subcategory) return setMsg("Selecciona una subcategoría.");

//     try {
//       setUploading(true);
//       const fd = new FormData();
//       fd.append("file", file);
//       fd.append("category", category);
//       fd.append("subcategory", subcategory);
//       fd.append("ficha", JSON.stringify(ficha));

//       const res = await fetch("/api/upload-minio", { method: "POST", body: fd });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

//       const id: string | undefined =
//         data?.id || data?.upload?.id || data?.file?.id || data?.record?.id;

//       setMsg("✅ Subido correctamente");
//       setFile(null);
//       onUploaded?.(id);
//     } catch (e: any) {
//       setMsg(`❌ Error: ${e?.message || "falló la subida"}`);
//     } finally {
//       setUploading(false);
//     }
//   };

//   /* ====================== UI (transparente, sin márgenes laterales propios) ====================== */
//   return (
//     <div className="w-full min-h-screen text-white bg-transparent">
//       {/* Bloque categorías/subcategorías (TRANSPARENTE) */}
//       <div className="w-full py-4 border-b border-zinc-800 bg-transparent">
//         <div className="px-0">
//           <p className="text-sm text-zinc-300 mb-2">Guardar en categoría:</p>
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
//             {CATEGORIES.map((c) => {
//               const active = category === c.value;
//               return (
//                 <button
//                   key={c.value}
//                   type="button"
//                   onClick={() => setCategory(c.value)}
//                   className={[
//                     "rounded-lg border px-3 py-2 text-sm text-left transition",
//                     active
//                       ? "border-orange-400/70 bg-orange-500/10"
//                       : "border-zinc-700/80 bg-transparent hover:bg-white/5",
//                   ].join(" ")}
//                   aria-pressed={active}
//                 >
//                   <div className="font-medium">{c.label}</div>
//                   {c.hint && <div className="text-xs text-zinc-400 mt-0.5">{c.hint}</div>}
//                 </button>
//               );
//             })}
//           </div>

//           <div className="mt-3">
//             <label className="text-sm text-zinc-300">Subcategoría</label>
//             <select
//               value={subcategory}
//               onChange={(e) => setSubcategory(e.target.value)}
//               className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-700/80 bg-transparent text-sm"
//             >
//               <option value="">Selecciona subcategoría…</option>
//               {subcats.map((s) => (
//                 <option key={s} value={s} className="bg-black">
//                   {s}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* Dropzone (TRANSPARENTE) */}
//       <div className="w-full py-5 bg-transparent">
//         <div
//           role="button"
//           aria-label="Zona para subir archivo"
//           onClick={openPicker}
//           onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
//           onDragLeave={() => setDragOver(false)}
//           onDrop={onDrop}
//           className={`w-full min-h-44 sm:min-h-56 lg:min-h-64
//                       rounded-xl border-2
//                       ${dragOver ? "border-orange-300/80" : "border-orange-500/60"}
//                       bg-transparent hover:bg-white/5 transition
//                       grid place-items-center text-center cursor-pointer select-none`}
//         >
//           <div className="px-4">
//             <div className="text-white font-semibold text-base sm:text-lg lg:text-xl truncate">
//               {file ? file.name : "Haz click o arrastra para subir un archivo"}
//             </div>
//             <div className="text-zinc-400 text-xs sm:text-sm mt-2">
//               Video/Documento ({maxSizeMB}MB máximo)
//             </div>
//           </div>
//           <input
//             ref={inputRef}
//             type="file"
//             accept={accept}
//             className="hidden"
//             onChange={onInputChange}
//           />
//         </div>

//         <div className="mt-4 flex flex-wrap items-center gap-3 px-0">
//           <button
//             onClick={upload}
//             disabled={!file || uploading || !subcategory}
//             className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2 rounded"
//           >
//             {uploading ? "Subiendo..." : "Subir archivo"}
//           </button>
//           <button
//             type="button"
//             disabled={uploading}
//             onClick={() => { setFile(null); setMsg(null); }}
//             className="px-4 py-2 rounded border border-zinc-700/80 hover:border-zinc-500 text-sm"
//           >
//             Limpiar archivo
//           </button>
//           {msg && <div className="text-sm text-zinc-300 break-words">{msg}</div>}
//         </div>
//       </div>

//       {/* Ficha técnica (TRANSPARENTE) */}
//       <div className="w-full py-5 border-t border-zinc-800 bg-transparent">
//         <div className="px-0">
//           <div className="flex items-center justify-between flex-wrap gap-3">
//             <div>
//               <h3 className="text-base font-semibold">Ficha Técnica</h3>
//               <p className="text-[12px] text-zinc-400">
//                 Completa los campos o importa un CSV con los encabezados estándar.
//               </p>
//             </div>
//             <label className="text-xs px-3 py-1.5 rounded border border-zinc-700/80 hover:border-zinc-500 cursor-pointer">
//               Importar CSV
//               <input
//                 type="file"
//                 accept=".csv"
//                 className="hidden"
//                 onChange={async (e) => {
//                   const f = e.target.files?.[0];
//                   if (f) await onImportFichaCSV(f);
//                 }}
//               />
//             </label>
//           </div>

//           {/* Campos */}
//           <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
//             {FIELDS.map(({ key, label, type }) => (
//               <div
//                 key={String(key)}
//                 className={type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}
//               >
//                 <label className="block text-[11px] text-zinc-400 mb-1">{label}</label>

//                 {type === "textarea" ? (
//                   <textarea
//                     value={(ficha[key] as any) ?? ""}
//                     onChange={(e) => setField(key, e.target.value)}
//                     rows={3}
//                     className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm placeholder:text-zinc-500"
//                   />
//                 ) : type === "checkbox" ? (
//                   <div className="h-9 flex items-center">
//                     <input
//                       type="checkbox"
//                       checked={!!ficha[key]}
//                       onChange={(e) => setField(key, e.target.checked)}
//                       className="h-4 w-4"
//                     />
//                   </div>
//                 ) : type === "number" ? (
//                   <input
//                     type="number"
//                     value={String(ficha[key] ?? "")}
//                     onChange={(e) => setField(key, e.target.value)}
//                     className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
//                   />
//                 ) : type === "datetime" ? (
//                   <input
//                     type="datetime-local"
//                     value={toInputDatetime(ficha[key] as string | undefined)}
//                     onChange={(e) => setField(key, e.target.value)}
//                     className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
//                   />
//                 ) : (
//                   <input
//                     type="text"
//                     value={(ficha[key] as any) ?? ""}
//                     onChange={(e) => setField(key, e.target.value)}
//                     className="w-full px-3 py-2 rounded border border-zinc-700/80 bg-transparent text-sm"
//                   />
//                 )}
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ====================== Helpers ====================== */
// function norm(s: string) {
//   return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "");
// }

// const COLMAP: Record<string, keyof FichaTecnicaData> = {
//   titulo: "titulo",
//   director: "director",
//   productor: "productor",
//   jefeproduccion: "jefeProduccion",
//   directordefotografia: "directorFotografia",
//   sonido: "sonido",
//   direcciondearte: "direccionArte",
//   asistentedireccion: "asistenteDireccion",
//   montaje: "montaje",
//   otrocargo: "otroCargo",
//   contactoprincipal: "contactoPrincipal",
//   correo: "correo",
//   curso: "curso",
//   profesor: "profesor",
//   anio: "anio",
//   año: "anio",
//   duracion: "duracion",
//   sinopsis: "sinopsis",
//   procesoanterior: "procesoAnterior",
//   pendientes: "pendientes",
//   visto: "visto",
//   reunion: "reunion",
//   formato: "formato",
//   estado: "estado",
//   deliveryestimado: "deliveryEstimado",
//   seleccion: "seleccion",
//   link: "link",
//   foto: "foto",
// };

// function mapRowToFicha(row: Record<string, any>): FichaTecnicaData {
//   const out: FichaTecnicaData = {};
//   for (const [k, v] of Object.entries(row)) {
//     const key = COLMAP[norm(k)];
//     if (!key) continue;
//     if (key === "visto") {
//       const vv = String(v).trim().toLowerCase();
//       (out as any)[key] = vv === "si" || vv === "sí" || vv === "true" || vv === "1";
//     } else if (key === "anio") {
//       const n = Number(v);
//       (out as any)[key] = isNaN(n) ? String(v ?? "") : n;
//     } else {
//       (out as any)[key] = v;
//     }
//   }
//   return out;
// }

// function parseCSVToFicha(text: string): FichaTecnicaData | null {
//   const lines = text.split(/\r?\n/).filter(Boolean);
//   if (lines.length < 2) return null;

//   // parser simple que respeta comillas
//   const splitter = (line: string) => {
//     const out: string[] = [];
//     let cur = "";
//     let inQ = false;
//     for (let i = 0; i < line.length; i++) {
//       const ch = line[i];
//       if (ch === '"') { inQ = !inQ; continue; }
//       if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
//       cur += ch;
//     }
//     out.push(cur.trim());
//     return out;
//   };

//   const headers = splitter(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
//   const first = splitter(lines[1]).map((c) => c.replace(/^"|"$/g, ""));
//   const row: Record<string, any> = {};
//   headers.forEach((h, i) => (row[h] = first[i]));
//   return mapRowToFicha(row);
// }

// function toInputDatetime(v?: string) {
//   if (!v) return "";
//   const d = new Date(v);
//   if (isNaN(d.getTime())) return v;
//   const pad = (n: number) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// }


