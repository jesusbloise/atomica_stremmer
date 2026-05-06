"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

/* ============ Modo datos en vivo ============ */
const DEMO_MODE = false;
const API_PATH = "/api/uploads";

/* ================== Categorías principales ================== */
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

type Group = { label: string };

const STRUCTURE: Record<string, Group[]> = {
  publicidad: [
    { label: "Marca" },
    { label: "Agencia" },
    { label: "Productora" },
    { label: "Contacto" },
    { label: "Oficina" },
    { label: "Tipo" },
  ],
  entretenimiento: [
    { label: "Estudio" },
    { label: "Productora" },
    { label: "Director" },
    { label: "Productor" },
    { label: "Oficina" },
    { label: "Tipo" },
  ],
  vxf: [
    { label: "Producción" },
    { label: "Corporativo" },
    { label: "Nuevos Negocios" },
  ],
};

const OFFICE_OPTIONS = ["Chile", "Mexico"] as const;
const COLOR_PUBLICIDAD = ["3D", "IA", "Musica", "Sonido"] as const;
const COLOR_ENTRETENIMIENTO = ["3D", "IA", "Musica", "Sonido", "VFX", "Edicion"] as const;

type UploadItem = {
  id: string;
  file_name: string;
  file_path: string;
  url?: string;
  uploaded_at?: string;
  size_in_bytes?: number;
  tipo?: "video" | "documento" | null;
  category?: string | null;
  subcategory?: string | null;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;
const DOC_EXT = /\.doc$/i;

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

  // signed/public URLs => directo
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }

  return s;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function getPerPage(w: number) {
  if (w < 480) return 1;
  if (w < 768) return 2;
  if (w < 1024) return 3;
  if (w < 1280) return 4;
  return 5;
}
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

