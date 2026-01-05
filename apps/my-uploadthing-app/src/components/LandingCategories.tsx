"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* ====================== Tipos ====================== */
type Item = {
  id: string;
  url: string;
  file_name?: string;
  tipo?: string;
};

/* ====================== Utils ====================== */
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

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


/* ====================== Grid de categorías (4) ====================== */
const CATS = [
  {
    slug: "retail",
    label: "Retail",
    cover: "/retail1.png",
    desc: "Armados, evento, precio y calendario comercial.",
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
    desc: "Piezas para comunicación interna, cultura organizacional y mensajes clave.",
  },
];

/* ====================== Página con carrusel inline ====================== */
export default function LandingCategories() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const INTERVAL = 6000;
  const selectionMode = false;

  // Fetch a /api/videos y limita a 10
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        if (!res.ok) return;
        const data: Item[] = await res.json();
        if (!cancel && Array.isArray(data)) {
          const list = data.filter((v: any) => !!v?.url).slice(0, 10);
          setItems(list);
          setIndex(0);
        }
      } catch {
        // silencio intencional
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Auto-advance
  useEffect(() => {
    if (!items.length) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
    }, INTERVAL);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, items.length]);

  // Reproduce solo el slide activo
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        try {
          v.currentTime = 0;
        } catch {}
        const tryPlay = () => v.play().catch(() => {});
        tryPlay();
        setTimeout(tryPlay, 50);
      } else {
        v.pause();
      }
    });
  }, [index, items.length]);

  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  return (
    <div className="w-full">
      {/* Carrusel */}
      {items.length > 0 && (
        <div className="relative w-full overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {items.map((item, i) => {
              const isVideo = item.tipo === "video" || VIDEO_EXT.test(item.url);
              const name = stripExt(item.file_name) || "Archivo";
              const href = `/videos/${item.id}`;
              return (
                <div key={item.id} className="relative w-full shrink-0 basis-full">
                  <div className="relative h-[40vh] sm:h-[50vh] md:h-[60vh] bg-zinc-900">
                    {isVideo ? (
                      <video
                        ref={(el) => {
                          videoRefs.current[i] = el;
                        }}
                        src={item.url}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        controls={false}
                        disablePictureInPicture
                        crossOrigin="anonymous"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-300">
                        <span className="text-sm">Sin vista previa</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/40" />

                    <div className="absolute inset-0 flex items-center justify-center px-4">
                      <div className="px-4 py-3 rounded-lg bg-black/40 border border-white/15 backdrop-blur-sm text-center">
                        <p className="text-white text-base sm:text-lg md:text-2xl font-semibold">
                          {name}
                        </p>
                        <div className="mt-3">
                          <Link href={selectionMode ? "#" : href} aria-disabled={selectionMode}>
                            <motion.button
                              disabled={selectionMode}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`text-xs px-3 py-1.5 rounded transition border ${
                                selectionMode
                                  ? "text-zinc-500 border-zinc-700"
                                  : "text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500"
                              }`}
                              aria-label={`Ver más sobre ${name}`}
                            >
                              Ver más
                            </motion.button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controles */}
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white"
          >
            ‹
          </button>
          <button
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white"
          >
            ›
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Categorías: 1 → 2 → 4 columnas, TODAS igual, “intermedio” en recorte */}
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
                  {/* 📌 Intermedio: misma altura para todas + cover por defecto + contain en hover */}
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
    </div>
  );
}

// "use client";

// import Link from "next/link";
// import Image from "next/image";
// import { motion } from "framer-motion";
// import { useEffect, useRef, useState } from "react";

// /* ====================== Tipos ====================== */
// type Item = {
//   id: string;
//   url: string;
//   file_name?: string;
//   tipo?: string;
// };

// /* ====================== Utils ====================== */
// const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

// function stripExt(s?: string | null) {
//   if (!s) return "Archivo";
//   const decoded = decodeURIComponent(s);
//   const base = (decoded.split("/").pop() || decoded).trim();
//   return base.replace(/\.[^.\/\\]+$/g, "");
// }

// /* ====================== Grid de categorías (3) ====================== */
// const CATS = [
//   {
//     slug: "periodismo-comunicacion",
//     label: "Periodismo y Comunicación",
//     cover: "/otros.png",
//     desc: "Reportajes, entrevistas y piezas informativas.",
//   },
//   {
//     slug: "publicidad-marketing",
//     label: "Publicidad y Marketing",
//     cover: "/documentales.png",
//     desc: "Campañas, spots, branded content y más.",
//   },
//   {
//     slug: "cine-comunicacion-audiovisual",
//     label: "Cine y Comunicación Audiovisual",
//     cover: "/peliculas.png",
//     desc: "Cortos, documentales y proyectos de ficción.",
//   },
// ];

// /* ====================== Página con carrusel inline ====================== */
// export default function LandingCategories() {
//   const [items, setItems] = useState<Item[]>([]);
//   const [index, setIndex] = useState(0);
//   const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
//   const INTERVAL = 6000; // 6s
//   const selectionMode = false;

//   // Fetch a /api/videos y limita a 10
//   useEffect(() => {
//     let cancel = false;
//     (async () => {
//       try {
//         const res = await fetch("/api/videos", { cache: "no-store" });
//         if (!res.ok) return;
//         const data: Item[] = await res.json();
//         if (!cancel && Array.isArray(data)) {
//           const list = data.filter((v: any) => !!v?.url).slice(0, 10);
//           setItems(list);
//           setIndex(0);
//         }
//       } catch {}
//     })();
//     return () => {
//       cancel = true;
//     };
//   }, []);

//   // Auto-advance cada 6s
//   useEffect(() => {
//     if (!items.length) return;
//     if (timerRef.current) clearTimeout(timerRef.current);
//     timerRef.current = setTimeout(() => {
//       setIndex((i) => (i + 1) % items.length);
//     }, INTERVAL);
//     return () => {
//       if (timerRef.current) clearTimeout(timerRef.current);
//     };
//   }, [index, items.length]);

//   // Reproduce solo el slide activo
//   useEffect(() => {
//     videoRefs.current.forEach((v, i) => {
//       if (!v) return;
//       if (i === index) {
//         try {
//           v.currentTime = 0;
//         } catch {}
//         const tryPlay = () => v.play().catch(() => {});
//         tryPlay();
//         setTimeout(tryPlay, 50);
//       } else {
//         v.pause();
//       }
//     });
//   }, [index, items.length]);

//   const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
//   const next = () => setIndex((i) => (i + 1) % items.length);

//   return (
//     <div className="w-full">
//       {/* Carrusel */}
//       {items.length > 0 && (
//         <div className="relative w-full overflow-hidden">
//           <div
//             className="flex transition-transform duration-500 ease-out"
//             style={{ transform: `translateX(-${index * 100}%)` }}
//           >
//             {items.map((item, i) => {
//               const isVideo = item.tipo === "video" || VIDEO_EXT.test(item.url);
//               const name = stripExt(item.file_name) || "Archivo";
//               const href = `/videos/${item.id}`;
//               return (
//                 <div key={item.id} className="relative w-full shrink-0 basis-full">
//                   <div className="relative h-[40vh] sm:h-[50vh] md:h-[60vh] bg-zinc-900">
//                     {isVideo ? (
//                       <video
//                         ref={(el) => {
//                           videoRefs.current[i] = el;
//                         }}
//                         src={item.url}
//                         muted
//                         loop
//                         playsInline
//                         autoPlay
//                         preload="metadata"
//                         controls={false}
//                         disablePictureInPicture
//                         crossOrigin="anonymous"
//                         className="absolute inset-0 w-full h-full object-cover"
//                       />
//                     ) : (
//                       <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-300">
//                         <span className="text-sm">Sin vista previa</span>
//                       </div>
//                     )}

//                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/40" />

//                     <div className="absolute inset-0 flex items-center justify-center px-4">
//                       <div className="px-4 py-3 rounded-lg bg-black/40 border border-white/15 backdrop-blur-sm text-center">
//                         <p className="text-white text-base sm:text-lg md:text-2xl font-semibold">
//                           {name}
//                         </p>
//                         <div className="mt-3">
//                           <Link href={selectionMode ? "#" : href} aria-disabled={selectionMode}>
//                             <motion.button
//                               disabled={selectionMode}
//                               whileHover={{ scale: 1.05 }}
//                               whileTap={{ scale: 0.95 }}
//                               className={`text-xs px-3 py-1.5 rounded transition border ${
//                                 selectionMode
//                                   ? "text-zinc-500 border-zinc-700"
//                                   : "text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500"
//                               }`}
//                               aria-label={`Ver más sobre ${name}`}
//                             >
//                               Ver más
//                             </motion.button>
//                           </Link>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           {/* Controles */}
//           <button
//             onClick={prev}
//             aria-label="Anterior"
//             className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white"
//           >
//             ‹
//           </button>
//           <button
//             onClick={next}
//             aria-label="Siguiente"
//             className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white"
//           >
//             ›
//           </button>

//           {/* Dots */}
//           <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
//             {items.map((_, i) => (
//               <button
//                 key={i}
//                 onClick={() => setIndex(i)}
//                 aria-label={`Ir al slide ${i + 1}`}
//                 className={`h-2.5 rounded-full transition-all ${
//                   i === index ? "w-6 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
//                 }`}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Categorías (1→2→3 columnas) */}
//       <div className="w-full flex justify-center">
//         <div className="w-full max-w-[1200px] px-4 py-8">
//           <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">Nuestra Facultad</h1>

//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr gap-4 sm:gap-6">
//             {CATS.map((c, i) => (
//               <Link key={c.slug} href={`/organizar/${c.slug}`} className="group block h-full min-w-0">
//                 <article className="h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow">
//                   <div className="relative aspect-square">
//                     <Image
//                       src={c.cover}
//                       alt={c.label}
//                       fill
//                       className="object-cover"
//                       sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
//                       priority={i === 0}
//                     />
//                   </div>
//                   <div className="p-4 mt-auto text-center">
//                     <h3 className="text-sm sm:text-base font-semibold truncate">{c.label}</h3>
//                     <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-snug">{c.desc}</p>
//                   </div>
//                 </article>
//               </Link>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

