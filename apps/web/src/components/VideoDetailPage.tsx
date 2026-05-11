"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import DocumentViewer from "@/components/DocumentViewer";
import { useSubtitlesPolling } from "@/hooks/useSubtitlesPolling";
import Link from "next/link";
import Image from "next/image";
import FichaTecnica from "@/components/FichaTecnica";

const TablaSubtitulos = dynamic(() => import("@/components/TablaSubtitulos"), {
  ssr: false,
});

const TablaDocumento = dynamic(() => import("@/components/TablaDocumento"), {
  ssr: false,
});

async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${url}`);
  }

  const ct = res.headers.get("content-type") || "";

  if (!ct.includes("application/json")) {
    const txt = await res.text();
    throw new Error(`Respuesta no JSON en ${url}: ${txt.slice(0, 200)}...`);
  }

  return res.json();
}

type Subtitulo = {
  time_start: number;
  time_end: number;
  text: string;
  [k: string]: any;
};

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

function normalizeSubtitlesResponse(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.subtitulos)) return data.subtitulos;
  return [];
}

function parseHMS(str: string): number | null {
  const s = str.trim();

  let m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (m) {
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    const ms = m[4] ? parseInt(m[4].padEnd(3, "0"), 10) : 0;
    return hh * 3600 + mm * 60 + ss + ms / 1000;
  }

  m = s.match(/^(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const ss = parseInt(m[2], 10);
    const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
    return mm * 60 + ss + ms / 1000;
  }

  return null;
}

function toSecFromUnknown(v: unknown): number | null {
  if (v == null) return null;

  if (typeof v === "number") {
    return v > 10_000 ? v / 1000 : v;
  }

  if (typeof v === "string") {
    const h = parseHMS(v);
    if (h != null) return h;

    const n = Number(v);
    if (!Number.isNaN(n)) {
      return n > 10_000 ? n / 1000 : n;
    }
  }

  return null;
}

function resolvePlayableSrc(url?: string | null) {
  if (!url) return null;

  const s = String(url).trim();
  if (!s) return null;

  if (s.startsWith("/api/proxy?url=")) return s;

  if (s.startsWith("gs://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

  if (s.startsWith("https://storage.googleapis.com/")) return s;
  if (s.startsWith("https://")) return s;

  if (s.startsWith("http://")) {
    return `/api/proxy?url=${encodeURIComponent(s)}`;
  }

  return s;
}

export default function VideoDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"video" | "documento" | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFileName, setDocumentFileName] = useState("");
  const [documentoTexto, setDocumentoTexto] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [views, setViews] = useState(0);

  const [videoLoading, setVideoLoading] = useState(true);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekingLockRef = useRef(false);
  const lastJumpRef = useRef<number | null>(null);
  const retriedRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const processStartedRef = useRef(false);

  const viewerApiRef = useRef<{
    step?: (dir: 1 | -1) => number;
    findAll?: (q: string) => number;
    goToMatch?: (i: number) => void;
  }>({});

  const {
    subtitulos,
    setSubtitulos,
    polling,
    start: startPolling,
    stop: stopPolling,
    getStartSecFor,
  } = useSubtitlesPolling(id);

  const resolvedVideoUrl = useMemo(() => {
    return resolvePlayableSrc(videoUrl);
  }, [videoUrl]);

  const videoSrcWithReload = useMemo(() => {
    if (!resolvedVideoUrl) return null;
    if (resolvedVideoUrl.startsWith("blob:")) return resolvedVideoUrl;

    const sep = resolvedVideoUrl.includes("?") ? "&" : "?";
    return reloadNonce > 0 ? `${resolvedVideoUrl}${sep}r=${reloadNonce}` : resolvedVideoUrl;
  }, [resolvedVideoUrl, reloadNonce]);

  const tableData: Subtitulo[] = useMemo(() => {
    return (subtitulos || []).map((r: any) => {
      const start =
        toSecFromUnknown(
          r.time_start ?? r.start ?? r.start_s ?? r.start_sec ?? r.start_ms ?? r.__startSec
        ) ?? 0;

      const end =
        toSecFromUnknown(
          r.time_end ??
            r.end ??
            r.end_s ??
            r.end_ms ??
            (typeof r.__startSec === "number" ? r.__startSec + 2 : undefined)
        ) ?? start + 2;

      const text = r.text ?? r.content ?? r.line ?? "";

      return { time_start: start, time_end: end, text, ...r } as Subtitulo;
    });
  }, [subtitulos]);
  useEffect(() => {
  const q = searchParams.get("q");

  if (q && q.trim()) {
    setSearchTerm(q.trim());
    setCurrentMatchIndex(0);
  }
}, [searchParams]);

  useEffect(() => {
    if (!id) return;
    if (loadedIdRef.current === id) return;

    loadedIdRef.current = id;
    processStartedRef.current = false;

    let cancel = false;

    async function loadDetail() {
      try {
        const { upload } = await fetchJSON<{ upload: any }>(`/api/uploads/${id}`);
        if (cancel) return;

        const t = (upload?.tipo as "video" | "documento") || null;
        const fname = upload?.file_name || upload?.name || "";

        setTipo(t);
        setDocumentFileName(fname);

        if (upload?.views !== undefined) {
          setViews(upload.views);
        }

        if (t === "video") {
          const url = upload?.url as string | undefined;
          if (url) setVideoUrl(url);

          try {
            const rawSubs = await fetchJSON<any>(`/api/subtitulos/${id}`);
            const subs = normalizeSubtitlesResponse(rawSubs);

            if (cancel) return;

            if (Array.isArray(subs) && subs.length > 0) {
              setSubtitulos(subs);
              stopPolling();
            } else {
              if (!processStartedRef.current) {
                processStartedRef.current = true;

                fetch(`/api/procesar-subtitulos/${id}`, {
                  method: "POST",
                  cache: "no-store",
                }).catch(() => {});
              }

              startPolling();
            }
          } catch {
            if (cancel) return;

            if (!processStartedRef.current) {
              processStartedRef.current = true;

              fetch(`/api/procesar-subtitulos/${id}`, {
                method: "POST",
                cache: "no-store",
              }).catch(() => {});
            }

            startPolling();
          }
        }

        if (t === "documento") {
          const url = upload?.url as string | undefined;
          if (url) setDocumentUrl(url);

          try {
            const doc = await fetchJSON<{ documento?: { texto?: string } }>(
              `/api/documento/${id}`
            );

            if (!cancel) {
              setDocumentoTexto(doc?.documento?.texto || "");
            }
          } catch {
            if (!cancel) setDocumentoTexto("");
          }
        }
      } catch (e) {
        console.error("Carga de detalle falló:", e);
      }
    }

    void loadDetail();

    return () => {
      cancel = true;
      stopPolling();
    };
  }, [id, setSubtitulos, startPolling, stopPolling]);

  useEffect(() => {
    if (!videoSrcWithReload || tipo !== "video") return;

    setVideoLoading(true);
    setVideoBuffering(false);
    setVideoError(null);
    retriedRef.current = false;
  }, [videoSrcWithReload, tipo]);

  const jumpTo = useCallback((tsSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;

    const target = Math.max(0, tsSeconds - 0.3);

    if (lastJumpRef.current !== null && Math.abs(lastJumpRef.current - target) < 0.05) {
      return;
    }

    lastJumpRef.current = target;

    if (seekingLockRef.current) return;
    seekingLockRef.current = true;

    try {
      v.pause();
    } catch {}

    const onSeeked = () => {
      v.removeEventListener("seeked", onSeeked);
      seekingLockRef.current = false;

      try {
        if (Math.abs(v.currentTime - target) < 0.01) {
          v.currentTime = Math.min(v.duration || target + 0.02, target + 0.02);
        }
      } catch {}

      v.play().catch(() => {});
    };

    v.addEventListener("seeked", onSeeked, { once: true });

    try {
      v.currentTime = target;
    } catch {
      v.removeEventListener("seeked", onSeeked);
      seekingLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (tipo !== "video") return;
    if (!videoRef.current) return;
    if (!matchIndices.length) return;

    const rowIndex = matchIndices[currentMatchIndex] ?? matchIndices[0];
    let sec: number | null = getStartSecFor ? getStartSecFor(rowIndex) : null;

    if (sec == null || Number.isNaN(sec)) {
      const row = tableData[rowIndex];

      if (row) {
        sec =
          toSecFromUnknown((row as any).__startSec) ??
          toSecFromUnknown(row.time_start) ??
          toSecFromUnknown((row as any).start) ??
          toSecFromUnknown((row as any).start_s) ??
          toSecFromUnknown((row as any).start_sec) ??
          toSecFromUnknown((row as any).start_ms);
      }
    }

    if (sec == null || Number.isNaN(sec)) return;

    jumpTo(sec);
  }, [tipo, matchIndices, currentMatchIndex, getStartSecFor, tableData, jumpTo]);

  const handlePlay = useCallback(() => {
    if (!id) return;

    fetch(`/api/views/${id}`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.views !== undefined) setViews(data.views);
      })
      .catch(() => {});
  }, [id]);

  const retryVideo = useCallback(() => {
    setVideoError(null);
    setVideoLoading(true);
    setVideoBuffering(false);
    setReloadNonce((n) => n + 1);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white py-4 sm:py-6 px-0">
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {tipo === "video" && videoUrl && (
            <div className="mb-4">
              <div
                className="text-xs sm:text-sm text-white font-semibold mb-2 text-center truncate"
                title={documentFileName}
              >
                {documentFileName || "Video sin nombre"}
              </div>

              <div className="relative flex justify-center rounded-md overflow-hidden border border-zinc-700 bg-zinc-950">
                {(videoLoading || videoBuffering) && !videoError && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-black/45 backdrop-blur-[1px] pointer-events-none">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 rounded-full border-2 border-zinc-500 border-t-orange-400 animate-spin" />
                      <p className="text-xs text-zinc-300">
                        {videoBuffering ? "Cargando reproducción..." : "Preparando video..."}
                      </p>
                    </div>
                  </div>
                )}

                {videoError && (
                  <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 px-4">
                    <div className="max-w-md text-center">
                      <p className="text-sm text-zinc-200 mb-3">{videoError}</p>
                      <button
                        type="button"
                        onClick={retryVideo}
                        className="px-4 py-2 rounded-lg border border-orange-400 text-orange-300 hover:bg-orange-500/10 text-sm"
                      >
                        Reintentar reproducción
                      </button>
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  src={videoSrcWithReload ?? undefined}
                  controls
                  playsInline
                  controlsList="nodownload"
                  className="rounded-md shadow max-w-full max-h-[520px] w-full h-auto bg-black"
                  preload="metadata"
                  onLoadStart={() => {
                    setVideoLoading(true);
                    setVideoError(null);
                  }}
                  onLoadedMetadata={() => {
                    setVideoLoading(false);
                  }}
                  onCanPlay={() => {
                    setVideoLoading(false);
                    setVideoBuffering(false);
                  }}
                  onCanPlayThrough={() => {
                    setVideoLoading(false);
                    setVideoBuffering(false);
                  }}
                  onWaiting={() => {
                    setVideoBuffering(true);
                  }}
                  onPlaying={() => {
                    setVideoLoading(false);
                    setVideoBuffering(false);
                  }}
                  onStalled={() => {
                    setVideoBuffering(true);
                  }}
                  onError={() => {
                    if (!retriedRef.current) {
                      retriedRef.current = true;
                      setReloadNonce((n) => n + 1);
                      return;
                    }

                    setVideoLoading(false);
                    setVideoBuffering(false);
                    setVideoError(
                      "No se pudo cargar este video. Puede estar procesándose, tener un formato no compatible o estar demorando desde el servidor."
                    );
                  }}
                  onPlay={handlePlay}
                />
              </div>

              <div className="text-xs sm:text-sm text-zinc-400 mt-2 text-center">
                {views} visualización{views === 1 ? "" : "es"}
              </div>
            </div>
          )}

          {tipo === "documento" && documentUrl && (
            <div className="mb-4">
              <div
                className="text-xs sm:text-sm text-white font-semibold mb-2 text-center truncate"
                title={documentFileName}
              >
                {documentFileName || "Documento sin nombre"}
              </div>

              <DocumentViewer
                url={documentUrl}
                fileName={documentFileName || documentUrl}
                searchTerm={searchTerm}
                registerNavApi={(api) => {
                  viewerApiRef.current = { ...viewerApiRef.current, ...api };
                }}
              />
            </div>
          )}

          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <input
              type="text"
              placeholder=" Buscar palabra o frase..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;

                e.preventDefault();

                const dir = e.shiftKey ? -1 : 1;

                if (tipo === "documento" && viewerApiRef.current?.step) {
                  const nextFromViewer = viewerApiRef.current.step(dir);

                  if (Number.isFinite(nextFromViewer) && matchIndices.length) {
                    const synced =
                      ((Number(nextFromViewer) % matchIndices.length) + matchIndices.length) %
                      matchIndices.length;

                    setCurrentMatchIndex(synced);
                  }

                  return;
                }

                if (!matchIndices.length) return;

                const next =
                  (currentMatchIndex + dir + matchIndices.length) % matchIndices.length;

                setCurrentMatchIndex(next);
              }}
              className="w-full sm:max-w-md px-3 py-2 rounded bg-zinc-800 text-white border border-zinc-600 text-sm"
            />

            <div className="text-xs text-zinc-400">
              {matchIndices.length ? `${currentMatchIndex + 1}/${matchIndices.length}` : "0/0"}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-1 text-yellow-400 text-base sm:text-lg">★ ★ ★ ★ ☆</div>
              <button className="text-red-500 hover:text-red-400 text-lg sm:text-xl">♥</button>
            </div>
          </div>

          {polling && subtitulos.length === 0 && tipo === "video" && (
            <p className="text-sm text-gray-400 text-center mb-6">Procesando subtítulos...</p>
          )}

          {tipo === "video" && (
            <TablaSubtitulos
              data={tableData}
              searchTerm={searchTerm}
              matchIndices={matchIndices}
              currentMatchIndex={currentMatchIndex}
              setMatchIndices={setMatchIndices}
              setCurrentMatchIndex={setCurrentMatchIndex}
            />
          )}

          {tipo === "documento" && (
            <TablaDocumento
              texto={documentoTexto}
              searchTerm={searchTerm}
              url={documentUrl}
              matchIndices={matchIndices}
              currentMatchIndex={currentMatchIndex}
              setMatchIndices={setMatchIndices}
              setCurrentMatchIndex={setCurrentMatchIndex}
            />
          )}

          <div className="mt-8 flex justify-center">
            <button
  onClick={() => router.back()}
  className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-lg text-sm border border-zinc-600 shadow"
>
  ← Volver atrás
</button>
          </div>

          <div className="mt-12">
  <h2 className="text-center text-2xl md:text-3xl font-bold mb-6">
    Explorar categorías
  </h2>

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {CATS.map((cat, i) => (
      <Link
        key={cat.slug}
        href={`/organizar/${cat.slug}`}
        className="group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-orange-400/70 transition"
      >
        <article className="h-full">
          <div className="relative aspect-[4/3] bg-black overflow-hidden">
            <Image
              src={cat.cover}
              alt={cat.label}
              fill
              className="object-cover group-hover:scale-105 transition duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={i === 0}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-lg font-bold text-white">{cat.label}</h3>
              <p className="text-sm text-zinc-300 mt-1">{cat.desc}</p>
            </div>
          </div>
        </article>
      </Link>
    ))}
  </div>
</div>
        </div>

        <div className="space-y-6">
          <FichaTecnica uploadId={id} />
        </div>
      </div>
    </div>
  );
}