function DocumentPreview({
  url,
  kind,
  isMobile,
}: {
  url: string;
  kind: "pdf" | "docx" | "doc";
  isMobile: boolean;
}) {
  const safeUrl = proxiedUrl(url);

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
        src={`${safeUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
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

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (next: number) => void;
}) {
  if (totalPages <= 1) return null;

  const current = page + 1;
  const maxButtons = 5;

  let start = Math.max(1, current - Math.floor(maxButtons / 2));
  let end = start + maxButtons - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxButtons + 1);
  }

  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  const go = (n1: number) => onPage(n1 - 1);

  return (
    <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
      <button
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0}
        className="h-9 w-9 grid place-items-center rounded-full border border-zinc-700 disabled:opacity-50 hover:border-zinc-500 text-zinc-200"
      >
        ‹
      </button>

      {nums.map((n) => {
        const active = n === current;
        return (
          <button
            key={n}
            onClick={() => go(n)}
            className={[
              "h-9 min-w-9 px-3 grid place-items-center rounded-full border text-sm transition",
              active
                ? "border-orange-500/60 bg-orange-500/15 text-orange-300"
                : "border-zinc-700 hover:border-zinc-500 text-zinc-200",
            ].join(" ")}
          >
            {n}
          </button>
        );
      })}

      <button
        onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="h-9 w-9 grid place-items-center rounded-full border border-zinc-700 disabled:opacity-50 hover:border-zinc-500 text-zinc-200"
      >
        ›
      </button>
    </div>
  );
}

export default function CategoryFiles({ slug }: { slug: string }) {
  const [activeSlug, setActiveSlug] = useState(slug);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UploadItem[]>([]);
  const [menuMain, setMenuMain] = useState<string>("");
  const [menuOffice, setMenuOffice] = useState<string>("");
  const [menuColor, setMenuColor] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverMain, setHoverMain] = useState<string>("");
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const [fullViewSub, setFullViewSub] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [fullPage, setFullPage] = useState(0);
  const FULL_PAGE_SIZE = 8;

  useEffect(() => setActiveSlug(slug), [slug]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        if (DEMO_MODE) {
          setRows([]);
          return;
        }

        const url = new URL(API_PATH, window.location.origin);
        url.searchParams.set("category", activeSlug);
        url.searchParams.set("limit", "500");

        const res = await fetch(url.toString(), {
          cache: "no-store",
          headers: { "x-no-cache": String(Date.now()) },
        });
        const arr = await res.json();

        if (!alive) return;

        const list: UploadItem[] = Array.isArray(arr) ? arr : [];
        list.sort(
          (a, b) =>
            (Date.parse(b.uploaded_at || "") || 0) -
            (Date.parse(a.uploaded_at || "") || 0)
        );

        setRows(list);
      } catch (e) {
        console.error("Carga categoría error:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeSlug]);

  useEffect(() => {
    setMenuMain("");
    setMenuOffice("");
    setMenuColor("");
    setMenuOpen(false);
    setHoverMain("");
    setFullViewSub(null);
  }, [activeSlug]);

  useEffect(() => {
    if (fullViewSub) setFullPage(0);
  }, [fullViewSub]);

  const groups = STRUCTURE[activeSlug] || [];
  const hasGroups = groups.length > 0;

  const colorsForSlug = useMemo(() => {
    return activeSlug === "entretenimiento"
      ? Array.from(COLOR_ENTRETENIMIENTO)
      : Array.from(COLOR_PUBLICIDAD);
  }, [activeSlug]);

  const navTarget = useMemo(() => {
    if (!menuMain) return null;
    if (menuMain === "Oficina") return menuOffice || null;
    if (menuMain === "Tipo") return menuColor || null;
    return menuMain;
  }, [menuMain, menuOffice, menuColor]);

  const grouped = useMemo(() => {
    if (!hasGroups) return new Map<string, UploadItem[]>([["__all__", rows]]);

    const map = new Map<string, UploadItem[]>();

    for (const it of rows) {
      const sub = (it.subcategory || "").toString().trim();

      if (sub) {
        if (!map.has(sub)) map.set(sub, []);
        map.get(sub)!.push(it);
        continue;
      }

      const defaultKey =
        activeSlug === "publicidad"
          ? "Marca"
          : activeSlug === "entretenimiento"
          ? "Estudio"
          : "Producción";

      if (!map.has(defaultKey)) map.set(defaultKey, []);
      map.get(defaultKey)!.push(it);
    }

    return map;
  }, [rows, hasGroups, activeSlug]);

  const title = CATS.find((c) => c.slug === activeSlug)?.label ?? "Sección";

  useEffect(() => {
    if (!navTarget) return;
    const id = slugify(navTarget);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [navTarget]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = menuWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setMenuOpen(false);
        setHoverMain("");
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const fullItems = useMemo(() => {
    if (!fullViewSub) return [];

    return rows.filter((r) => {
      const sub = (r.subcategory || "").toString().trim();

      if (sub) return sub === fullViewSub;

      const defaultKey =
        activeSlug === "publicidad"
          ? "Marca"
          : activeSlug === "entretenimiento"
          ? "Estudio"
          : "Producción";

      return defaultKey === fullViewSub;
    });
  }, [fullViewSub, rows, activeSlug]);

  const fullTotalPages = Math.max(1, Math.ceil(fullItems.length / FULL_PAGE_SIZE));
  const fullPageItems = useMemo(() => {
    const start = fullPage * FULL_PAGE_SIZE;
    return fullItems.slice(start, start + FULL_PAGE_SIZE);
  }, [fullItems, fullPage]);

  const currentLabel = useMemo(() => {
    if (!menuMain) return "Estructura";
    if (menuMain === "Oficina" && menuOffice) return `Oficina / ${menuOffice}`;
    if (menuMain === "Tipo" && menuColor) return `Color / ${menuColor}`;
    if (menuMain === "Oficina") return "Oficina";
    if (menuMain === "Tipo") return "Tipo";
    return menuMain;
  }, [menuMain, menuOffice, menuColor]);

  const onPickLeaf = (leaf: string) => {
    setMenuMain(leaf);
    setMenuOffice("");
    setMenuColor("");
    setMenuOpen(false);
    setHoverMain("");
  };

  const onPickOffice = (v: string) => {
    setMenuMain("Oficina");
    setMenuOffice(v);
    setMenuColor("");
    setMenuOpen(false);
    setHoverMain("");
  };

  const onPickColor = (v: string) => {
    setMenuMain("Tipo");
    setMenuColor(v);
    setMenuOffice("");
    setMenuOpen(false);
    setHoverMain("");
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6 text-white">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>

      {hasGroups && (
        <div className="mb-6" ref={menuWrapRef}>
          <div className="inline-block relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white border border-zinc-700 text-sm hover:border-zinc-500 transition flex items-center gap-2"
              type="button"
            >
              <span className="truncate max-w-[240px] sm:max-w-[360px]">{currentLabel}</span>
              <span className="text-zinc-400">▾</span>
            </button>

            {menuOpen && (
              <div className="absolute mt-2 left-0 z-40 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden">
                <div className="flex">
                  <div className="w-[260px] py-2">
                    {groups.map((g) => {
                      const hasFlyout = g.label === "Oficina" || g.label === "Tipo";
                      const active = hoverMain === g.label;

                      return (
                        <div
                          key={g.label}
                          className="relative"
                          onMouseEnter={() => setHoverMain(g.label)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasFlyout) onPickLeaf(g.label);
                              else setHoverMain(g.label);
                            }}
                            className={[
                              "w-full px-3 py-2 text-left text-sm flex items-center justify-between transition",
                              active ? "bg-zinc-900" : "bg-transparent",
                              "hover:bg-zinc-900",
                            ].join(" ")}
                          >
                            <span className="text-zinc-100">{g.label}</span>
                            {hasFlyout ? <span className="text-zinc-500">›</span> : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {(hoverMain === "Oficina" || hoverMain === "Tipo") && (
                    <div className="w-[220px] border-l border-zinc-800 py-2">
                      {hoverMain === "Oficina" && (
                        <>
                          <div className="px-3 pb-2 text-xs text-zinc-500">Oficina</div>
                          {OFFICE_OPTIONS.map((o) => (
                            <button
                              key={o}
                              type="button"
                              onClick={() => onPickOffice(o)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-900 transition text-zinc-100"
                            >
                              {o}
                            </button>
                          ))}
                        </>
                      )}

                      {hoverMain === "Tipo" && (
                        <>
                          <div className="px-3 pb-2 text-xs text-zinc-500">Color</div>
                          {colorsForSlug.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => onPickColor(c)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-900 transition text-zinc-100"
                            >
                              {c}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-zinc-400 py-10">Cargando…</div>
      ) : grouped.size === 0 ? (
        <div className="text-zinc-400 py-10">No hay archivos en esta sección.</div>
      ) : (
        <>
          {[...grouped.entries()].map(([sub, items]) => {
            if (!items.length) return null;

            const id = slugify(sub);
            return (
              <div
                key={sub}
                ref={(el) => {
                  sectionRefs.current[id] = el;
                }}
                id={`sub-${id}`}
                className="mb-10"
              >
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setFullViewSub(sub)}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition"
                    title="Ver todos los archivos"
                  >
                    Ver más
                  </button>

                  <h2 className="text-xl md:text-2xl font-semibold">{sub}</h2>

                  <div className="w-[72px]" aria-hidden="true" />
                </div>

                <CategoryCarousel items={items} />
              </div>
            );
          })}

          <div className="w-full flex justify-center">
            <div className="w-full max-w-[1200px] px-4 py-8">
              <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">
                Categorías principales
              </h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr gap-4 sm:gap-6">
                {CATS.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/organizar/${c.slug}`}
                    className="group block h-full min-w-0"
                  >
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
        </>
      )}

      {fullViewSub && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-50 h-full overflow-y-auto">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl md:text-3xl font-bold">{fullViewSub}</h2>
                <button
                  onClick={() => setFullViewSub(null)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-white"
                >
                  Volver
                </button>
              </div>

              {fullItems.length === 0 ? (
                <div className="text-zinc-400 py-12">Sin archivos.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {fullPageItems.map((u) => (
                      <CardItemOverlay key={u.id} item={u} />
                    ))}
                  </div>

                  <Pagination page={fullPage} totalPages={fullTotalPages} onPage={setFullPage} />
                </>
              )}

              <div className="h-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardItem({ item }: { item: UploadItem }) {
  const isMobile = useIsMobile();
  const rawUrl = item.url || item.file_path || "";
  const name = stripExt(item.file_name || rawUrl);
  const url = proxiedUrl(rawUrl);

  const isVideo = item.tipo === "video" || VIDEO_EXT.test(rawUrl);
  const isPdf = PDF_EXT.test(rawUrl);
  const isDocx = DOCX_EXT.test(rawUrl);
  const isDoc = !isDocx && DOC_EXT.test(rawUrl);

  return (
    <motion.article
      className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm"
      initial={isMobile ? undefined : "rest"}
      animate={isMobile ? undefined : "rest"}
      whileHover={isMobile ? undefined : "hover"}
    >
      <div className="relative h-[48vh] sm:h-[50vh] md:h-[18rem] lg:h-[22rem] xl:h-[24rem] bg-zinc-800 overflow-hidden">
        {isVideo ? (
          <motion.video
            src={url}
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
            variants={
              isMobile
                ? undefined
                : {
                    rest: { scale: 1 },
                    hover: { scale: 1.06, transition: { duration: 0.6 } },
                  }
            }
          />
        ) : isPdf ? (
          <DocumentPreview url={rawUrl} kind="pdf" isMobile={isMobile} />
        ) : isDocx ? (
          <DocumentPreview url={rawUrl} kind="docx" isMobile={isMobile} />
        ) : isDoc ? (
          <DocumentPreview url={rawUrl} kind="doc" isMobile={isMobile} />
        ) : (
          <motion.div
            className="absolute inset-0 grid place-items-center text-zinc-300 text-xs"
          >
            Sin vista previa
          </motion.div>
        )}

        {isMobile ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/55" />
        ) : (
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50"
            variants={{
              rest: { opacity: 0.65 },
              hover: { opacity: 0.9, transition: { duration: 0.25 } },
            }}
          />
        )}

        <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
            <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-40 overflow-auto">
              {name}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              <Link href={`/videos/${item.id}`} aria-label={`Ver más sobre ${name}`}>
                <motion.button
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.96 }}
                  className="text-sm px-4 py-2 rounded border text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 transition"
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
}

