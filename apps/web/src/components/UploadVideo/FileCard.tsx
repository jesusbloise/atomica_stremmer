"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { VideoInfo } from "./types";
import { getExt, isVideoExt } from "./helpers";

/* ====================== Utils ====================== */
function stripExt(s?: string | null) {
  if (!s) return "Archivo";

  let safe = s;
  try {
    // Puede fallar si hay un % raro en el nombre
    safe = decodeURIComponent(s);
  } catch {
    // Si la URI está mal formada, usamos el string tal cual
    safe = s;
  }

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

/* ====================== Previews de documentos ====================== */
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

/* ====================== Componente ====================== */
export default function FileCard({
  item,
  selectionMode,
  selected,
  onToggleSelect,
  onDeleted, // no se usa, lo dejamos por compatibilidad
  href,
}: {
  item: VideoInfo;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  href: string;
}) {
  const ext = (getExt(item.name || item.url) || "").toLowerCase();
  const isVid = isVideoExt(ext);
  const isPdf = ext === "pdf" || /\.pdf$/i.test(item.url || "");
  const isDocx = ext === "docx" || /\.docx$/i.test(item.url || "");
  const isDoc = !isDocx && (ext === "doc" || /\.doc$/i.test(item.url || ""));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMobile = useIsMobile();

  // ▶️ Preview automático de 6s en bucle (sin controles)
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
        try { v.currentTime = start; } catch {}
      }
      v.play().catch(() => {});
      setTimeout(() => v.play().catch(() => {}), 60);
    };

    const onTimeUpdate = () => {
      if (v.currentTime >= end - 0.05) {
        try { v.currentTime = start; } catch {}
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);
    if (v.readyState >= 1) onLoaded();

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [item.url, isVid]);

  const name = stripExt(item.name);

  return (
    /* Wrapper con animación de entrada (solo aquí) */
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, type: "spring", stiffness: 210, damping: 20 }}
    >
      {/* Card real: usa variants rest/hover SIN duplicar initial/animate */}
      <motion.article
        className={`relative bg-zinc-900 border rounded-2xl overflow-hidden shadow-sm flex flex-col ${
          selected ? "border-orange-500" : "border-zinc-800"
        }`}
        {...(!isMobile ? { initial: "rest", animate: "rest", whileHover: "hover" } : {})}
      >
        {/* Checkbox selección (solo cuando está activo) */}
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

        {/* Área visual (mismo tamaño que el carrusel) */}
        <div className="relative h-[58vh] sm:h-[64vh] md:h-[22rem] lg:h-[26rem] xl:h-[28rem] bg-zinc-800">
          {isVid ? (
            <video
              ref={videoRef}
              src={item.url}
              muted
              playsInline
              autoPlay
              preload="metadata"
              controls={false}
              disablePictureInPicture
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

          {/* Overlay para contraste */}
          {!isMobile ? (
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50"
              variants={{ rest: { opacity: 0.65 }, hover: { opacity: 0.9, transition: { duration: 0.2 } } }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/55" />
          )}

          {/* Centro: nombre + botón (desktop: aparece al hover; móvil: siempre visible) */}
          {isMobile ? (
            <div className="absolute inset-0 flex items-center justify-center px-3">
              <div className="px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
                <p className="text-white text-lg sm:text-xl md:text-2xl font-bold break-words whitespace-normal max-h-48 overflow-auto">
                  {name}
                </p>
                <div className="mt-4">
                  <Link href={selectionMode ? "#" : href} aria-disabled={selectionMode}>
                    <button
                      disabled={selectionMode}
                      className={`text-sm px-4 py-2 rounded border transition ${
                        selectionMode
                          ? "text-zinc-500 border-zinc-700"
                          : "text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500"
                      }`}
                    >
                      Ver más
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none"
              variants={{
                rest:  { opacity: 0, y: 18, scale: 0.98, filter: "blur(6px)" },
                hover: { opacity: 1, y: 0,  scale: 1,    filter: "blur(0px)", transition: { type: "spring", stiffness: 260, damping: 18 } },
              }}
            >
              <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
                <p className="text-white text-lg sm:text-xl md:text-2xl font-bold break-words whitespace-normal max-h-48 overflow-auto">
                  {name}
                </p>
                <div className="mt-4">
                  <Link href={selectionMode ? "#" : href} aria-disabled={selectionMode}>
                    <motion.button
                      disabled={selectionMode}
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.96 }}
                      className={`text-sm px-4 py-2 rounded border transition ${
                        selectionMode
                          ? "text-zinc-500 border-zinc-700"
                          : "text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500"
                      }`}
                    >
                      Ver más
                    </motion.button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}


