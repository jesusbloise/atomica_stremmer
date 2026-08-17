"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";

type ShowcaseItem = {
  id: string;
  file_name: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  uploaded_at: string | null;
  title: string;
  shareUrl: string;
};

type ShowcaseResponse = {
  rows: ShowcaseItem[];
  total: number;
};

type Props = {
  sourceId: string;
  shareToken: string;
};

function formatDuration(
  seconds?: number | null
) {
  const total = Number(seconds || 0);

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return "";
  }

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const remainingSeconds =
    Math.floor(total % 60);

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function resolveThumbnail(
  url?: string | null
) {
  if (!url) {
    return "";
  }

  const value = String(url).trim();

  if (
    value.startsWith(
      "/api/r2/proxy?url="
    ) ||
    value.startsWith(
      "/api/proxy?url="
    )
  ) {
    return value;
  }

  if (value.startsWith("r2://")) {
    return `/api/r2/proxy?url=${encodeURIComponent(
      value
    )}`;
  }

  if (value.startsWith("gs://")) {
    return `/api/proxy?url=${encodeURIComponent(
      value
    )}`;
  }

  return value;
}

function ShowcaseCard({
  item,
}: {
  item: ShowcaseItem;
}) {
  const thumbnail =
    resolveThumbnail(
      item.thumbnail_url
    );

  const duration =
    formatDuration(
      item.duration_sec
    );

  return (
    <article
      className="
        group relative h-full overflow-hidden
        rounded-2xl border border-zinc-800/80
        bg-zinc-900 shadow-sm
        transition-all duration-300 ease-out
        hover:z-40 hover:scale-[1.08]
        hover:border-orange-500/60
        hover:shadow-2xl
      "
    >
      <a
        href={item.shareUrl}
        className="block"
        aria-label={`Reproducir ${item.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={item.title}
              className="
                absolute inset-0 h-full w-full
                object-cover transition duration-500
                group-hover:scale-105
              "
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-900 to-black text-xs text-zinc-400">
              Vista previa no disponible
            </div>
          )}

          <div
            className="
              absolute inset-0
              bg-gradient-to-t
              from-black/90 via-black/20
              to-black/45
              transition duration-300
              group-hover:from-black/95
              group-hover:via-black/30
            "
          />

          <div
            className="
              absolute inset-0 grid place-items-center
              opacity-0 transition duration-300
              group-hover:opacity-100
            "
          >
            <div
              className="
                grid h-14 w-14 place-items-center
                rounded-full border border-white/40
                bg-black/55 text-white
                shadow-xl backdrop-blur-sm
              "
            >
              <Play className="ml-1 h-6 w-6 fill-current" />
            </div>
          </div>

          {duration && (
            <span className="absolute right-3 top-3 rounded-md bg-black/75 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {duration}
            </span>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
            <div className="pointer-events-auto text-left">
              <p className="line-clamp-2 text-lg font-bold text-white drop-shadow md:text-xl">
                {item.title}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-start gap-3">
                <span
                  className="
                    inline-flex items-center gap-2
                    rounded border border-orange-400
                    px-4 py-2 text-sm
                    font-medium text-orange-400
                    transition
                    group-hover:border-orange-500
                    group-hover:text-orange-300
                  "
                >
                  <Play className="h-4 w-4 fill-current" />
                  Ver más
                </span>
              </div>
            </div>
          </div>
        </div>
      </a>
    </article>
  );
}

export default function SharedShowcaseCarousel({
  sourceId,
  shareToken,
}: Props) {
  const rowRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [items, setItems] =
    useState<ShowcaseItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadShowcase() {
      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams({
            sourceId,
            share: shareToken,
          });

        const response = await fetch(
          `/api/shared-showcase?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        const result =
          (await response
            .json()
            .catch(
              () => ({})
            )) as Partial<ShowcaseResponse> & {
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "No se pudieron cargar los proyectos."
          );
        }

        if (!active) {
          return;
        }

        setItems(
          Array.isArray(result.rows)
            ? result.rows
            : []
        );
      } catch (loadError: any) {
        if (!active) {
          return;
        }

        setItems([]);

        setError(
          loadError?.message ||
            "No se pudieron cargar los proyectos."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadShowcase();

    return () => {
      active = false;
    };
  }, [
    sourceId,
    shareToken,
  ]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.id !== sourceId
      ),
    [items, sourceId]
  );

  const scrollByAmount = (
    direction: "left" | "right"
  ) => {
    const element =
      rowRef.current;

    if (!element) {
      return;
    }

    const amount = Math.floor(
      element.clientWidth * 0.85
    );

    element.scrollBy({
      left:
        direction === "right"
          ? amount
          : -amount,
      behavior: "smooth",
    });
  };

  if (
    !loading &&
    !error &&
    visibleItems.length === 0
  ) {
    return null;
  }

  return (
    <section className="mt-12 w-full border-t border-zinc-800/80 pt-8">
      <div className="px-4 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
          Atomica Showcase
        </p>

        <h2 className="mt-1 text-2xl font-bold text-white md:text-3xl">
          Explora más proyectos
        </h2>

        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Una selección de trabajos representativos de Atomica que también puedes reproducir.
        </p>
      </div>

      {loading ? (
        <div className="flex gap-5 overflow-hidden px-12 pt-9 md:px-16">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="
                relative shrink-0
                w-[70vw] overflow-hidden
                rounded-2xl border
                border-zinc-800
                bg-zinc-900
                sm:w-[280px]
                md:w-[300px]
                lg:w-[320px]
                xl:w-[340px]
              "
            >
              <div className="aspect-video animate-pulse bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mx-4 mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 md:mx-6">
          {error}
        </div>
      ) : (
        <div className="group relative px-12 pt-9 md:px-16">
          {visibleItems.length > 1 && (
            <button
              type="button"
              onClick={() =>
                scrollByAmount(
                  "left"
                )
              }
              aria-label="Proyecto anterior"
              className="
                absolute left-0 top-1/2
                z-30 hidden h-14 w-10
                -translate-y-1/2
                place-items-center
                text-white/85
                transition hover:text-white
                md:grid
              "
            >
              <ChevronLeft className="h-11 w-11 stroke-[1.2]" />
            </button>
          )}

          <div
            ref={rowRef}
            className="
              overflow-x-auto
              scroll-smooth
              [scrollbar-width:none]
              [&::-webkit-scrollbar]:hidden
            "
          >
            <div className="flex gap-5 pb-8">
              {visibleItems.map(
                (item) => (
                  <div
                    key={item.id}
                    className="
                      relative shrink-0
                      w-[70vw]
                      sm:w-[280px]
                      md:w-[300px]
                      lg:w-[320px]
                      xl:w-[340px]
                    "
                  >
                    <ShowcaseCard
                      item={item}
                    />
                  </div>
                )
              )}
            </div>
          </div>

          {visibleItems.length > 1 && (
            <button
              type="button"
              onClick={() =>
                scrollByAmount(
                  "right"
                )
              }
              aria-label="Proyecto siguiente"
              className="
                absolute right-0 top-1/2
                z-30 hidden h-14 w-10
                -translate-y-1/2
                place-items-center
                text-white/85
                transition hover:text-white
                md:grid
              "
            >
              <ChevronRight className="h-11 w-11 stroke-[1.2]" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}