function CardItemOverlay({ item }: { item: UploadItem }) {
  const isMobile = useIsMobile();
  const rawUrl = item.url || item.file_path || "";
  const name = stripExt(item.file_name || rawUrl);
  const url = proxiedUrl(rawUrl);

  const isVideo = item.tipo === "video" || VIDEO_EXT.test(rawUrl);
  const isPdf = PDF_EXT.test(rawUrl);
  const isDocx = DOCX_EXT.test(rawUrl);
  const isDoc = !isDocx && DOC_EXT.test(rawUrl);

  return (
    <motion.article className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm">
      <div className="relative h-[52vh] sm:h-[54vh] md:h-[20rem] lg:h-[26rem] xl:h-[28rem] bg-zinc-800 overflow-hidden">
        {isVideo ? (
          <motion.video
            src={url}
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
          <DocumentPreview url={rawUrl} kind="pdf" isMobile={isMobile} />
        ) : isDocx ? (
          <DocumentPreview url={rawUrl} kind="docx" isMobile={isMobile} />
        ) : isDoc ? (
          <DocumentPreview url={rawUrl} kind="doc" isMobile={isMobile} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-zinc-300 text-xs">
            Sin vista previa
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50" />

        <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
            <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-40 overflow-auto">
              {name}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
              <Link href={`/videos/${item.id}`} aria-label={`Ver más sobre ${name}`}>
                <motion.button className="text-sm px-4 py-2 rounded border text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 transition">
                  Ver más
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CategoryCarousel({ items }: { items: UploadItem[] }) {
  const [perPage, setPerPage] = useState(5);
  const [page, setPage] = useState(0);

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

  const next = () => total && setPage((p) => (p + 1) % total);
  const prev = () => total && setPage((p) => (p - 1 + total) % total);

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touchStartX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="Archivos"
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
              {slice.map((u) => (
                <CardItem key={u.id} item={u} />
              ))}
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
        </>
      )}
    </section>
  );
}


// "use client";

// import Link from "next/link";
// import Image from "next/image";
// import { motion } from "framer-motion";
// import { useEffect, useMemo, useRef, useState } from "react";

// /* ============ Modo datos en vivo ============ */
// const DEMO_MODE = false;
// const API_PATH = "/api/uploads";

// /* ================== Categorías principales ================== */
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

// /* ================== Estructura (según tu jefa) ================== */
// type Group = { label: string };

// const STRUCTURE: Record<string, Group[]> = {
//   publicidad: [
//     { label: "Marca" },
//     { label: "Agencia" },
//     { label: "Productora" },
//     { label: "Contacto" },
//     { label: "Oficina" },
//     { label: "Tipo" },
//   ],
//   entretenimiento: [
//     { label: "Estudio" },
//     { label: "Productora" },
//     { label: "Director" },
//     { label: "Productor" },
//     { label: "Oficina" },
//     { label: "Tipo" },
//   ],
//   vxf: [
//     { label: "Producción" },
//     { label: "Corporativo" },
//     { label: "Nuevos Negocios" },
//   ],
// };

// const OFFICE_OPTIONS = ["Chile", "Mexico"] as const;

// const COLOR_PUBLICIDAD = ["3D", "IA", "Musica", "Sonido"] as const;
// const COLOR_ENTRETENIMIENTO = ["3D", "IA", "Musica", "Sonido", "VFX", "Edicion"] as const;

// /* ===== Tipos de tu API ===== */
// type UploadItem = {
//   id: string;
//   file_name: string;
//   file_path: string;
//   uploaded_at?: string;
//   size_in_bytes?: number;
//   tipo?: "video" | "documento" | null;
//   category?: string | null;
//   subcategory?: string | null;
// };

// /* ===== Utils ===== */
// const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
// const PDF_EXT = /\.pdf$/i;
// const DOCX_EXT = /\.docx$/i;
// const DOC_EXT = /\.doc$/i;

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

// /**
//  * ✅ IMPORTANTÍSIMO: evita CORS en producción.
//  * - Si ya viene proxificado, lo deja.
//  * - Si viene absoluto http/https (MinIO), lo manda a /api/proxy
//  * - Si viene relativo, lo deja igual.
//  */
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

// function chunk<T>(arr: T[], size: number): T[][] {
//   const out: T[][] = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }
// function getPerPage(w: number) {
//   if (w < 480) return 1;
//   if (w < 768) return 2;
//   if (w < 1024) return 3;
//   if (w < 1280) return 4;
//   return 5;
// }
// function slugify(input: string) {
//   return input
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/\p{Diacritic}/gu, "")
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/(^-|-$)/g, "");
// }

