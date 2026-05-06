"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  url: string;
  file_name?: string;
  tipo?: string;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

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

function proxiedUrl(u?: string | null) {
  if (!u) return "";
  const s = String(u);

  if (s.startsWith("/api/proxy?url=")) return s;

  // gs:// sí necesita proxy
  if (s.startsWith("gs://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

  // signed URLs / http(s) públicas => directo
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }

  return s;
}

const CATS = [
  {
    slug: "publicidad",
    label: "Publicidad",
    cover: "/Publicidad.avif",
    desc: "Piezas y campañas publicitarias.",
  },
  {
    slug: "entretenimiento",
    label: "Entretenimiento",
    cover: "/babybandito2.jpg",
    desc: "Contenido y piezas de entretenimiento.",
  },
  {
    slug: "vxf",
    label: "VXF",
    cover: "/Garage.jpg",
    desc: "Contenido y entregables VXF.",
  },
] as const;

export default function LandingCategories() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const INTERVAL = 6000;
  const selectionMode = false;

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
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, []);

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
      {items.length > 0 && (
        <div className="relative w-full overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {items.map((item, i) => {
              const src = proxiedUrl(item.url);
              const isVideo = item.tipo === "video" || VIDEO_EXT.test(item.url || "");
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
                        src={src}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        controls={false}
                        disablePictureInPicture
                        onLoadedData={(e) => {
                          if (i === index) {
                            e.currentTarget.play().catch(() => {});
                          }
                        }}
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

      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1200px] px-4 py-8">
          <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">
            Categorías principales
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr gap-4 sm:gap-6">
            {CATS.map((c, i) => (
              <Link key={c.slug} href={`/organizar/${c.slug}`} className="group block h-full min-w-0">
                <article className="h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow">
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
                    <h3 className="text-sm sm:text-base font-semibold truncate">{c.label}</h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-snug">{c.desc}</p>
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

// type Item = {
//   id: string;
//   url: string;
//   file_name?: string;
//   tipo?: string;
// };

// const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

// function stripExt(s?: string | null) {
//   if (!s) return "Archivo";

//   let safe = s;
//   try {
//     safe = decodeURIComponent(s);
//   } catch {
//     safe = s;
//   }

//   const base = safe.split("/").pop() || safe;
//   return base.replace(/\.[^.\/\\]+$/g, "");
// }

// function proxiedUrl(u?: string | null) {
//   if (!u) return "";
//   const s = String(u);

//   if (s.startsWith("/api/proxy?url=")) return s;

//   if (s.startsWith("gs://")) {
//     return `/api/proxy?url=${encodeURIComponent(s)}`;
//   }

//   if (s.startsWith("http://") || s.startsWith("https://")) {
//     return `/api/proxy?url=${encodeURIComponent(s)}`;
//   }

//   return s;
// }

// const CATS = [
//   {
//     slug: "publicidad",
//     label: "Publicidad",
//     cover: "/Publicidad.avif",
//     desc: "Piezas y campañas publicitarias.",
//   },
//   {
//     slug: "entretenimiento",
//     label: "Entretenimiento",
//     cover: "/babybandito2.jpg",
//     desc: "Contenido y piezas de entretenimiento.",
//   },
//   {
//     slug: "vxf",
//     label: "VXF",
//     cover: "/Garage.jpg",
//     desc: "Contenido y entregables VXF.",
//   },
// ] as const;

// export default function LandingCategories() {
//   const [items, setItems] = useState<Item[]>([]);
//   const [index, setIndex] = useState(0);
//   const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
//   const INTERVAL = 6000;
//   const selectionMode = false;

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
//               const src = proxiedUrl(item.url);

//               return (
//                 <div key={item.id} className="relative w-full shrink-0 basis-full">
//                   <div className="relative h-[40vh] sm:h-[50vh] md:h-[60vh] bg-zinc-900">
//                     {isVideo ? (
//                       <video
//                         ref={(el) => {
//                           videoRefs.current[i] = el;
//                         }}
//                         src={src}
//                         muted
//                         loop
//                         playsInline
//                         autoPlay
//                         preload="auto"
//                         controls={false}
//                         disablePictureInPicture
//                         onLoadedData={(e) => {
//                           if (i === index) {
//                             e.currentTarget.play().catch(() => {});
//                           }
//                         }}
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

//       <div className="w-full flex justify-center">
//         <div className="w-full max-w-[1200px] px-4 py-8">
//           <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">
//             Categorías principales
//           </h1>

//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr gap-4 sm:gap-6">
//             {CATS.map((c, i) => (
//               <Link key={c.slug} href={`/organizar/${c.slug}`} className="group block h-full min-w-0">
//                 <article className="h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow">
//                   <div className="relative w-full aspect-[4/3] overflow-hidden bg-black">
//                     <Image
//                       src={c.cover}
//                       alt={c.label}
//                       fill
//                       className="object-cover group-hover:object-contain transition-all duration-300"
//                       sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
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

