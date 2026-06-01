"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { VideoInfo } from "./types";
import { getExt, isVideoExt } from "./helpers";

function stripExt(s?: string | null) {
  if (!s) return "Archivo";

  let safe = s;
  try {
    safe = decodeURIComponent(s);
  } catch {}

  const base = safe.split("/").pop() || safe;
  return base.replace(/\.[^.\/\\]+$/g, "");
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(hover: none), (pointer: coarse)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();

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
          priority={false}
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

export default function FileCard({
  item,
  selectionMode,
  selected,
  onToggleSelect,
  onDeleted,
  href,
}: {
  item: VideoInfo;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  href: string;
}) {
  const ext = (getExt(item.url || item.name) || "").toLowerCase();

const isVid =
  isVideoExt(ext) ||
  item.mimeType?.startsWith("video/") ||
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(item.url || "");
  const isPdf = ext === "pdf" || /\.pdf$/i.test(item.url || "");
  const isDocx = ext === "docx" || /\.docx$/i.test(item.url || "");
  const isDoc = !isDocx && (ext === "doc" || /\.doc$/i.test(item.url || ""));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVid) return;

    let start = 0;
    let end = 6;

    const onLoaded = () => {
      const d = v.duration;

      if (Number.isFinite(d) && d > 7) {
        start = Math.max(0, Math.random() * (d - 6));
        end = Math.min(d, start + 6);

        try {
          v.currentTime = start;
        } catch {}
      }

      v.play().catch(() => {});
      setTimeout(() => v.play().catch(() => {}), 60);
    };

    const onTimeUpdate = () => {
      if (v.currentTime >= end - 0.05) {
        try {
          v.currentTime = start;
        } catch {}
      }
    };

    v.addEventListener("loadeddata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);

    if (v.readyState >= 2) onLoaded();

    return () => {
      v.removeEventListener("loadeddata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [item.url, isVid]);

  const name = stripExt(item.name);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, type: "spring", stiffness: 210, damping: 20 }}
    >
      <motion.article
        className={`relative bg-zinc-900 border rounded-2xl overflow-hidden shadow-sm ${
          selected ? "border-orange-500" : "border-zinc-800"
        }`}
        {...(!isMobile ? { initial: "rest", animate: "rest", whileHover: "hover" } : {})}
      >
        {selectionMode && (
          <label className="absolute z-30 top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded border border-zinc-700 flex items-center gap-2 pointer-events-auto">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(item.id)}
              className="h-4 w-4 accent-orange-500"
            />
            <span className="text-xs text-zinc-200">Sel.</span>
          </label>
        )}

        <div className="relative aspect-video w-full bg-zinc-800 overflow-hidden">
          {isVid ? (
            <video
              ref={videoRef}
              src={item.url}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              controls={false}
              disablePictureInPicture
              onLoadedData={(e) => {
                e.currentTarget.play().catch(() => {});
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : isPdf ? (
            <DocumentPreview url={item.url} kind="pdf" isMobile={isMobile} />
          ) : isDocx ? (
            <DocumentPreview url={item.url} kind="docx" isMobile={isMobile} />
          ) : isDoc ? (
            <DocumentPreview url={item.url} kind="doc" isMobile={isMobile} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-zinc-300 text-xs">
              Sin vista previa
            </div>
          )}

          {!isMobile ? (
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10"
              variants={{
                rest: { opacity: 0.75 },
                hover: { opacity: 0.95, transition: { duration: 0.2 } },
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />
          )}

          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pointer-events-none">
            <div className="pointer-events-auto max-w-[88%]">
              <p className="text-white text-lg md:text-xl font-bold drop-shadow line-clamp-2">
                {name}
              </p>

              <div className="mt-3">
                <Link href={selectionMode ? "#" : href} aria-disabled={selectionMode}>
                  <motion.button
                    disabled={selectionMode}
                    whileHover={!isMobile ? { scale: 1.05 } : undefined}
                    whileTap={{ scale: 0.96 }}
                    className={`text-sm px-4 py-2 rounded-lg border transition ${
                      selectionMode
                        ? "text-zinc-500 border-zinc-700"
                        : "text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 bg-black/30"
                    }`}
                  >
                    Ver más
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}