// /* ===== Hook: detectar móvil (sin hover) ===== */
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
//       mql.addListener(onChange);
//       return () => mql.removeListener(onChange);
//     }
//   }, []);
//   return isMobile;
// }

// /* ====== Preview para PDF / DOCX / DOC ====== */
// function DocumentPreview({
//   url,
//   kind,
//   isMobile,
// }: {
//   url: string;
//   kind: "pdf" | "docx" | "doc";
//   isMobile: boolean;
// }) {
//   // ✅ siempre usar URL segura
//   const safeUrl = proxiedUrl(url);

//   if (kind === "pdf") {
//     if (isMobile) {
//       return (
//         <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-200 text-lg font-semibold tracking-widest">
//           PDF
//         </div>
//       );
//     }
//     return (
//       <iframe
//         title="Vista previa PDF"
//         src={`${safeUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
//         className="absolute inset-0 w-full h-full pointer-events-none"
//         loading="lazy"
//       />
//     );
//   }
//   if (kind === "docx") {
//     return (
//       <div className="absolute inset-0">
//         <Image
//           src="/docx1.png"
//           alt="Documento DOCX"
//           fill
//           className="object-cover pointer-events-none select-none"
//         />
//       </div>
//     );
//   }
//   return (
//     <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-200 text-lg font-semibold tracking-widest">
//       DOC
//     </div>
//   );
// }

// /* ====================== Paginación (overlay) ====================== */
// function Pagination({
//   page,
//   totalPages,
//   onPage,
// }: {
//   page: number;
//   totalPages: number;
//   onPage: (next: number) => void;
// }) {
//   if (totalPages <= 1) return null;

//   const current = page + 1;
//   const maxButtons = 5;

//   let start = Math.max(1, current - Math.floor(maxButtons / 2));
//   let end = start + maxButtons - 1;
//   if (end > totalPages) {
//     end = totalPages;
//     start = Math.max(1, end - maxButtons + 1);
//   }

//   const nums: number[] = [];
//   for (let i = start; i <= end; i++) nums.push(i);

//   const go = (n1: number) => onPage(n1 - 1);

//   return (
//     <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
//       <button
//         onClick={() => onPage(Math.max(0, page - 1))}
//         disabled={page === 0}
//         className="h-9 w-9 grid place-items-center rounded-full border border-zinc-700 disabled:opacity-50 hover:border-zinc-500 text-zinc-200"
//         aria-label="Página anterior"
//         title="Anterior"
//       >
//         ‹
//       </button>

//       {start > 1 && (
//         <>
//           <button
//             onClick={() => go(1)}
//             className="h-9 min-w-9 px-3 grid place-items-center rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm"
//           >
//             1
//           </button>
//           {start > 2 && <span className="px-1 text-zinc-500">…</span>}
//         </>
//       )}

