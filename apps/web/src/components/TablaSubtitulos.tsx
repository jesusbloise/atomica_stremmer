"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Subtitulo = {
  id?: number;
  video_id?: string;
  time_start: number;
  time_end: number;
  text: string;
  [key: string]: any;
};

type Props = {
  data: Subtitulo[];
  searchTerm: string;
  matchIndices: number[];
  currentMatchIndex: number;
  setMatchIndices: (value: number[]) => void;
  setCurrentMatchIndex: (value: number) => void;
};

type CurrentUser = {
  id?: string | null;
  role?: string | null;
};

function pad2(value: number) {
  return String(Math.floor(value)).padStart(2, "0");
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const remainingSeconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(
      remainingSeconds
    )}`;
  }

  return `${minutes}:${pad2(
    remainingSeconds
  )}`;
}

function fixMojibake(text: string) {
  return text
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã±", "ñ")
    .replaceAll("Ã", "Á")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã", "Í")
    .replaceAll("Ã“", "Ó")
    .replaceAll("Ãš", "Ú")
    .replaceAll("Ã‘", "Ñ")
    .replaceAll("Â¡", "¡")
    .replaceAll("Â¿", "¿")
    .replaceAll("Â", "");
}

function escapeRegExp(value: string) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function highlightParts(
  text: string,
  queryValue: string
) {
  const query = queryValue.trim();

  if (!query) {
    return [
      {
        text,
        match: false,
      },
    ];
  }

  const expression = new RegExp(
    `(${escapeRegExp(query)})`,
    "ig"
  );

  const parts = text.split(expression);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match:
        part.toLowerCase() ===
        query.toLowerCase(),
    }));
}

function normalizeRows(rows: Subtitulo[]) {
  const seen = new Set<string>();

  return rows
    .map((row) => ({
      ...row,
      id:
        row.id !== undefined
          ? Number(row.id)
          : undefined,
      video_id: row.video_id
        ? String(row.video_id)
        : undefined,
      text: fixMojibake(
        String(row.text || "").trim()
      ),
      time_start:
        Number(row.time_start) || 0,
      time_end:
        Number(row.time_end) || 0,
    }))
    .filter((row) => {
      if (!row.text) {
        return false;
      }

      const key =
        row.id !== undefined
          ? `id-${row.id}`
          : `${row.time_start}-${row.time_end}-${row.text.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export default function TablaSubtitulos({
  data,
  searchTerm,
  matchIndices,
  currentMatchIndex,
  setMatchIndices,
  setCurrentMatchIndex,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const rowRefs = useRef<
    Record<number, HTMLDivElement | null>
  >({});

  const normalizedIncomingData =
    useMemo(
      () => normalizeRows(data || []),
      [data]
    );

  const [localRows, setLocalRows] =
    useState<Subtitulo[]>(
      normalizedIncomingData
    );

  const [canEdit, setCanEdit] =
    useState(false);

  const [editingSubtitleId, setEditingSubtitleId] =
    useState<number | null>(null);

  const [editingText, setEditingText] =
    useState("");

  const [savingSubtitleId, setSavingSubtitleId] =
    useState<number | null>(null);

  const [editingMessage, setEditingMessage] =
    useState("");

  useEffect(() => {
    setLocalRows(normalizedIncomingData);
  }, [normalizedIncomingData]);

  useEffect(() => {
    let alive = true;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (alive) {
            setCanEdit(false);
          }

          return;
        }

        const user =
          (await response.json()) as CurrentUser;

        const role = String(
          user?.role || ""
        )
          .trim()
          .toUpperCase();

        if (alive) {
          setCanEdit(
            role === "SUPER_ADMIN" ||
              role === "ADMIN"
          );
        }
      } catch {
        if (alive) {
          setCanEdit(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      alive = false;
    };
  }, []);

  const cleanData = localRows;

  const query = useMemo(
    () =>
      searchTerm.trim().toLowerCase(),
    [searchTerm]
  );

  useEffect(() => {
    if (!query) {
      if (matchIndices.length) {
        setMatchIndices([]);
      }

      return;
    }

    const indices: number[] = [];

    for (
      let index = 0;
      index < cleanData.length;
      index++
    ) {
      const text = String(
        cleanData[index]?.text || ""
      ).toLowerCase();

      if (text.includes(query)) {
        indices.push(index);
      }
    }

    const same =
      indices.length ===
        matchIndices.length &&
      indices.every(
        (value, index) =>
          value === matchIndices[index]
      );

    if (!same) {
      setMatchIndices(indices);
      setCurrentMatchIndex(0);
    }
  }, [
    query,
    cleanData,
    matchIndices,
    setMatchIndices,
    setCurrentMatchIndex,
  ]);

  const activeRowIndex = useMemo(() => {
    if (!matchIndices.length) {
      return null;
    }

    return (
      matchIndices[currentMatchIndex] ??
      matchIndices[0] ??
      null
    );
  }, [
    matchIndices,
    currentMatchIndex,
  ]);

  useEffect(() => {
    if (activeRowIndex == null) {
      return;
    }

    const element =
      rowRefs.current[activeRowIndex];

    const root = containerRef.current;

    if (!element || !root) {
      return;
    }

    const elementRect =
      element.getBoundingClientRect();

    const rootRect =
      root.getBoundingClientRect();

    const topVisible =
      elementRect.top >=
      rootRect.top + 12;

    const bottomVisible =
      elementRect.bottom <=
      rootRect.bottom - 12;

    if (!topVisible || !bottomVisible) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeRowIndex]);

  const handleClickRow = useCallback(
    (rowIndex: number) => {
      if (query) {
        const position =
          matchIndices.indexOf(rowIndex);

        if (position >= 0) {
          setCurrentMatchIndex(position);
          return;
        }

        setMatchIndices([rowIndex]);
        setCurrentMatchIndex(0);
        return;
      }

      setMatchIndices([rowIndex]);
      setCurrentMatchIndex(0);
    },
    [
      query,
      matchIndices,
      setCurrentMatchIndex,
      setMatchIndices,
    ]
  );

  const startEditing = (
    event: React.MouseEvent,
    row: Subtitulo
  ) => {
    event.stopPropagation();

    if (
      !canEdit ||
      !Number.isInteger(row.id)
    ) {
      return;
    }

    setEditingSubtitleId(
      Number(row.id)
    );

    setEditingText(
      String(row.text || "")
    );

    setEditingMessage("");
  };

  const cancelEditing = (
    event?: React.MouseEvent
  ) => {
    event?.stopPropagation();

    if (savingSubtitleId !== null) {
      return;
    }

    setEditingSubtitleId(null);
    setEditingText("");
    setEditingMessage("");
  };

  const saveSubtitle = async (
    event: React.MouseEvent,
    row: Subtitulo
  ) => {
    event.stopPropagation();

    const subtitleId = Number(row.id);

    const videoId = String(
      row.video_id || ""
    ).trim();

    const cleanText =
      editingText.trim();

    if (
      !Number.isInteger(subtitleId) ||
      subtitleId <= 0
    ) {
      setEditingMessage(
        "Esta línea no tiene un identificador válido."
      );
      return;
    }

    if (!videoId) {
      setEditingMessage(
        "No se pudo identificar el video."
      );
      return;
    }

    if (!cleanText) {
      setEditingMessage(
        "La línea no puede quedar vacía."
      );
      return;
    }

    try {
      setSavingSubtitleId(subtitleId);
      setEditingMessage("");

      const response = await fetch(
        `/api/subtitulos/${encodeURIComponent(
          videoId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            subtitleId,
            text: cleanText,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "No se pudo guardar la corrección"
        );
      }

      const updatedText = String(
        result?.subtitle?.text ||
          cleanText
      );

      setLocalRows((currentRows) =>
        currentRows.map(
          (currentRow) =>
            Number(currentRow.id) ===
            subtitleId
              ? {
                  ...currentRow,
                  text: updatedText,
                }
              : currentRow
        )
      );

      setEditingSubtitleId(null);
      setEditingText("");

      setEditingMessage(
        "Línea corregida correctamente."
      );

      window.setTimeout(() => {
        setEditingMessage("");
      }, 2500);
    } catch (error: any) {
      setEditingMessage(
        error?.message ||
          "No se pudo guardar la corrección."
      );
    } finally {
      setSavingSubtitleId(null);
    }
  };

  return (
    <div className="mb-10">
      <div className="border border-zinc-800/70 bg-black/20">
        <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              Transcripción
            </div>

            <div className="text-xs text-zinc-500">
              {cleanData.length} líneas
              {query
                ? ` · ${matchIndices.length} coincidencias`
                : ""}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-300">
                Edición habilitada
              </span>
            )}

            <div className="tabular-nums text-xs text-zinc-500">
              {query
                ? matchIndices.length
                  ? `${
                      currentMatchIndex + 1
                    }/${matchIndices.length}`
                  : "0/0"
                : ""}
            </div>
          </div>
        </div>

        {editingMessage && (
          <div className="border-b border-zinc-900 bg-orange-500/5 px-4 py-2 text-xs text-orange-300">
            {editingMessage}
          </div>
        )}

        <div
          ref={containerRef}
          className="max-h-[520px] overflow-auto"
        >
          {!cleanData.length ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              No hay transcripción disponible.
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {cleanData.map(
                (row, index) => {
                  const subtitleId =
                    Number(row.id);

                  const isEditing =
                    editingSubtitleId ===
                    subtitleId;

                  const isSaving =
                    savingSubtitleId ===
                    subtitleId;

                  const parts =
                    highlightParts(
                      row.text,
                      searchTerm
                    );

                  const isActive =
                    activeRowIndex === index;

                  const isMatch =
                    matchIndices.includes(
                      index
                    );

                  return (
                    <div
                      key={
                        Number.isInteger(
                          subtitleId
                        )
                          ? `subtitle-${subtitleId}`
                          : `${row.time_start}-${row.time_end}-${index}`
                      }
                      ref={(element) => {
                        rowRefs.current[
                          index
                        ] = element;
                      }}
                      onClick={() => {
                        if (!isEditing) {
                          handleClickRow(
                            index
                          );
                        }
                      }}
                      className={[
                        "group px-4 py-3 transition",
                        isEditing
                          ? "bg-zinc-950/70"
                          : "cursor-pointer hover:bg-zinc-950/40",
                        isActive &&
                        !isEditing
                          ? "bg-zinc-950/55"
                          : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-2 shrink-0">
                          <div
                            className={[
                              "h-4 w-[2px] rounded-full transition-opacity",
                              isEditing
                                ? "bg-orange-400 opacity-100"
                                : isActive
                                  ? "bg-yellow-400/80 opacity-100"
                                  : isMatch
                                    ? "bg-zinc-600/70 opacity-70 group-hover:opacity-90"
                                    : "bg-transparent opacity-0 group-hover:opacity-40",
                            ].join(" ")}
                          />
                        </div>

                        <div className="w-[70px] shrink-0 pt-1 text-xs tabular-nums text-zinc-500">
                          {formatTime(
                            row.time_start
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div
                              onClick={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
                            >
                              <textarea
                                value={
                                  editingText
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditingText(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                onKeyDown={(
                                  event
                                ) => {
                                  if (
                                    event.key ===
                                      "Escape" &&
                                    !isSaving
                                  ) {
                                    cancelEditing();
                                  }

                                  if (
                                    event.key ===
                                      "Enter" &&
                                    (event.ctrlKey ||
                                      event.metaKey)
                                  ) {
                                    event.preventDefault();

                                    void saveSubtitle(
                                      event as unknown as React.MouseEvent,
                                      row
                                    );
                                  }
                                }}
                                disabled={
                                  isSaving
                                }
                                rows={3}
                                autoFocus
                                className="w-full resize-y rounded-lg border border-orange-500/40 bg-zinc-900 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-orange-500 disabled:opacity-60"
                              />

                              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[11px] text-zinc-500">
                                  Ctrl + Enter
                                  guarda · Escape
                                  cancela
                                </p>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={
                                      cancelEditing
                                    }
                                    disabled={
                                      isSaving
                                    }
                                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
                                  >
                                    Cancelar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(
                                      event
                                    ) =>
                                      void saveSubtitle(
                                        event,
                                        row
                                      )
                                    }
                                    disabled={
                                      isSaving ||
                                      !editingText.trim()
                                    }
                                    className="rounded-lg border border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:opacity-50"
                                  >
                                    {isSaving
                                      ? "Guardando..."
                                      : "Guardar"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 text-sm leading-6 text-zinc-200">
                                {parts.map(
                                  (
                                    part,
                                    partIndex
                                  ) =>
                                    part.match ? (
                                      <mark
                                        key={`match-${index}-${partIndex}`}
                                        className="rounded bg-yellow-300/10 px-1 text-yellow-200"
                                      >
                                        {
                                          part.text
                                        }
                                      </mark>
                                    ) : (
                                      <span
                                        key={`text-${index}-${partIndex}`}
                                      >
                                        {
                                          part.text
                                        }
                                      </span>
                                    )
                                )}
                              </div>

                              {canEdit &&
                                Number.isInteger(
                                  subtitleId
                                ) && (
                                  <button
                                    type="button"
                                    onClick={(
                                      event
                                    ) =>
                                      startEditing(
                                        event,
                                        row
                                      )
                                    }
                                    className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 opacity-100 transition hover:border-orange-500/60 hover:text-orange-300 sm:opacity-0 sm:group-hover:opacity-100"
                                  >
                                    Editar
                                  </button>
                                )}
                            </div>
                          )}
                        </div>
                      </div>

                      {!isEditing && (
                        <div className="mt-1 pl-[82px] text-[11px] text-zinc-600 opacity-0 transition group-hover:opacity-100">
                          Click para saltar al tiempo
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {query && (
          <div className="border-t border-zinc-900 px-4 py-3 text-xs text-zinc-600">
            Enter avanza coincidencias ·
            Shift+Enter retrocede
          </div>
        )}
      </div>
    </div>
  );
}