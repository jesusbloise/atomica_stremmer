"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

/* ============ Modo datos en vivo ============ */
const DEMO_MODE = false;
const API_PATH = "/api/uploads";

/* ============ CATEGORÍAS PRINCIPALES (4) ============ */
const CATS = [
  {
    slug: "retail",
    label: "Retail",
    cover: "/retail1.png", // ajusta estas rutas según tus imágenes
    desc: "Armados, evento, precio y calendario comercial",
  },
  {
    slug: "moda",
    label: "Moda",
    cover: "/moda1.png",
    desc: "Campañas, catálogos, lookbooks y contenido audiovisual de moda.",
  },
  {
    slug: "marca",
    label: "Marca",
    cover: "/marca1.png",
    desc: "Branding, identidad visual, lanzamientos y posicionamiento de marca.",
  },
  {
    slug: "comunicacion-interna",
    label: "Comunicación Interna",
    cover: "/comunicacion1.png",
    desc: "Piezas para comunicación interna, cultura, onboarding y mensajes clave.",
  },
] as const;

/* ============ SUBCATEGORÍAS ============ */
const SUBCATS: Record<string, string[]> = {
  retail: [
    "Calendario Comercial",
    "Eventos Precio",
    "Liquidación",
  ],
  moda: [
    "Americanino",
    "Basement",
    "Invierno",
    "University Club",
    "Verano",
  ],
  marca: [
    "Campaña Marca",
    "Día Madre",
    "Escolares",
    "Navidad",
  ],
  // Comunicación Interna NO tiene subcategorías
  "comunicacion-interna": [],
};

/* ===== Tipos de tu API ===== */
type UploadItem = {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at?: string;
  size_in_bytes?: number;
  tipo?: "video" | "documento" | null;
  category?: string | null;
  subcategory?: string | null;
};

/* ===== Utils ===== */
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;
const DOC_EXT = /\.doc$/i;

function stripExt(s?: string | null) {
  if (!s) return "Archivo";

  // Intentamos decodificar sin romper la app
  let safe = s;
  try {
    safe = decodeURIComponent(s);
  } catch {
    // Si la URI está mal formada, usamos el string original
    safe = s;
  }

  const base = safe.split("/").pop() || safe;
  return base.replace(/\.[^.\/\\]+$/g, "");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function getPerPage(w: number) {
  if (w < 480) return 1;
  if (w < 768) return 2;
  if (w < 1024) return 3;
  if (w < 1280) return 4;
  return 5;
}
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ===== Hook: detectar móvil (sin hover) ===== */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    try {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    } catch {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);
  return isMobile;
}