//       {nums.map((n) => {
//         const active = n === current;
//         return (
//           <button
//             key={n}
//             onClick={() => go(n)}
//             className={[
//               "h-9 min-w-9 px-3 grid place-items-center rounded-full border text-sm transition",
//               active
//                 ? "border-orange-500/60 bg-orange-500/15 text-orange-300"
//                 : "border-zinc-700 hover:border-zinc-500 text-zinc-200",
//             ].join(" ")}
//             aria-current={active ? "page" : undefined}
//           >
//             {n}
//           </button>
//         );
//       })}

//       {end < totalPages && (
//         <>
//           {end < totalPages - 1 && <span className="px-1 text-zinc-500">…</span>}
//           <button
//             onClick={() => go(totalPages)}
//             className="h-9 min-w-9 px-3 grid place-items-center rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm"
//           >
//             {totalPages}
//           </button>
//         </>
//       )}

//       <button
//         onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
//         disabled={page >= totalPages - 1}
//         className="h-9 w-9 grid place-items-center rounded-full border border-zinc-700 disabled:opacity-50 hover:border-zinc-500 text-zinc-200"
//         aria-label="Página siguiente"
//         title="Siguiente"
//       >
//         ›
//       </button>
//     </div>
//   );
// }

// /* ====================== Componente principal ====================== */
// export default function CategoryFiles({ slug }: { slug: string }) {
//   const [activeSlug, setActiveSlug] = useState(slug);
//   const [loading, setLoading] = useState(true);
//   const [rows, setRows] = useState<UploadItem[]>([]);

//   const [menuMain, setMenuMain] = useState<string>("");
//   const [menuOffice, setMenuOffice] = useState<string>("");
//   const [menuColor, setMenuColor] = useState<string>("");

//   const [menuOpen, setMenuOpen] = useState(false);
//   const [hoverMain, setHoverMain] = useState<string>("");

//   const menuWrapRef = useRef<HTMLDivElement | null>(null);

//   const [fullViewSub, setFullViewSub] = useState<string | null>(null);
//   const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

//   useEffect(() => setActiveSlug(slug), [slug]);

//   useEffect(() => {
//     let alive = true;

//     (async () => {
//       try {
//         setLoading(true);

//         if (DEMO_MODE) {
//           setRows([]);
//           return;
//         }

//         const url = new URL(API_PATH, window.location.origin);
//         url.searchParams.set("category", activeSlug);
//         url.searchParams.set("limit", "500");

//         const res = await fetch(url.toString(), {
//           cache: "no-store",
//           headers: { "x-no-cache": String(Date.now()) },
//         });
//         const arr = await res.json();

//         if (!alive) return;

//         const list: UploadItem[] = Array.isArray(arr) ? arr : [];
//         list.sort(
//           (a, b) =>
//             (Date.parse(b.uploaded_at || "") || 0) -
//             (Date.parse(a.uploaded_at || "") || 0)
//         );

//         setRows(list);
//       } catch (e) {
//         console.error("Carga categoría error:", e);
//         if (alive) setRows([]);
//       } finally {
//         if (alive) setLoading(false);
//       }
//     })();

//     return () => {
//       alive = false;
//     };
//   }, [activeSlug]);

//   useEffect(() => {
//     setMenuMain("");
//     setMenuOffice("");
//     setMenuColor("");
//     setMenuOpen(false);
//     setHoverMain("");
//     setFullViewSub(null);
//   }, [activeSlug]);

//   const groups = STRUCTURE[activeSlug] || [];
//   const hasGroups = groups.length > 0;

//   const colorsForSlug = useMemo(() => {
//     return activeSlug === "entretenimiento"
//       ? Array.from(COLOR_ENTRETENIMIENTO)
//       : Array.from(COLOR_PUBLICIDAD);
//   }, [activeSlug]);

//   const navTarget = useMemo(() => {
//     if (!menuMain) return null;
//     if (menuMain === "Oficina") return menuOffice || null;
//     if (menuMain === "Tipo") return menuColor || null;
//     return menuMain;
//   }, [menuMain, menuOffice, menuColor]);

//   const leafSections = useMemo(() => {
//     const out: string[] = [];
//     for (const g of groups) {
//       if (g.label === "Oficina") out.push(...OFFICE_OPTIONS);
//       else if (g.label === "Tipo") out.push(...colorsForSlug);
//       else out.push(g.label);
//     }
//     return Array.from(new Set(out));
//   }, [groups, colorsForSlug]);

//   const grouped = useMemo(() => {
//   if (!hasGroups) return new Map<string, UploadItem[]>([["__all__", rows]]);

//   const map = new Map<string, UploadItem[]>();

//   for (const it of rows) {
//     const sub = (it.subcategory || "").toString().trim();

//     if (sub) {
//       if (!map.has(sub)) map.set(sub, []);
//       map.get(sub)!.push(it);
//       continue;
//     }

//     const defaultKey =
//       activeSlug === "publicidad"
//         ? "Marca"
//         : activeSlug === "entretenimiento"
//         ? "Estudio"
//         : "Producción";

//     if (!map.has(defaultKey)) map.set(defaultKey, []);
//     map.get(defaultKey)!.push(it);
//   }

//   return map;
// }, [rows, hasGroups, activeSlug]);

//   const title = CATS.find((c) => c.slug === activeSlug)?.label ?? "Sección";

//   useEffect(() => {
//     if (!navTarget) return;
//     const id = slugify(navTarget);
//     const el = sectionRefs.current[id];
//     if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
//   }, [navTarget]);

