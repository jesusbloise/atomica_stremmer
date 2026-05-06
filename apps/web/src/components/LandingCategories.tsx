"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

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

  if (s.startsWith("gs://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const INTERVAL = 6000;
  const selectionMode = false;

  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        if (!res.ok) return;

        const data: Item[] = await res.json();

        if (!cancel && Array.isArray(data)) {
          const list = data.filter((v: any) => !!v?.url).slice(0, 6);
          setItems(list);
          setIndex(0);
        }
      } catch {}
    }

    load();

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
    const v = videoRef.current;
    if (!v) return;

    try {
      v.currentTime = 0;
    } catch {}

    v.play().catch(() => {});
  }, [index]);

  const current = useMemo(() => {
    return items[index] || null;
  }, [items, index]);

  const prev = () => {
    if (!items.length) return;
    setIndex((i) => (i - 1 + items.length) % items.length);
  };

  const next = () => {
    if (!items.length) return;
    setIndex((i) => (i + 1) % items.length);
  };

  const src = current ? proxiedUrl(current.url) : "";
  const isVideo = current?.tipo === "video" || VIDEO_EXT.test(current?.url || "");
  const name = stripExt(current?.file_name) || "Archivo";
  const href = current ? `/videos/${current.id}` : "#";

  return (
    <div className="w-full">
      {current && (
        <div className="relative w-full overflow-hidden bg-zinc-950">
          <div className="relative h-[40vh] sm:h-[50vh] md:h-[60vh] bg-zinc-900">
            {isVideo ? (
              <video
                key={current.id}
                ref={videoRef}
                src={src}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                controls={false}
                disablePictureInPicture
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

          {items.length > 1 && (
            <>
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
            </>
          )}
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