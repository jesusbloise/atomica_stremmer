"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import type { VideoInfo } from "@/components/UploadVideo/types";
import SplashScreen from "@/components/SplashScreen";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

/* ====================== Utils ====================== */
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const PDF_EXT = /\.pdf(?:$|\?)/i;
const DOCX_EXT = /\.(docx)(?:$|\?)/i;

function stripExt(s?: string | null) {
  if (!s) return "Archivo";
  let safe = s;
  try {
    safe = decodeURIComponent(s);
  } catch {
    safe = s;
  }
  const base = safe.split("/").pop() || safe;
  return base.replace(/\.[^.\/\\]+$/g, "");
}

function getExt(nameOrUrl?: string | null) {
  if (!nameOrUrl) return "";
  const m = nameOrUrl.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
  return m?.[1] ?? "";
}

function isVideoByName(name?: string | null) {
  return !!name && VIDEO_EXT.test(name);
}
function isPdfByName(name?: string | null) {
  return !!name && PDF_EXT.test(name);
}
function isDocxByName(name?: string | null) {
  return !!name && DOCX_EXT.test(name);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function getPerPage(width: number) {
  if (width < 480) return 1;
  if (width < 768) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  return 5;
}

/**
 * ✅ IGUAL QUE EL GRID:
 * - Si viene absoluta (MinIO con IP vieja o nueva), la mandamos al proxy.
 * - Si ya viene proxificada, la dejamos.
 */
function proxiedUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u);

  if (s.startsWith("/api/proxy?url=")) return s;

  if (s.startsWith("http://") || s.startsWith("https://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

  // relativa => tal cual
  return s;
}

/* ====================== Hook: detectar móvil ====================== */
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

/* ====================== Carrusel responsivo ====================== */
function RowCarouselResponsive({ items }: { items: VideoInfo[] }) {
  const [perPage, setPerPage] = useState<number>(5);
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
  const onTouchStart = (e: React.TouchEvent) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) (dx < 0 ? next() : prev());
    touchStartX.current = null;
  };

  // ✅ debug: muestra si hay items pero no renderiza preview
  if (!items.length) {
    return <div className="text-zinc-400 py-10">No hay videos para mostrar.</div>;
  }

  return (
    <section className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div
        className="relative overflow-hidden rounded-2xl"
        role="region"
        aria-roledescription="carousel"
        aria-label="Carrusel de archivos"
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
                {slice.map((it) => {
                  const name = stripExt(it.name);
                  const href = `/videos/${it.id}`;

                  // ✅ CLAVE: usa siempre la URL proxificada
                  const previewUrl = proxiedUrl(it.url);

                  // ✅ detectar tipo por nombre (la url proxificada no sirve para extensión)
                  const ext = getExt(it.name);
                  const isVideo = it.tipo === "video" || isVideoByName(it.name) || ext === "mp4";
                  const isPdf = isPdfByName(it.name) || ext === "pdf";
                  const isDocx = isDocxByName(it.name) || ext === "docx";

                  // ✅ debug local por card
                  const [err, setErr] = useState<string | null>(null);

                  return (
                    <motion.article
                      key={it.id}
                      className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm"
                      initial={isMobile ? undefined : "rest"}
                      animate={isMobile ? undefined : "rest"}
                      whileHover={isMobile ? undefined : "hover"}
                    >
                      <div className="relative h-[58vh] sm:h-[64vh] md:h-[22rem] lg:h-[26rem] xl:h-[28rem] bg-zinc-800 overflow-hidden">
                        {isVideo ? (
                          <>
                            <motion.video
                              // ✅ key para forzar reload si cambia url
                              key={previewUrl}
                              src={previewUrl}
                              muted
                              loop
                              playsInline
                              autoPlay
                              preload="metadata"
                              controls={false}
                              disablePictureInPicture
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={() => setErr("VIDEO_ERROR")}
                              onLoadedData={() => setErr(null)}
                              variants={
                                isMobile
                                  ? undefined
                                  : {
                                      rest: { scale: 1 },
                                      hover: { scale: 1.06, transition: { duration: 0.6 } },
                                    }
                              }
                            />

                            {err && (
                              <div className="absolute inset-0 grid place-items-center bg-black/60 text-white text-xs p-4 text-center">
                                <div className="max-w-[90%]">
                                  <div className="font-semibold mb-2">No cargó el preview</div>
                                  <div className="opacity-80 break-all">
                                    {err} <br />
                                    <span className="opacity-70">src:</span> {previewUrl}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : isPdf ? (
                          <div className="absolute inset-0">
                            <embed
                              src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                              type="application/pdf"
                              className="w-full h-full"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-zinc-900/10" />
                          </div>
                        ) : isDocx ? (
                          <Image src="/docx1.png" alt="Documento Word" fill className="object-cover" />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center text-zinc-300 text-xs">
                            Sin vista previa
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50" />

                        <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
                          <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
                            <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-48 overflow-auto">
                              {name}
                            </p>
                            <div className="mt-4">
                              <Link href={href} aria-label={`Ver más sobre ${name}`}>
                                <motion.button
                                  whileHover={{ scale: 1.07 }}
                                  whileTap={{ scale: 0.96 }}
                                  className="text-base px-5 py-2 rounded border
                                             text-orange-400 hover:text-orange-500
                                             border-orange-400 hover:border-orange-500
                                             transition"
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
                })}
              </div>
            </div>
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
            >
              ‹
            </button>
            <button
              onClick={next}
              aria-label="Siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
            >
              ›
            </button>
          </>
        )}
      </div>

      {total > 1 && (
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
      )}
    </section>
  );
}

/* ====================== Página ====================== */
export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "ultimos";

  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("showSplash") === "true") {
      setShowSplash(true);
      localStorage.removeItem("showSplash");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const me = await r.json();
        if (me?.role === "ESTUDIANTE") router.replace("/organizar");
      } catch {}
    })();
  }, [router]);

  // ✅ fila -> VideoInfo (sin inventar normalizaciones)
  function mapRowToVideoInfo(r: any): VideoInfo | null {
    if (!r?.id) return null;

    const name =
      r.file_name ?? r.name ?? r.title ?? (r.file_key ? String(r.file_key) : "archivo");

    // ✅ fuente de verdad: file_path (viene con 192.168.229.25)
    const rawUrl: string =
      r.file_path || r.path || r.url || (r.file_key ? `/archivos/${String(r.file_key)}` : "");

    if (!rawUrl) return null;

    return {
      id: r.id,
      name,
      // ✅ el carrusel guardará la URL proxificada (igual que el grid)
      url: proxiedUrl(rawUrl),
      tipo: r.tipo ?? undefined,
      views: r.views ?? 0,
      created_at: r.uploaded_at ?? r.created_at ?? undefined,
      subtituloTexto: r.subtitulo_texto ?? r.subtitulo ?? undefined,
    } as VideoInfo;
  }

  useEffect(() => {
    let cancel = false;
    setLoading(true);

    const endpoint = tab === "mas-vistos" ? "/api/uploads/mas-vistos" : "/api/uploads/ultimos";

    (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const rows = await res.json();

        if (!cancel) {
          const mapped: VideoInfo[] = Array.isArray(rows)
            ? (rows.map(mapRowToVideoInfo).filter(Boolean) as VideoInfo[])
            : [];
          setVideos(mapped);
        }
      } catch {
        if (!cancel) setVideos([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [tab]);

  if (showSplash) return <SplashScreen />;

  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        {loading ? <p className="text-zinc-400">Cargando...</p> : <RowCarouselResponsive items={videos} />}
      </div>
    </AppShell>
  );
}



// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import AppShell from "@/components/layout/AppShell";
// import Navbar from "@/components/layout/Navbar";
// import Sidebar from "@/components/layout/Sidebar";
// import Footer from "@/components/layout/Footer";
// import type { VideoInfo } from "@/components/UploadVideo/types";
// import SplashScreen from "@/components/SplashScreen";
// import Link from "next/link";
// import Image from "next/image";
// import { motion } from "framer-motion";

// /* ====================== Utils ====================== */
// const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
// const PDF_EXT = /\.pdf(?:$|\?)/i;
// const DOCX_EXT = /\.(docx)(?:$|\?)/i;

// function stripExt(s?: string | null) {
//   if (!s) return "Archivo";

//   // Intentamos decodificar sin romper la app
//   let safe = s;
//   try {
//     safe = decodeURIComponent(s);
//   } catch {
//     // Si la URI está mal formada, usamos el string original
//     safe = s;
//   }

//   const base = safe.split("/").pop() || safe;
//   return base.replace(/\.[^.\/\\]+$/g, "");
// }

// function getExt(nameOrUrl?: string | null) {
//   if (!nameOrUrl) return "";
//   const m = nameOrUrl.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
//   return m?.[1] ?? "";
// }
// function isVideoUrl(u?: string | null) {
//   return !!u && VIDEO_EXT.test(u);
// }
// function isPdfUrl(u?: string | null) {
//   return !!u && PDF_EXT.test(u);
// }
// function isDocxUrl(u?: string | null) {
//   return !!u && DOCX_EXT.test(u);
// }

// function chunk<T>(arr: T[], size: number): T[][] {
//   const out: T[][] = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }
// function getPerPage(width: number) {
//   if (width < 480) return 1;
//   if (width < 768) return 2;
//   if (width < 1024) return 3;
//   if (width < 1280) return 4;
//   return 5;
// }

// /* ====================== Hook: detectar móvil (sin hover) ====================== */
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
//       // Safari fallback
//       mql.addListener(onChange);
//       return () => mql.removeListener(onChange);
//     }
//   }, []);
//   return isMobile;
// }

// /* ====================== Carrusel responsivo con efectos ====================== */
// function RowCarouselResponsive({ items }: { items: VideoInfo[] }) {
//   const [perPage, setPerPage] = useState<number>(5);
//   const [page, setPage] = useState(0);
//   const isMobile = useIsMobile();

//   // perPage en función del viewport (escucha resize)
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

//   // Swipe móvil
//   const touchStartX = useRef<number | null>(null);
//   const onTouchStart = (e: React.TouchEvent) => (touchStartX.current = e.touches[0].clientX);
//   const onTouchEnd = (e: React.TouchEvent) => {
//     if (touchStartX.current === null) return;
//     const dx = e.changedTouches[0].clientX - touchStartX.current;
//     if (Math.abs(dx) > 48) (dx < 0 ? next() : prev());
//     touchStartX.current = null;
//   };

//   // Teclado (accesibilidad)
//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "ArrowLeft") prev();
//       if (e.key === "ArrowRight") next();
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [total]);

//   return (
//     <section className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6">
//       <div
//         className="relative overflow-hidden rounded-2xl"
//         role="region"
//         aria-roledescription="carousel"
//         aria-label="Carrusel de archivos"
//         onTouchStart={onTouchStart}
//         onTouchEnd={onTouchEnd}
//       >
//         {/* Slides */}
//         <div
//           className="flex transition-transform duration-500 ease-out"
//           style={{ transform: `translateX(-${page * 100}%)` }}
//         >
//           {pages.map((slice, idx) => (
//             <div key={idx} className="w-full shrink-0">
//               {/* Grid: 1..5 responsivo */}
//               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
//                 {slice.map((it) => {
//                   const name = stripExt(it.name);
//                   const href = `/videos/${it.id}`;
//                   const ext = getExt(it.name || it.url);
//                   const isVideo = isVideoUrl(it.url) || it.tipo === "video";
//                   const isPdf = isPdfUrl(it.url) || ext === "pdf";
//                   const isDocx = isDocxUrl(it.url) || ext === "docx";

//                   return (
//                     <motion.article
//                       key={it.id}
//                       className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm"
//                       initial={isMobile ? undefined : "rest"}
//                       animate={isMobile ? undefined : "rest"}
//                       whileHover={isMobile ? undefined : "hover"}
//                     >
//                       {/* Altura alta en móvil para apreciar mejor la preview */}
//                       <div className="relative h-[58vh] sm:h-[64vh] md:h-[22rem] lg:h-[26rem] xl:h-[28rem] bg-zinc-800 overflow-hidden">
//                         {/* ========== PREVIEW SEGÚN TIPO ========== */}
//                         {isVideo ? (
//                           <motion.video
//                             src={it.url ?? ""}
//                             muted
//                             loop
//                             playsInline
//                             autoPlay
//                             preload="metadata"
//                             controls={false}
//                             disablePictureInPicture
//                             className="absolute inset-0 w-full h-full object-cover"
//                             variants={
//                               isMobile
//                                 ? undefined
//                                 : { rest: { scale: 1 }, hover: { scale: 1.06, transition: { duration: 0.6 } } }
//                             }
//                           />
//                         ) : isPdf ? (
//                           // PDF embebido (si el servidor lo permite). Fallback visual con fondo si CORS bloquea.
//                           <div className="absolute inset-0">
//                             <embed
//                               src={`${it.url}#toolbar=0&navpanes=0&view=FitH`}
//                               type="application/pdf"
//                               className="w-full h-full"
//                             />
//                             {/* capa por si el viewer no carga, sigue habiendo fondo */}
//                             <div className="pointer-events-none absolute inset-0 bg-zinc-900/10" />
//                           </div>
//                         ) : isDocx ? (
//                           // DOCX: miniatura estática
//                           <Image
//                             src="/docx1.png"
//                             alt="Documento Word"
//                             fill
//                             className="object-cover"
//                             priority={false}
//                           />
//                         ) : (
//                           <motion.div
//                             className="absolute inset-0 grid place-items-center text-zinc-300 text-xs"
//                             variants={
//                               isMobile
//                                 ? undefined
//                                 : { rest: { scale: 1 }, hover: { scale: 1.04, transition: { duration: 0.6 } } }
//                             }
//                           >
//                             Sin vista previa
//                           </motion.div>
//                         )}

//                         {/* Overlay legibilidad */}
//                         {isMobile ? (
//                           <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/55" />
//                         ) : (
//                           <motion.div
//                             className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50"
//                             variants={{ rest: { opacity: 0.65 }, hover: { opacity: 0.9, transition: { duration: 0.25 } } }}
//                           />
//                         )}

//                         {/* Centro: nombre + botón (móvil: siempre visible; desktop: aparece al hover) */}
//                         {isMobile ? (
//                           <div className="absolute inset-0 flex items-center justify-center px-3">
//                             <div className="px-5 py-4 rounded-xl bg-black/50 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[92vw]">
//                               <p className="text-white text-xl font-bold break-words whitespace-normal max-h-40 overflow-auto">
//                                 {name}
//                               </p>
//                               <div className="mt-4">
//                                 <Link href={href} aria-label={`Ver más sobre ${name}`}>
//                                   <button
//                                     className="text-sm px-4 py-2 rounded border
//                                                text-orange-400 hover:text-orange-500
//                                                border-orange-400 hover:border-orange-500
//                                                transition"
//                                   >
//                                     Ver más
//                                   </button>
//                                 </Link>
//                               </div>
//                             </div>
//                           </div>
//                         ) : (
//                           <motion.div
//                             className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none"
//                             variants={{
//                               rest: { opacity: 0, y: 18, scale: 0.98, filter: "blur(6px)" },
//                               hover: {
//                                 opacity: 1,
//                                 y: 0,
//                                 scale: 1,
//                                 filter: "blur(0px)",
//                                 transition: { type: "spring", stiffness: 260, damping: 18 },
//                               },
//                             }}
//                           >
//                             <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
//                               <p className="text-white text-2xl md:text-3xl font-bold drop-shadow break-words whitespace-normal max-h-48 overflow-auto">
//                                 {name}
//                               </p>
//                               <div className="mt-4">
//                                 <Link href={href} aria-label={`Ver más sobre ${name}`}>
//                                   <motion.button
//                                     whileHover={{ scale: 1.07 }}
//                                     whileTap={{ scale: 0.96 }}
//                                     className="text-base px-5 py-2 rounded border
//                                                text-orange-400 hover:text-orange-500
//                                                border-orange-400 hover:border-orange-500
//                                                transition"
//                                   >
//                                     Ver más
//                                   </motion.button>
//                                 </Link>
//                               </div>
//                             </div>
//                           </motion.div>
//                         )}
//                       </div>
//                     </motion.article>
//                   );
//                 })}
//               </div>
//             </div>
//           ))}
//         </div>

//         {/* Controles */}
//         {total > 1 && (
//           <>
//             <button
//               onClick={prev}
//               aria-label="Anterior"
//               className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
//             >
//               ‹
//             </button>
//             <button
//               onClick={next}
//               aria-label="Siguiente"
//               className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
//             >
//               ›
//             </button>
//           </>
//         )}

//         {/* Dots */}
//         {total > 1 && (
//           <div className="mt-4 flex items-center justify-center gap-2">
//             {Array.from({ length: total }).map((_, i) => (
//               <button
//                 key={i}
//                 onClick={() => setPage(i)}
//                 aria-label={`Ir al grupo ${i + 1}`}
//                 className={`h-2.5 rounded-full transition-all ${
//                   i === page ? "w-6 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
//                 }`}
//               />
//             ))}
//           </div>
//         )}
//       </div>
//     </section>
//   );
// }

// /* ====================== Página ====================== */
// export default function Page() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const tab = searchParams.get("tab") || "ultimos";

//   const [videos, setVideos] = useState<VideoInfo[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [showSplash, setShowSplash] = useState(false);

//   useEffect(() => {
//     if (typeof window !== "undefined" && localStorage.getItem("showSplash") === "true") {
//       setShowSplash(true);
//       localStorage.removeItem("showSplash");
//     }
//   }, []);

//   // Redirección si es estudiante
//   useEffect(() => {
//     (async () => {
//       try {
//         const r = await fetch("/api/me", { cache: "no-store" });
//         const me = await r.json();
//         if (me?.role === "ESTUDIANTE") router.replace("/organizar");
//       } catch {}
//     })();
//   }, [router]);

//   // helper: fila -> VideoInfo
//   function mapRowToVideoInfo(r: any): VideoInfo {
//     const name = r.file_name ?? r.name ?? r.title ?? (r.file_key ? String(r.file_key) : "archivo");
//     const url = r.url ?? r.file_path ?? (r.file_key ? `/api/files/${r.file_key}` : "");
//     return {
//       id: r.id,
//       name,
//       url,
//       subtituloTexto: r.subtitulo_texto ?? r.subtitulo ?? undefined,
//       tipo: r.tipo ?? undefined,
//       views: r.views ?? 0,
//     } as VideoInfo;
//   }

//   // Cargar según tab
//   useEffect(() => {
//     let cancel = false;
//     setLoading(true);
//     const endpoint = tab === "mas-vistos" ? "/api/uploads/mas-vistos" : "/api/uploads/ultimos";
//     (async () => {
//       try {
//         const res = await fetch(endpoint, { cache: "no-store" });
//         const rows = await res.json();
//         if (!cancel) {
//           const mapped: VideoInfo[] = Array.isArray(rows) ? rows.map(mapRowToVideoInfo) : [];
//           setVideos(mapped);
//         }
//       } catch {
//         if (!cancel) setVideos([]);
//       } finally {
//         if (!cancel) setLoading(false);
//       }
//     })();
//     return () => {
//       cancel = true;
//     };
//   }, [tab]);

//   if (showSplash) return <SplashScreen />;

//   return (
//     <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
//       <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-4">
//         {loading ? <p className="text-zinc-400">Cargando...</p> : <RowCarouselResponsive items={videos} />}
//       </div>
    
//     </AppShell>
//   );
// }