//   useEffect(() => {
//     if (!menuOpen) return;
//     const onDown = (e: MouseEvent) => {
//       const el = menuWrapRef.current;
//       if (!el) return;
//       if (!el.contains(e.target as Node)) {
//         setMenuOpen(false);
//         setHoverMain("");
//       }
//     };
//     window.addEventListener("mousedown", onDown);
//     return () => window.removeEventListener("mousedown", onDown);
//   }, [menuOpen]);

//   const openFullView = (sub: string) => setFullViewSub(sub);
//   const closeFullView = () => setFullViewSub(null);

//   const [fullPage, setFullPage] = useState(0);
//   const FULL_PAGE_SIZE = 8;

//   useEffect(() => {
//     if (fullViewSub) setFullPage(0);
//   }, [fullViewSub]);

//  const fullItems = useMemo(() => {
//   if (!fullViewSub) return [];

//   return rows.filter((r) => {
//     const sub = (r.subcategory || "").toString().trim();

//     if (sub) {
//       return sub === fullViewSub;
//     }

//     const defaultKey =
//       activeSlug === "publicidad"
//         ? "Marca"
//         : activeSlug === "entretenimiento"
//         ? "Estudio"
//         : "Producción";

//     return defaultKey === fullViewSub;
//   });
// }, [fullViewSub, rows, activeSlug]);

//   const fullTotalPages = Math.max(1, Math.ceil(fullItems.length / FULL_PAGE_SIZE));
//   const fullPageItems = useMemo(() => {
//     const start = fullPage * FULL_PAGE_SIZE;
//     return fullItems.slice(start, start + FULL_PAGE_SIZE);
//   }, [fullItems, fullPage]);

//   const currentLabel = useMemo(() => {
//     if (!menuMain) return "Estructura";
//     if (menuMain === "Oficina" && menuOffice) return `Oficina / ${menuOffice}`;
//     if (menuMain === "Tipo" && menuColor) return `Color / ${menuColor}`;
//     if (menuMain === "Oficina") return "Oficina";
//     if (menuMain === "Tipo") return "Tipo";
//     return menuMain;
//   }, [menuMain, menuOffice, menuColor]);

//   const onPickLeaf = (leaf: string) => {
//     setMenuMain(leaf);
//     setMenuOffice("");
//     setMenuColor("");
//     setMenuOpen(false);
//     setHoverMain("");
//   };

//   const onPickOffice = (v: string) => {
//     setMenuMain("Oficina");
//     setMenuOffice(v);
//     setMenuColor("");
//     setMenuOpen(false);
//     setHoverMain("");
//   };

//   const onPickColor = (v: string) => {
//     setMenuMain("Tipo");
//     setMenuColor(v);
//     setMenuOffice("");
//     setMenuOpen(false);
//     setHoverMain("");
//   };

//   return (
//     <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6 text-white">
//       <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>

//       {/* Dropdown flyout */}
//       {hasGroups && (
//         <div className="mb-6" ref={menuWrapRef}>
//           <div className="inline-block relative">
//             <button
//               onClick={() => setMenuOpen((v) => !v)}
//               className="px-4 py-2 rounded-xl bg-zinc-900 text-white border border-zinc-700 text-sm hover:border-zinc-500 transition flex items-center gap-2"
//               aria-haspopup="menu"
//               aria-expanded={menuOpen}
//               type="button"
//             >
//               <span className="truncate max-w-[240px] sm:max-w-[360px]">{currentLabel}</span>
//               <span className="text-zinc-400">▾</span>
//             </button>

//             {menuOpen && (
//               <div className="absolute mt-2 left-0 z-40 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden">
//                 <div className="flex">
//                   {/* Columna izquierda: items principales */}
//                   <div className="w-[260px] py-2">
//                     {groups.map((g) => {
//                       const hasFlyout = g.label === "Oficina" || g.label === "Tipo";
//                       const active = hoverMain === g.label;

//                       return (
//                         <div
//                           key={g.label}
//                           className="relative"
//                           onMouseEnter={() => setHoverMain(g.label)}
//                         >
//                           <button
//                             type="button"
//                             onClick={() => {
//                               if (!hasFlyout) onPickLeaf(g.label);
//                               else setHoverMain(g.label);
//                             }}
//                             className={[
//                               "w-full px-3 py-2 text-left text-sm flex items-center justify-between transition",
//                               active ? "bg-zinc-900" : "bg-transparent",
//                               "hover:bg-zinc-900",
//                             ].join(" ")}
//                           >
//                             <span className="text-zinc-100">{g.label}</span>
//                             {hasFlyout ? <span className="text-zinc-500">›</span> : null}
//                           </button>
//                         </div>
//                       );
//                     })}
//                   </div>

//                   {(hoverMain === "Oficina" || hoverMain === "Tipo") && (
//                     <div className="w-[220px] border-l border-zinc-800 py-2">
//                       {hoverMain === "Oficina" && (
//                         <>
//                           <div className="px-3 pb-2 text-xs text-zinc-500">Oficina</div>
//                           {OFFICE_OPTIONS.map((o) => (
//                             <button
//                               key={o}
//                               type="button"
//                               onClick={() => onPickOffice(o)}
//                               className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-900 transition text-zinc-100"
//                             >
//                               {o}
//                             </button>
//                           ))}
//                         </>
//                       )}

