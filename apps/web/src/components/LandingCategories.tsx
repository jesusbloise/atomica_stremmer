"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: string;
  url?: string | null;
  file_path?: string | null;
  r2_path?: string | null;
  file_name?: string;
  display_name?: string | null;
  titulo?: string | null;
  tipo?: string;
  thumbnail_url?: string | null;
  cf_stream_playback_url?: string | null;
  using_cloudflare_stream?: boolean;
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
  const s = String(u).trim();

  if (s.startsWith("/api/proxy?url=")) return s;
  if (s.startsWith("/api/r2/proxy?url=")) return s;

  if (s.startsWith("r2://")) {
    return `/api/r2/proxy?url=${encodeURIComponent(s)}`;
  }

  if (s.startsWith("gs://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

  return s;
}


type CategoryFromApi = {
  id: string;
  slug: string;
  label: string;
  description?: string;
  cover?: string;
  is_active: boolean;
  sort_order: number;
};

export default function LandingCategories() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
const [categories, setCategories] = useState<CategoryFromApi[]>([]);
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
          const list = data
  .filter((v: any) => !!v?.id)
  .slice(0, 6);
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
  let cancel = false;

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();

      if (!cancel && Array.isArray(data?.categories)) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error("Error cargando categorías:", err);
    }
  }

  loadCategories();

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

const streamSrc = current?.cf_stream_playback_url || current?.url || "";
const rawSrc = current?.r2_path || current?.file_path || current?.url || "";
const src = proxiedUrl(rawSrc);
const thumbnailSrc = proxiedUrl(current?.thumbnail_url);
const isCloudflareStream = streamSrc.includes("iframe.videodelivery.net");
const isVideo = current?.tipo === "video" || VIDEO_EXT.test(rawSrc || "");

  const name = stripExt(
  current?.display_name ||
  current?.titulo ||
  current?.file_name
) || "Archivo";
  const href = current ? `/videos/${current.id}` : "#";

  return (
    <div className="w-full">
      {current && (
        <div className="relative w-full overflow-hidden bg-zinc-950">
          <div className="relative h-[clamp(330px,48vh,470px)] bg-zinc-900">
            {thumbnailSrc ? (
  <img
    src={thumbnailSrc}
    alt={name}
    className="absolute inset-0 w-full h-full object-cover"
  />
) : isCloudflareStream ? (
  <iframe
    src={streamSrc}
    className="absolute inset-0 w-full h-full"
    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
    allowFullScreen
  />
) : isVideo && src ? (
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

          <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-7 sm:px-5 sm:pb-8 md:px-7 md:pb-9">
  <div className="max-w-lg">
    <p className="text-left text-base font-semibold text-white drop-shadow-md sm:text-xl md:text-2xl">
      {name}
    </p>

    <div className="mt-2 flex justify-start">
      <Link
        href={selectionMode ? "#" : href}
        aria-disabled={selectionMode}
      >
        <motion.button
          disabled={selectionMode}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`rounded-lg border px-4 py-2 text-sm font-medium backdrop-blur-sm transition ${
            selectionMode
              ? "border-zinc-700 bg-black/40 text-zinc-500"
              : "border-orange-400 bg-black/45 text-orange-400 hover:border-orange-500 hover:bg-black/65 hover:text-orange-500"
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

      <div className="w-full overflow-visible">
  <div className="mx-auto w-full max-w-[1540px] px-3 py-5 sm:px-4 sm:py-6">
    <h1 className="mb-4 text-center text-xl font-bold sm:text-2xl">
      Categorías principales
    </h1>

    <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
      {categories.map((c, i) => (
        <Link
          key={c.slug}
          href={`/organizar/${c.slug}`}
          className="group relative z-0 block w-full max-w-[245px] transition-all duration-300 ease-out md:hover:z-50 md:hover:-translate-y-7 md:hover:scale-[1.85]"
        >
          <article className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/75 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:border-orange-400/60 group-hover:shadow-2xl">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
              <Image
                src={c.cover || "/Publicidad.avif"}
                alt={c.label}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 245px"
                priority={i === 0}
              />
            </div>

            <div className="px-3 py-3 text-center">
              <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-white">
                {c.label}
              </h3>
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