/* ====== Preview para PDF / DOCX / DOC ====== */
function DocumentPreview({
  url,
  kind,
  isMobile,
}: {
  url: string;
  kind: "pdf" | "docx" | "doc";
  isMobile: boolean;
}) {
  if (kind === "pdf") {
    if (isMobile) {
      return (
        <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-200 text-lg font-semibold tracking-widest">
          PDF
        </div>
      );
    }
    return (
      <iframe
        title="Vista previa PDF"
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        className="absolute inset-0 w-full h-full pointer-events-none"
        loading="lazy"
      />
    );
  }
  if (kind === "docx") {
    return (
      <div className="absolute inset-0">
        <Image
          src="/docx1.png"
          alt="Documento DOCX"
          fill
          className="object-cover pointer-events-none select-none"
        />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-200 text-lg font-semibold tracking-widest">
      DOC
    </div>
  );
}

/* ====================== Componente principal ====================== */
export default function CategoryFiles({ slug }: { slug: string }) {
  const [activeSlug, setActiveSlug] = useState(slug);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UploadItem[]>([]);

  const [activeSub, setActiveSub] = useState<string | undefined>(undefined);
  const [fullViewSub, setFullViewSub] = useState<string | null>(null);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => setActiveSlug(slug), [slug]);

  /* ======= fetch ÚNICO por cambio de categoría ======= */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        if (DEMO_MODE) {
          setRows([]);
          return;
        }

        const url = new URL(API_PATH, window.location.origin);
        url.searchParams.set("category", activeSlug);
        url.searchParams.set("limit", "500");

        const res = await fetch(url.toString(), {
          cache: "no-store",
          headers: { "x-no-cache": String(Date.now()) },
        });
        const arr = await res.json();

        if (!alive) return;

        const list: UploadItem[] = Array.isArray(arr) ? arr : [];
        list.sort(
          (a, b) =>
            (Date.parse(b.uploaded_at || "") || 0) -
            (Date.parse(a.uploaded_at || "") || 0)
        );

        setRows(list);
      } catch (e) {
        console.error("Carga categoría error:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeSlug]);

  const subList = SUBCATS[activeSlug] || [];
  const grouped = useMemo(() => {
    const map = new Map<string, UploadItem[]>();
    subList.forEach((s) => map.set(s, []));
    const otrosKey = "Otros";
    if (!map.has(otrosKey)) map.set(otrosKey, []);
    for (const it of rows) {
      const sub =
        it.subcategory && subList.includes(it.subcategory)
          ? it.subcategory
          : otrosKey;
      map.get(sub)!.push(it);
    }
    if ((map.get("Otros") || []).length === 0) map.delete("Otros");
    return map;
  }, [rows, subList]);

  const title = CATS.find((c) => c.slug === activeSlug)?.label ?? "Sección";

  useEffect(() => {
    if (!activeSub) return;
    const id = slugify(activeSub);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSub]);

  const openFullView = (sub: string) => setFullViewSub(sub);
  const closeFullView = () => setFullViewSub(null);

  const fullItems = useMemo(() => {
    if (!fullViewSub) return [];
    const items = rows.filter((r) => r.subcategory === fullViewSub);
    if (!items.length && fullViewSub === "Otros") {
      return rows.filter(
        (r) => !r.subcategory || !subList.includes(r.subcategory)
      );
    }
    return items;
  }, [fullViewSub, rows, subList]);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6 text-white">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>

      {/* Chips de subcategorías */}
      <div className="flex flex-wrap gap-2 mb-4">
        {subList.map((sub) => {
          const isOpen = fullViewSub === sub;
          return (
            <button
              key={sub}
              onClick={() => {
                if (isOpen) {
                  setFullViewSub(null);
                } else {
                  setFullViewSub(sub);
                }
                setActiveSub((prev) => (prev === sub ? undefined : sub));
              }}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                isOpen
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                  : "bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white"
              }`}
              title={`Ver todos en ${sub}`}
            >
              {sub}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-zinc-400 py-10">Cargando…</div>
      ) : grouped.size === 0 ? (
        <div className="text-zinc-400 py-10">
          No hay archivos en esta sección.
        </div>
      ) : (
        <>
          {/* Secciones por subcategoría */}
          {[...grouped.entries()].map(([sub, items]) => {
            const id = slugify(sub);
            if (!items.length) return null;
            return (
              <div
                key={sub}
                ref={(el) => (sectionRefs.current[id] = el)}
                id={`sub-${id}`}
                className="mb-10"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl md:text-2xl font-semibold">{sub}</h2>
                  <button
                    onClick={() => openFullView(sub)}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition"
                    title="Ver todos los archivos"
                  >
                    Ver más
                  </button>
                </div>
                <CategoryCarousel items={items} />
              </div>
            );
          })}

          {/* ======== CATEGORÍAS PRINCIPALES (ajustadas) ======== */}
          <div className="w-full flex justify-center">
            <div className="w-full max-w-[1200px] px-4 py-8">
              <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">
                Categorías principales
              </h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-stretch auto-rows-fr gap-4 sm:gap-6">
                {CATS.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/organizar/${c.slug}`}
                    className="group block h-full min-w-0"
                  >
                    <article className="h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow">
                      {/* igual que en la landing: todas del mismo tamaño + cover → contain en hover */}
                      <div className="relative w-full aspect-[4/3] overflow-hidden bg-black">
                        <Image
                          src={c.cover}
                          alt={c.label}
                          fill
                          className="object-cover group-hover:object-contain transition-all duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          priority={i === 0}
                        />
                      </div>
                      <div className="p-4 mt-auto text-center">
                        <h3 className="text-sm sm:text-base font-semibold truncate">
                          {c.label}
                        </h3>
                        <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-snug">
                          {c.desc}
                        </p>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Vista completa de subcategoría (overlay) ===== */}
      {fullViewSub && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-50 h-full overflow-y-auto">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl md:text-3xl font-bold">
                  {fullViewSub} — Todos los archivos
                </h2>
                <button
                  onClick={closeFullView}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-white"
                >
                  Volver
                </button>
              </div>

              {fullItems.length === 0 ? (
                <div className="text-zinc-400 py-12">
                  Sin archivos en esta subcategoría.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {fullItems.map((u) => (
                    <CardItem key={u.id} item={u} />
                  ))}
                </div>
              )}
              <div className="h-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================== Card individual ====================== */
function CardItem({ item }: { item: UploadItem }) {
  const isMobile = useIsMobile();
  const name = stripExt(item.file_name || item.file_path);
  const url = item.file_path || "";
  const isVideo = item.tipo === "video" || VIDEO_EXT.test(url);
  const isPdf = PDF_EXT.test(url);
  const isDocx = DOCX_EXT.test(url);
  const isDoc = !isDocx && DOC_EXT.test(url);

  return (
    <motion.article
      className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm"
      initial={isMobile ? undefined : "rest"}
      animate={isMobile ? undefined : "rest"}
      whileHover={isMobile ? undefined : "hover"}
    >
      <div className="relative h-[48vh] sm:h-[50vh] md:h-[18rem] lg:h-[22rem] xl:h-[24rem] bg-zinc-800 overflow-hidden">
        {isVideo ? (
          <motion.video
            src={url}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            controls={false}
            disablePictureInPicture
            className="absolute inset-0 w-full h-full object-cover"
            variants={
              isMobile
                ? undefined
                : {
                    rest: { scale: 1 },
                    hover: {
                      scale: 1.06,
                      transition: { duration: 0.6 },
                    },
                  }
            }
          />
        ) : isPdf ? (
          <DocumentPreview url={url} kind="pdf" isMobile={isMobile} />
        ) : isDocx ? (
          <DocumentPreview url={url} kind="docx" isMobile={isMobile} />
        ) : isDoc ? (
          <DocumentPreview url={url} kind="doc" isMobile={isMobile} />
        ) : (
          <motion.div
            className="absolute inset-0 grid place-items-center text-zinc-300 text-xs"
            variants={
              isMobile
                ? undefined
                : {
                    rest: { scale: 1 },
                    hover: {
                      scale: 1.04,
                      transition: { duration: 0.6 },
                    },
                  }
            }
          >
            Sin vista previa
          </motion.div>
        )}

        {isMobile ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/55" />
        ) : (
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50"
            variants={{
              rest: { opacity: 0.65 },
              hover: {
                opacity: 0.9,
                transition: { duration: 0.25 },
              },
            }}
          />
        )}

        <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
            <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-40 overflow-auto">
              {name}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              <Link href={`/videos/${item.id}`} aria-label={`Ver más sobre ${name}`}>
                <motion.button
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.96 }}
                  className="text-sm px-4 py-2 rounded border text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 transition"
                >
                  Ver más
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ====================== Carrusel ====================== */
function CategoryCarousel({ items }: { items: UploadItem[] }) {
  const [perPage, setPerPage] = useState(5);
  const [page, setPage] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const update = () => setPerPage(getPerPage(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const pages = useMemo(() => chunk(items, perPage), [items, perPage]);
  const total = pages.length;

  useEffect(() => {
    if (page > total - 1) setPage(0);
  }, [total, page]);

  const prev = () => total && setPage((p) => (p - 1 + total) % total);
  const next = () => total && setPage((p) => (p + 1) % total);

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) =>
    (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) (dx < 0 ? next() : prev());
    touchStartX.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="Archivos"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${page * 100}%)` }}
      >
        {pages.map((slice, idx) => (
          <div key={idx} className="w-full shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {slice.map((u) => (
                <CardItem key={u.id} item={u} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={() => setPage((p) => (p - 1 + total) % total)}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
          >
            ‹
          </button>
          <button
            onClick={() => setPage((p) => (p + 1) % total)}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
          >
            ›
          </button>
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Ir al grupo ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${
                  i === page ? "w-6 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}


// "use client";

// import Link from "next/link";
// import Image from "next/image";
// import { motion } from "framer-motion";
// import { useEffect, useMemo, useRef, useState } from "react";

// /* ============ Modo datos en vivo ============ */
// const DEMO_MODE = false;
// const API_PATH = "/api/uploads";

// /* ============ CATEGORÍAS PRINCIPALES (3) ============ */
// const CATS = [
//   { slug: "periodismo-comunicacion", label: "Periodismo y Comunicación", cover: "/otros.png", desc: "Reportajes, multimedios, podcast y más." },
//   { slug: "publicidad-marketing", label: "Publicidad y Marketing", cover: "/documentales.png", desc: "Proyectos de título y exámenes por nivel." },
//   { slug: "cine-comunicacion-audiovisual", label: "Cine y Comunicación Audiovisual", cover: "/peliculas.png", desc: "Cortos, largos, tesinas y artículos." },
// ] as const;

// /* ============ SUBCATEGORÍAS ============ */
// const SUBCATS: Record<string, string[]> = {
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

// /* ===== Tipos de tu API ===== */
// type UploadItem = {
//   id: string;
//   file_name: string;
//   file_path: string;
//   uploaded_at?: string;
//   size_in_bytes?: number;
//   tipo?: "video" | "documento" | null;
//   category?: string | null;
//   subcategory?: string | null;
// };

// /* ===== Utils ===== */
// const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
// const PDF_EXT = /\.pdf$/i;
// const DOCX_EXT = /\.docx$/i;
// const DOC_EXT = /\.doc$/i;

// function stripExt(s?: string | null) {
//   if (!s) return "Archivo";
//   const base = decodeURIComponent(s).split("/").pop() || s;
//   return base.replace(/\.[^.\/\\]+$/g, "");
// }
// function chunk<T>(arr: T[], size: number): T[][] {
//   const out: T[][] = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }
// function getPerPage(w: number) {
//   if (w < 480) return 1;
//   if (w < 768) return 2;
//   if (w < 1024) return 3;
//   if (w < 1280) return 4;
//   return 5;
// }
// function slugify(input: string) {
//   return input
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/\p{Diacritic}/gu, "")
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/(^-|-$)/g, "");
// }

// /* ===== Hook: detectar móvil (sin hover) ===== */
// function useIsMobile() {
//   const [isMobile, setIsMobile] = useState(false);
//   useEffect(() => {
//     const mql = window.matchMedia("(max-width: 639px)");
//     const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
//     setIsMobile(mql.matches);
//     try {
//       mql.addEventListener("change", onChange);
//       return () => mql.removeEventListener("change", onChange);
//     } catch {
//       mql.addListener(onChange);
//       return () => mql.removeListener(onChange);
//     }
//   }, []);
//   return isMobile;
// }

// /* ====== Preview para PDF / DOCX / DOC ====== */
// function DocumentPreview({ url, kind, isMobile }: { url: string; kind: "pdf" | "docx" | "doc"; isMobile: boolean; }) {
//   if (kind === "pdf") {
//     if (isMobile) {
//       return (
//         <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-200 text-lg font-semibold tracking-widest">
//           PDF
//         </div>
//       );
//     }
//     return (
//       <iframe
//         title="Vista previa PDF"
//         src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
//         className="absolute inset-0 w-full h-full pointer-events-none"
//         loading="lazy"
//       />
//     );
//   }
//   if (kind === "docx") {
//     return (
//       <div className="absolute inset-0">
//         <Image src="/docx1.png" alt="Documento DOCX" fill className="object-cover pointer-events-none select-none" />
//       </div>
//     );
//   }
//   return (
//     <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-200 text-lg font-semibold tracking-widest">
//       DOC
//     </div>
//   );
// }

// /* ====================== Componente principal ====================== */
// export default function CategoryFiles({ slug }: { slug: string }) {
//   const [activeSlug, setActiveSlug] = useState(slug);
//   const [loading, setLoading] = useState(true);
//   const [rows, setRows] = useState<UploadItem[]>([]);

//   // subcategoría seleccionada (solo estado local, sin tocar URL)
//   const [activeSub, setActiveSub] = useState<string | undefined>(undefined);

//   // vista completa (mostrar TODO de una subcategoría)
//   const [fullViewSub, setFullViewSub] = useState<string | null>(null);

//   // refs a cada sección para scroll suave
//   const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

//   useEffect(() => setActiveSlug(slug), [slug]);

//   /* ======= fetch ÚNICO por cambio de categoría ======= */
//   useEffect(() => {
//     let alive = true;

//     (async () => {
//       try {
//         setLoading(true);

//         if (DEMO_MODE) {
//           setRows([]);
//           return;
//         }

//         const url = new URL(API_PATH, window.location.origin);
//         url.searchParams.set("category", activeSlug);
//         url.searchParams.set("limit", "500");

//         const res = await fetch(url.toString(), {
//           cache: "no-store",
//           headers: { "x-no-cache": String(Date.now()) },
//         });
//         const arr = await res.json();

//         if (!alive) return;

//         const list: UploadItem[] = Array.isArray(arr) ? arr : [];
//         list.sort(
//           (a, b) =>
//             (Date.parse(b.uploaded_at || "") || 0) -
//             (Date.parse(a.uploaded_at || "") || 0)
//         );

//         setRows(list);
//       } catch (e) {
//         console.error("Carga categoría error:", e);
//         if (alive) setRows([]);
//       } finally {
//         if (alive) setLoading(false);
//       }
//     })();

//     return () => {
//       alive = false;
//     };
//   }, [activeSlug]);

//   // agrupar por subcategoría (en el orden del catálogo)
//   const subList = SUBCATS[activeSlug] || [];
//   const grouped = useMemo(() => {
//     const map = new Map<string, UploadItem[]>();
//     subList.forEach((s) => map.set(s, []));
//     const otrosKey = "Otros";
//     if (!map.has(otrosKey)) map.set(otrosKey, []);
//     for (const it of rows) {
//       const sub = it.subcategory && subList.includes(it.subcategory) ? it.subcategory : otrosKey;
//       map.get(sub)!.push(it);
//     }
//     if ((map.get("Otros") || []).length === 0) map.delete("Otros");
//     return map;
//   }, [rows, subList]);

//   const title = CATS.find((c) => c.slug === activeSlug)?.label ?? "Sección";

//   // chips: solo setean estado local y scrollean
//   useEffect(() => {
//     if (!activeSub) return;
//     const id = slugify(activeSub);
//     const el = sectionRefs.current[id];
//     if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
//   }, [activeSub]);

//   const openFullView = (sub: string) => setFullViewSub(sub);
//   const closeFullView = () => setFullViewSub(null);

//   // items de la vista completa
//   const fullItems = useMemo(() => {
//     if (!fullViewSub) return [];
//     const items = rows.filter((r) => r.subcategory === fullViewSub);
//     // Si la sub no está catalogada, incluimos "Otros" como fallback
//     if (!items.length && fullViewSub === "Otros") {
//       return rows.filter((r) => !r.subcategory || !subList.includes(r.subcategory));
//     }
//     return items;
//   }, [fullViewSub, rows, subList]);

//   return (
//     <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6 text-white">
//       <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>

//     {/* Chips de subcategorías (abren vista completa) */}
// <div className="flex flex-wrap gap-2 mb-4">
//   {subList.map((sub) => {
//     const isOpen = fullViewSub === sub;
//     return (
//       <button
//         key={sub}
//         onClick={() => {
//           // Si ya está abierta, la cerramos; si no, la abrimos
//           if (isOpen) {
//             setFullViewSub(null);
//           } else {
//             setFullViewSub(sub); // ⬅️ abre la vista completa de la subcategoría
//           }
//           // (Opcional) sincroniza el chip “activo” si quieres mantener el estilo
//           setActiveSub((prev) => (prev === sub ? undefined : sub));
//         }}
//         className={`px-3 py-1.5 rounded-full text-xs border transition ${
//           isOpen
//             ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
//             : "bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white"
//         }`}
//         title={`Ver todos en ${sub}`}
//       >
//         {sub}
//       </button>
//     );
//   })}
// </div>


//       {loading ? (
//         <div className="text-zinc-400 py-10">Cargando…</div>
//       ) : grouped.size === 0 ? (
//         <div className="text-zinc-400 py-10">No hay archivos en esta sección.</div>
//       ) : (
//         <>
//           {/* ======= UNA SECCIÓN (carrusel) POR SUBCATEGORÍA ======= */}
//           {[...grouped.entries()].map(([sub, items]) => {
//             const id = slugify(sub);
//             if (!items.length) return null;
//             return (
//               <div key={sub} ref={(el) => (sectionRefs.current[id] = el)} id={`sub-${id}`} className="mb-10">
//                 <div className="flex items-center justify-between mb-3">
//                   <h2 className="text-xl md:text-2xl font-semibold">{sub}</h2>
//                   <button
//                     onClick={() => openFullView(sub)}
//                     className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition"
//                     title="Ver todos los archivos"
//                   >
//                     Ver más
//                   </button>
//                 </div>
//                 <CategoryCarousel items={items} />
//               </div>
//             );
//           })}

//           {/* ======== CATEGORÍAS (las 3) ======== */}
//           <div className="w-full flex justify-center">
//             <div className="w-full max-w-[1200px] px-4 py-8">
//               <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">Nuestra Facultad</h1>

//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr gap-4 sm:gap-6">
//                 {CATS.map((c, i) => (
//                   <Link key={c.slug} href={`/organizar/${c.slug}`} className="group block h-full min-w-0">
//                     <article className="h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow">
//                       <div className="relative aspect-square">
//                         <Image
//                           src={c.cover}
//                           alt={c.label}
//                           fill
//                           className="object-cover"
//                           sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
//                           priority={i === 0}
//                         />
//                       </div>
//                       <div className="p-4 mt-auto text-center">
//                         <h3 className="text-sm sm:text-base font-semibold truncate">{c.label}</h3>
//                         <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-snug">{c.desc}</p>
//                       </div>
//                     </article>
//                   </Link>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </>
//       )}

//       {/* ===== Vista completa de subcategoría (overlay sin navegar) ===== */}
//       {fullViewSub && (
//         <div className="fixed inset-0 z-40">
//           <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
//           <div className="relative z-50 h-full overflow-y-auto">
//             <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-2xl md:text-3xl font-bold">
//                   {fullViewSub} — Todos los archivos
//                 </h2>
//                 <button
//                   onClick={closeFullView}
//                   className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-white"
//                 >
//                   Volver
//                 </button>
//               </div>

//               {fullItems.length === 0 ? (
//                 <div className="text-zinc-400 py-12">Sin archivos en esta subcategoría.</div>
//               ) : (
//                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
//                   {fullItems.map((u) => (
//                     <CardItem key={u.id} item={u} />
//                   ))}
//                 </div>
//               )}
//               <div className="h-8" />
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ====================== Card individual para la vista completa ====================== */
// function CardItem({ item }: { item: UploadItem }) {
//   const isMobile = useIsMobile();
//   const name = stripExt(item.file_name || item.file_path);
//   const url = item.file_path || "";
//   const isVideo = item.tipo === "video" || VIDEO_EXT.test(url);
//   const isPdf = PDF_EXT.test(url);
//   const isDocx = DOCX_EXT.test(url);
//   const isDoc = !isDocx && DOC_EXT.test(url);

//   return (
//     <motion.article
//       className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm"
//       initial={isMobile ? undefined : "rest"}
//       animate={isMobile ? undefined : "rest"}
//       whileHover={isMobile ? undefined : "hover"}
//     >
//       <div className="relative h-[48vh] sm:h-[50vh] md:h-[18rem] lg:h-[22rem] xl:h-[24rem] bg-zinc-800 overflow-hidden">
//         {isVideo ? (
//           <motion.video
//             src={url}
//             muted
//             loop
//             playsInline
//             autoPlay
//             preload="metadata"
//             controls={false}
//             disablePictureInPicture
//             className="absolute inset-0 w-full h-full object-cover"
//             variants={isMobile ? undefined : { rest: { scale: 1 }, hover: { scale: 1.06, transition: { duration: 0.6 } } }}
//           />
//         ) : isPdf ? (
//           <DocumentPreview url={url} kind="pdf" isMobile={isMobile} />
//         ) : isDocx ? (
//           <DocumentPreview url={url} kind="docx" isMobile={isMobile} />
//         ) : isDoc ? (
//           <DocumentPreview url={url} kind="doc" isMobile={isMobile} />
//         ) : (
//           <motion.div
//             className="absolute inset-0 grid place-items-center text-zinc-300 text-xs"
//             variants={isMobile ? undefined : { rest: { scale: 1 }, hover: { scale: 1.04, transition: { duration: 0.6 } } }}
//           >
//             Sin vista previa
//           </motion.div>
//         )}

//         {/* Overlay de legibilidad */}
//         {isMobile ? (
//           <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/55" />
//         ) : (
//           <motion.div
//             className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50"
//             variants={{ rest: { opacity: 0.65 }, hover: { opacity: 0.9, transition: { duration: 0.25 } } }}
//           />
//         )}

//         {/* CTA */}
//         <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
//           <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
//             <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-40 overflow-auto">
//               {name}
//             </p>
//             <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
//               <Link href={`/videos/${item.id}`} aria-label={`Ver más sobre ${name}`}>
//                 <motion.button
//                   whileHover={{ scale: 1.07 }}
//                   whileTap={{ scale: 0.96 }}
//                   className="text-sm px-4 py-2 rounded border text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 transition"
//                 >
//                   Ver más
//                 </motion.button>
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </motion.article>
//   );
// }

// /* ====================== Carrusel reutilizado ====================== */
// function CategoryCarousel({ items }: { items: UploadItem[] }) {
//   const [perPage, setPerPage] = useState(5);
//   const [page, setPage] = useState(0);
//   const isMobile = useIsMobile();

//   useEffect(() => {
//     const update = () => setPerPage(getPerPage(window.innerWidth));
//     update();
//     window.addEventListener("resize", update);
//     return () => window.removeEventListener("resize", update);
//   }, []);

//   const pages = useMemo(() => chunk(items, perPage), [items, perPage]);
//   const total = pages.length;

//   useEffect(() => {
//     if (page > total - 1) setPage(0);
//   }, [total, page]);

//   const prev = () => total && setPage((p) => (p - 1 + total) % total);
//   const next = () => total && setPage((p) => (p + 1) % total);

//   const touchStartX = useRef<number | null>(null);
//   const onTouchStart = (e: React.TouchEvent) => (touchStartX.current = e.touches[0].clientX);
//   const onTouchEnd = (e: React.TouchEvent) => {
//     if (touchStartX.current === null) return;
//     const dx = e.changedTouches[0].clientX - touchStartX.current;
//     if (Math.abs(dx) > 48) (dx < 0 ? next() : prev());
//     touchStartX.current = null;
//   };

//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "ArrowLeft") prev();
//       if (e.key === "ArrowRight") next();
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [total]);

//   return (
//     <section
//       className="relative overflow-hidden rounded-2xl"
//       role="region"
//       aria-roledescription="carousel"
//       aria-label="Archivos"
//       onTouchStart={onTouchStart}
//       onTouchEnd={onTouchEnd}
//     >
//       <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${page * 100}%)` }}>
//         {pages.map((slice, idx) => (
//           <div key={idx} className="w-full shrink-0">
//             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
//               {slice.map((u) => (
//                 <CardItem key={u.id} item={u} />
//               ))}
//             </div>
//           </div>
//         ))}
//       </div>

//       {/* Controles & Dots */}
//       {total > 1 && (
//         <>
//           <button
//             onClick={() => setPage((p) => (p - 1 + total) % total)}
//             aria-label="Anterior"
//             className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
//           >
//             ‹
//           </button>
//           <button
//             onClick={() => setPage((p) => (p + 1) % total)}
//             aria-label="Siguiente"
//             className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
//           >
//             ›
//           </button>
//           <div className="mt-4 flex items-center justify-center gap-2">
//             {Array.from({ length: total }).map((_, i) => (
//               <button
//                 key={i}
//                 onClick={() => setPage(i)}
//                 aria-label={`Ir al grupo ${i + 1}`}
//                 className={`h-2.5 rounded-full transition-all ${i === page ? "w-6 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
//               />
//             ))}
//           </div>
//         </>
//       )}
//     </section>
//   );
// }