//                       {hoverMain === "Tipo" && (
//                         <>
//                           <div className="px-3 pb-2 text-xs text-zinc-500">Color</div>
//                           {colorsForSlug.map((c) => (
//                             <button
//                               key={c}
//                               type="button"
//                               onClick={() => onPickColor(c)}
//                               className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-900 transition text-zinc-100"
//                             >
//                               {c}
//                             </button>
//                           ))}
//                         </>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {loading ? (
//         <div className="text-zinc-400 py-10">Cargando…</div>
//       ) : grouped.size === 0 ? (
//         <div className="text-zinc-400 py-10">No hay archivos en esta sección.</div>
//       ) : (
//         <>
//           {[...grouped.entries()].map(([sub, items]) => {
//             if (!items.length) return null;

//             const id = slugify(sub);
//             return (
//               <div
//                 key={sub}
//                 ref={(el) => {
//                   sectionRefs.current[id] = el;
//                 }}
//                 id={`sub-${id}`}
//                 className="mb-10"
//               >
//                 <div className="flex items-center justify-between mb-3">
//                   <button
//                     onClick={() => openFullView(sub)}
//                     className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition"
//                     title="Ver todos los archivos"
//                   >
//                     Ver más
//                   </button>

//                   <h2 className="text-xl md:text-2xl font-semibold">{sub}</h2>

//                   <div className="w-[72px]" aria-hidden="true" />
//                 </div>

//                 <CategoryCarousel items={items} />
//               </div>
//             );
//           })}

//           <div className="w-full flex justify-center">
//             <div className="w-full max-w-[1200px] px-4 py-8">
//               <h1 className="text-center text-2xl md:text-3xl font-bold mb-6">
//                 Categorías principales
//               </h1>

//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch auto-rows-fr gap-4 sm:gap-6">
//                 {CATS.map((c, i) => (
//                   <Link
//                     key={c.slug}
//                     href={`/organizar/${c.slug}`}
//                     className="group block h-full min-w-0"
//                   >
//                     <article className="h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow">
//                       <div className="relative w-full aspect-[4/3] overflow-hidden bg-black">
//                         <Image
//                           src={c.cover}
//                           alt={c.label}
//                           fill
//                           className="object-cover group-hover:object-contain transition-all duration-300"
//                           sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
//                           priority={i === 0}
//                         />
//                       </div>
//                       <div className="p-4 mt-auto text-center">
//                         <h3 className="text-sm sm:text-base font-semibold truncate">{c.label}</h3>
//                         <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-snug">
//                           {c.desc}
//                         </p>
//                       </div>
//                     </article>
//                   </Link>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </>
//       )}

//       {fullViewSub && (
//         <div className="fixed inset-0 z-40">
//           <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
//           <div className="relative z-50 h-full overflow-y-auto">
//             <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-2xl md:text-3xl font-bold">{fullViewSub}</h2>
//                 <button
//                   onClick={() => setFullViewSub(null)}
//                   className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-white"
//                 >
//                   Volver
//                 </button>
//               </div>

//               {fullItems.length === 0 ? (
//                 <div className="text-zinc-400 py-12">Sin archivos.</div>
//               ) : (
//                 <>
//                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
//                     {fullPageItems.map((u) => (
//                       <CardItemOverlay key={u.id} item={u} />
//                     ))}
//                   </div>

//                   <Pagination page={fullPage} totalPages={fullTotalPages} onPage={setFullPage} />
//                 </>
//               )}

//               <div className="h-8" />
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ====================== Card individual (base) ====================== */
// function CardItem({ item }: { item: UploadItem }) {
//   const isMobile = useIsMobile();
//   const name = stripExt(item.file_name || item.file_path);

//   // ✅ url original (probablemente MinIO)
//   const rawUrl = item.file_path || "";

//   // ✅ url segura (proxy)
//   const url = proxiedUrl(rawUrl);

//   const isVideo = item.tipo === "video" || VIDEO_EXT.test(rawUrl);
//   const isPdf = PDF_EXT.test(rawUrl);
//   const isDocx = DOCX_EXT.test(rawUrl);
//   const isDoc = !isDocx && DOC_EXT.test(rawUrl);

//   return (
//     <motion.article
//       className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm"
//       initial={isMobile ? undefined : "rest"}
//       animate={isMobile ? undefined : "rest"}
//       whileHover={isMobile ? undefined : "hover"}
//     >
//       <div className="relative h-[48vh] sm:h-[50vh] md:h-[18rem] lg:h-[22rem] xl:h-[24rem] bg-zinc-800 overflow-hidden">
//         {isVideo ? (
//           <motion.video
//   src={url}
//   muted
//   loop
//   playsInline
//   autoPlay
//   preload="auto"
//   controls={false}
//   disablePictureInPicture
//   onLoadedData={(e) => {
//     e.currentTarget.play().catch(() => {});
//   }}
//   className="absolute inset-0 w-full h-full object-cover"
//   variants={
//     isMobile
//       ? undefined
//       : {
//           rest: { scale: 1 },
//           hover: { scale: 1.06, transition: { duration: 0.6 } },
//         }
//   }
// />
//         ) : isPdf ? (
//           <DocumentPreview url={rawUrl} kind="pdf" isMobile={isMobile} />
//         ) : isDocx ? (
//           <DocumentPreview url={rawUrl} kind="docx" isMobile={isMobile} />
//         ) : isDoc ? (
//           <DocumentPreview url={rawUrl} kind="doc" isMobile={isMobile} />
//         ) : (
//           <motion.div
//             className="absolute inset-0 grid place-items-center text-zinc-300 text-xs"
//             variants={
//               isMobile
//                 ? undefined
//                 : {
//                     rest: { scale: 1 },
//                     hover: { scale: 1.04, transition: { duration: 0.6 } },
//                   }
//             }
//           >
//             Sin vista previa
//           </motion.div>
//         )}

