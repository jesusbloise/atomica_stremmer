// src/components/RelatedDiscoveryRail.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Item = {
    id: string;
    file_name?: string | null;
    display_name?: string | null;
    titulo?: string | null;
    url?: string | null;
    file_path?: string | null;
    tipo?: string | null;
    category?: string | null;
    subcategory?: string | null;
    uploaded_at?: string | null;
    thumbnail_url?: string | null;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;
const DOC_EXT = /\.(doc|docx)(\?|#|$)/i;

function stripExt(s?: string | null) {
    if (!s) return "Archivo";

    let safe = s;

    try {
        safe = decodeURIComponent(s);
    } catch { }

    return safe.split("/").pop()!.replace(/\.[^.]+$/, "");
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

export default function RelatedDiscoveryRail({
    uploadId,
}: {
    uploadId: string;
}) {
    const searchParams = useSearchParams();
    const q = searchParams.get("q")?.trim() || "";

    const rowRef = useRef<HTMLDivElement | null>(null);

    const [title, setTitle] = useState("Más archivos relacionados");
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;

        async function load() {
            try {
                setLoading(true);

                if (q) {
                    setTitle(`Resultados relacionados con “${q}”`);

                    const res = await fetch(
                        `/api/buscar?q=${encodeURIComponent(q)}`,
                        {
                            cache: "no-store",
                        }
                    );

                    const data = await res.json();
                    const arr = Array.isArray(data?.results)
                        ? data.results
                        : [];

                    if (alive) setItems(arr);

                    return;
                }

                const detailRes = await fetch(`/api/uploads/${uploadId}`, {
                    cache: "no-store",
                });

                const detail = await detailRes.json();
                const upload = detail?.upload;

                const category = upload?.category || "";
                const subcategory = upload?.subcategory || "";

                if (!category) {
                    if (alive) setItems([]);
                    return;
                }

                const params = new URLSearchParams();

                params.set("category", category);
                params.set("limit", "20");

                if (subcategory) {
                    params.set("subcategory", subcategory);
                }

                setTitle(
                    subcategory
                        ? `Más archivos de ${subcategory}`
                        : `Más archivos de ${category}`
                );

                const res = await fetch(
                    `/api/uploads?${params.toString()}`,
                    {
                        cache: "no-store",
                    }
                );

                const arr = await res.json();

                if (alive) {
                    setItems(Array.isArray(arr) ? arr : []);
                }
            } catch (e) {
                console.error("RelatedDiscoveryRail error:", e);

                if (alive) setItems([]);
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();

        return () => {
            alive = false;
        };
    }, [uploadId, q]);

    const visibleItems = useMemo(() => {
        return items.filter((x) => x?.id);
    }, [items]);

    const move = (dir: "left" | "right") => {
        const el = rowRef.current;

        if (!el) return;

        el.scrollBy({
            left:
                dir === "right"
                    ? el.clientWidth * 0.85
                    : -el.clientWidth * 0.85,
            behavior: "smooth",
        });
    };

    if (loading) {
        return (
            <section className="mt-12">
                <p className="text-sm text-zinc-400">
                    Cargando archivos relacionados...
                </p>
            </section>
        );
    }

    if (!visibleItems.length) return null;

    return (
        <section className="mt-12 border-t border-zinc-800 pt-8">
            <div className="mb-5">
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {title}
                </h2>


            </div>

            <div className="relative px-12 md:px-16">
                <button
                    type="button"
                    onClick={() => move("left")}
                    aria-label="Anterior"
                    className="hidden md:grid absolute left-0 top-1/2 -translate-y-1/2 z-30 h-14 w-14 place-items-center rounded-full bg-orange-500 text-black text-3xl font-bold shadow-xl hover:bg-orange-400 transition"
                >
                    ‹
                </button>

                <div
                    ref={rowRef}
                    className="overflow-x-auto scroll-smooth"
                    style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                    }}
                >
                    <div className="flex gap-6 pb-3">
                        {visibleItems.map((item) => {
                            const active = item.id === uploadId;

                            const name = stripExt(
                                item.display_name ||
                                item.titulo ||
                                item.file_name
                            );

                            const rawUrl =
                                item.url ||
                                item.file_path ||
                                "";

                            const previewUrl = proxiedUrl(rawUrl);

                            const isVideo =
                                item.tipo === "video" ||
                                VIDEO_EXT.test(rawUrl);

                            const isPdf = PDF_EXT.test(rawUrl);

                            const isDoc = DOC_EXT.test(rawUrl);

                            const href = q
                                ? `/videos/${item.id}?q=${encodeURIComponent(q)}`
                                : `/videos/${item.id}`;

                            return (
                                <Link
                                    key={item.id}
                                    href={href}
                                    prefetch={false}
                                    className={[
                                        "relative shrink-0",
                                        "w-[62vw] sm:w-[260px] md:w-[240px]",
                                        "h-[330px]",
                                        "overflow-hidden rounded-3xl border bg-zinc-900 transition",
                                        active
                                            ? "border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.45)]"
                                            : "border-zinc-800 hover:border-orange-500/70",
                                    ].join(" ")}
                                >
                                    {isVideo && previewUrl ? (
                                        <video
                                            src={previewUrl}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    ) : isPdf ? (
                                        <div className="absolute inset-0 grid place-items-center bg-zinc-900 text-orange-300 text-2xl font-bold">
                                            PDF
                                        </div>
                                    ) : isDoc ? (
                                        <div className="absolute inset-0 grid place-items-center bg-zinc-900 text-orange-300 text-2xl font-bold">
                                            DOC
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 grid place-items-center bg-zinc-900 text-zinc-400 text-sm">
                                            Sin vista previa
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50" />

                                    <div className="absolute inset-x-0 bottom-8 flex justify-center px-5">
                                        <div className="w-full rounded-2xl border border-white/10 bg-black/45 backdrop-blur-md px-6 py-6 text-center shadow-2xl">
                                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-orange-300">
                                                {item.tipo || "archivo"}
                                            </p>

                                            <h3 className="text-2xl font-bold text-white line-clamp-2">
                                                {name}
                                            </h3>

                                            <button
                                                type="button"
                                                className={[
                                                    "mt-5 rounded-xl border px-6 py-3 text-sm font-medium transition",
                                                    active
                                                        ? "border-orange-500 bg-orange-500/10 text-orange-300"
                                                        : "border-orange-400 text-orange-300 hover:bg-orange-500/10",
                                                ].join(" ")}
                                            >
                                                {active ? "Actual" : "Ver más"}
                                            </button>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => move("right")}
                    aria-label="Siguiente"
                    className="hidden md:grid absolute right-0 top-1/2 -translate-y-1/2 z-30 h-14 w-14 place-items-center rounded-full bg-orange-500 text-black text-3xl font-bold shadow-xl hover:bg-orange-400 transition"
                >
                    ›
                </button>
            </div>
        </section>
    );
}