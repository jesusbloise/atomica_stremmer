"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import DocumentViewer from "@/components/DocumentViewer";
import { useSubtitlesPolling } from "@/hooks/useSubtitlesPolling";
import LastVideosCarousel from "@/components/LastVideosCarousel";
import MostViewedCarousel from "@/components/MostViewedCarousel";
import ChatLateral from "./ChatLateral";
import FichaTecnica, { FichaTecnicaData } from "@/components/FichaTecnica";
// import VimeoGallery from "@/components/VimeoGallery"; // ❌ No es un módulo válido

const TablaSubtitulos = dynamic(() => import("@/components/TablaSubtitulos"), { ssr: false });
const TablaDocumento = dynamic(() => import("@/components/TablaDocumento"), { ssr: false });

async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const txt = await res.text();
    throw new Error(`Respuesta no JSON en ${url}: ${txt.slice(0, 200)}...`);
  }
  return res.json();
}

type Me = { id: string; name: string; role: string };
type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  author_name: string | null;
};

type Subtitulo = {
  time_start: number; // ✅ Siempre number después del procesamiento
  time_end: number;
  text: string;
  [k: string]: any;
};

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
  if (typeof v === "number") return v > 10_000 ? v / 1000 : v;
  if (typeof v === "string") {
    const h = parseHMS(v);
    if (h != null) return h;
    const n = Number(v);
    if (!Number.isNaN(n)) return n > 10_000 ? n / 1000 : n;
  }
  return null;
}

export default function VideoDetailPage({ id }: { id: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"video" | "documento" | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFileName, setDocumentFileName] = useState<string>("");
  const [documentoTexto, setDocumentoTexto] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [views, setViews] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const seekingLockRef = useRef(false);
  const lastJumpRef = useRef<number | null>(null);

  const viewerApiRef = useRef<{
    step?: (dir: 1 | -1) => number;
    findAll?: (q: string) => number;
    goToMatch?: (i: number) => void;
  }>({});

  const router = useRouter();

  const {
    subtitulos,
    setSubtitulos,
    polling,
    start: startPolling,
    stop: stopPolling,
    getStartSecFor,
  } = useSubtitlesPolling(id);

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
        ) ?? (typeof start === "number" ? start + 2 : 2);

      const text = r.text ?? r.content ?? r.line ?? "";

      return { time_start: start, time_end: end, text, ...r } as Subtitulo;
    });
  }, [subtitulos]);

  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const meRole = (me?.role ?? "").toString().trim().toUpperCase();
  const canPost = meRole === "ESTUDIANTE";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const s = await r.json().catch(() => null);
        if (!alive) return;
        setMe(s && s.id ? (s as Me) : null);
      } catch {
        if (alive) setMe(null);
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancel = false;

    (async () => {
      try {
        const { upload } = await fetchJSON<{ upload: any }>(`/api/uploads/${id}`);
        if (cancel) return;

        const t = (upload?.tipo as "video" | "documento") || null;
        setTipo(t);

        const fname = upload?.file_name || upload?.name || "";
        setDocumentFileName(fname);

        if (upload?.views !== undefined) setViews(upload.views);

        if (t === "video") {
          const url = upload?.url as string | undefined;
          if (url) setVideoUrl(url);

          try {
            const subs = await fetchJSON<any[]>(`/api/subtitulos/${id}`);
            if (!cancel) {
              if (Array.isArray(subs) && subs.length > 0) {
                setSubtitulos(subs);
                stopPolling();
              } else {
                startPolling();
              }
            }
          } catch {
            if (!cancel) startPolling();
          }
        }

        if (t === "documento") {
          const url = upload?.url as string | undefined;
          if (url) setDocumentUrl(url);

          try {
            const doc = await fetchJSON<{ documento?: { texto?: string } }>(`/api/documento/${id}`);
            if (!cancel) setDocumentoTexto(doc?.documento?.texto || "");
          } catch {
            if (!cancel) setDocumentoTexto("");
          }
        }
      } catch (e) {
        console.error("Carga de detalle falló:", e);
      }
    })();

    return () => {
      cancel = true;
      stopPolling();
    };
  }, [id]);

  const resolvedVideoUrl = useMemo(() => {
    if (!videoUrl) return null;
    if (videoUrl.startsWith("http://")) {
      return `/api/proxy?url=${encodeURIComponent(videoUrl)}`;
    }
    return videoUrl;
  }, [videoUrl]);

  const jumpTo = useCallback((tsSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;

    const MARGIN = 0.3;
    const target = Math.max(0, tsSeconds - MARGIN);

    if (lastJumpRef.current !== null && Math.abs(lastJumpRef.current - target) < 0.05) return;
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

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = msg.trim();
      if (!text || !canPost || !me?.id) return;

      const optimistic: CommentRow = {
        id: "tmp-" + Date.now(),
        content: text,
        created_at: new Date().toISOString(),
        user_id: me.id,
        author_name: me.name || "Tú",
      };
      setComments((c) => [optimistic, ...c]);
      setMsg("");

      setSending(true);
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: id, content: text, userId: me.id }),
        });
        if (!res.ok) throw new Error();
        const saved: CommentRow = await res.json();
        setComments((c) => [saved, ...c.filter((x) => x.id !== optimistic.id)]);
      } catch {
        setComments((c) => c.filter((x) => x.id !== optimistic.id));
        setMsg(text);
        alert("No se pudo enviar el comentario.");
      } finally {
        setSending(false);
      }
    },
    [id, msg, canPost, me]
  );

  // Puedes pasar data real aquí cuando conectes la BD
  const fichaData: FichaTecnicaData | undefined = undefined;

  return (
    <div className="min-h-screen bg-black text-white py-4 sm:py-6 px-0">
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2">
          {/* VIDEO */}
          {tipo === "video" && videoUrl && (
            <div className="mb-4">
              <div
                className="text-xs sm:text-sm text-white font-semibold mb-2 text-center truncate"
                title={documentFileName}
              >
                {documentFileName || "Video sin nombre"}
              </div>
              <div className="flex justify-center">
                <video
                  ref={videoRef}
                  src={resolvedVideoUrl ?? undefined}
                  controls
                  playsInline
                  controlsList="nodownload"
                  className="rounded-md shadow border border-zinc-700 max-w-full max-h-[420px] w-full h-auto"
                  preload="metadata"
                  onPlay={handlePlay}
                />
              </div>
              <div className="text-xs sm:text-sm text-zinc-400 mt-2 text-center">
                {views} visualización{views === 1 ? "" : "es"}
              </div>
            </div>
          )}

          {/* DOCUMENTO */}
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

          {/* Buscador + contador + rating */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <input
              type="text"
              placeholder=" Buscar palabra o frase..."
              value={searchTerm}
              onChange={(e) => {
                const q = e.target.value;
                setSearchTerm(q);
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

          {/* Tablas */}
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

          {/* Volver */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-lg text-sm border border-zinc-600 shadow"
            >
              ← Volver a la lista de archivos
            </button>
          </div>

          {/* Carruseles */}
          <div className="mt-12">
            <LastVideosCarousel />
            <MostViewedCarousel />
            {/* <VimeoGallery /> */}
          </div>
        </div>

        {/* Derecha: Ficha técnica + Chat */}
        <div className="space-y-6">
           <FichaTecnica uploadId={id} />
          {/* <ChatLateral uploadId={id} /> */}
        </div>
      </div>
    </div>
  );
}