//         {isMobile ? (
//           <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/55" />
//         ) : (
//           <motion.div
//             className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50"
//             variants={{
//               rest: { opacity: 0.65 },
//               hover: { opacity: 0.9, transition: { duration: 0.25 } },
//             }}
//           />
//         )}

//         <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
//           <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
//             <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-40 overflow-auto">
//               {name}
//             </p>
//             <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
//               <Link href={`/videos/${item.id}`} aria-label={`Ver más sobre ${name}`}>
//                 <motion.button
//                   whileHover={{ scale: 1.07 }}
//                   whileTap={{ scale: 0.96 }}
//                   className="text-sm px-4 py-2 rounded border text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 transition"
//                 >
//                   Ver más
//                 </motion.button>
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </motion.article>
//   );
// }

// /* ====================== Card individual (overlay) ====================== */
// function CardItemOverlay({ item }: { item: UploadItem }) {
//   const isMobile = useIsMobile();
//   const name = stripExt(item.file_name || item.file_path);

//   const rawUrl = item.file_path || "";
//   const url = proxiedUrl(rawUrl);

//   const isVideo = item.tipo === "video" || VIDEO_EXT.test(rawUrl);
//   const isPdf = PDF_EXT.test(rawUrl);
//   const isDocx = DOCX_EXT.test(rawUrl);
//   const isDoc = !isDocx && DOC_EXT.test(rawUrl);

//   return (
//     <motion.article className="group h-full flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900 overflow-hidden shadow-sm">
//       <div className="relative h-[52vh] sm:h-[54vh] md:h-[20rem] lg:h-[26rem] xl:h-[28rem] bg-zinc-800 overflow-hidden">
//         {isVideo ? (
//           <motion.video
//   src={url}
//   muted
//   loop
//   playsInline
//   autoPlay
//   preload="auto"
//   controls={false}
//   disablePictureInPicture
//   onLoadedData={(e) => {
//     e.currentTarget.play().catch(() => {});
//   }}
//   className="absolute inset-0 w-full h-full object-cover"
// />
//         ) : isPdf ? (
//           <DocumentPreview url={rawUrl} kind="pdf" isMobile={isMobile} />
//         ) : isDocx ? (
//           <DocumentPreview url={rawUrl} kind="docx" isMobile={isMobile} />
//         ) : isDoc ? (
//           <DocumentPreview url={rawUrl} kind="doc" isMobile={isMobile} />
//         ) : (
//           <div className="absolute inset-0 grid place-items-center text-zinc-300 text-xs">
//             Sin vista previa
//           </div>
//         )}

//         <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/50" />

//         <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
//           <div className="pointer-events-auto px-6 py-5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-md text-center shadow-2xl max-w-[90vw] md:max-w-[720px]">
//             <p className="text-white text-xl md:text-2xl font-bold drop-shadow break-words whitespace-normal max-h-40 overflow-auto">
//               {name}
//             </p>
//             <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
//               <Link href={`/videos/${item.id}`} aria-label={`Ver más sobre ${name}`}>
//                 <motion.button className="text-sm px-4 py-2 rounded border text-orange-400 hover:text-orange-500 border-orange-400 hover:border-orange-500 transition">
//                   Ver más
//                 </motion.button>
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </motion.article>
//   );
// }

// /* ====================== Carrusel ====================== */
// function CategoryCarousel({ items }: { items: UploadItem[] }) {
//   const [perPage, setPerPage] = useState(5);
//   const [page, setPage] = useState(0);

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

//   const next = () => total && setPage((p) => (p + 1) % total);
//   const prev = () => total && setPage((p) => (p - 1 + total) % total);

//   const touchStartX = useRef<number | null>(null);
//   const onTouchStart = (e: React.TouchEvent) => (touchStartX.current = e.touches[0].clientX);
//   const onTouchEnd = (e: React.TouchEvent) => {
//     if (touchStartX.current === null) return;
//     const dx = e.changedTouches[0].clientX - touchStartX.current;
//     if (Math.abs(dx) > 48) dx < 0 ? next() : prev();
//     touchStartX.current = null;
//   };

//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "ArrowLeft") prev();
//       if (e.key === "ArrowRight") next();
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [total]);

//   return (
//     <section
//       className="relative overflow-hidden rounded-2xl"
//       role="region"
//       aria-roledescription="carousel"
//       aria-label="Archivos"
//       onTouchStart={onTouchStart}
//       onTouchEnd={onTouchEnd}
//     >
//       <div
//         className="flex transition-transform duration-500 ease-out"
//         style={{ transform: `translateX(-${page * 100}%)` }}
//       >
//         {pages.map((slice, idx) => (
//           <div key={idx} className="w-full shrink-0">
//             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
//               {slice.map((u) => (
//                 <CardItem key={u.id} item={u} />
//               ))}
//             </div>
//           </div>
//         ))}
//       </div>

//       {total > 1 && (
//         <>
//           <button
//             onClick={prev}
//             aria-label="Anterior"
//             className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
//           >
//             ‹
//           </button>
//           <button
//             onClick={next}
//             aria-label="Siguiente"
//             className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-white z-10"
//           >
//             ›
//           </button>
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
//         </>
//       )}
//     </section>
//   );
// }

