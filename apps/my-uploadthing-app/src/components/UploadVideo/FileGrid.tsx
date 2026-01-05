// SUBCOMPONENTE: FileGrid
// Propósito: Grid responsivo que pinta FileCard por cada item.
// Props:
//  - items: VideoInfo[]
//  - selectionMode, selectedIds, onToggleSelect
//  - onDeleted: (id:string) => void
//  - makeHref: (id:string) => string

"use client";
import { useMemo } from "react";
import type { VideoInfo } from "./types";
import FileCard from "./FileCard";

function uniqBy<T, K>(arr: T[], keyFn: (t: T) => K) {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

export default function FileGrid({
  items,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onDeleted,
  makeHref,
}: {
  items: VideoInfo[];
  selectionMode: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  makeHref: (id: string) => string;
}) {
  const uniqueItems = useMemo(() => uniqBy(items, (i) => i.id), [items]);
  const isSelected = (id: string) => selectedIds.includes(id);

  return (
    <div className="px-2 sm:px-0">
      <div className="grid w-full max-w-screen-xl grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {uniqueItems.map((item) => (
          <FileCard
            key={item.id}
            item={item}
            selectionMode={selectionMode}
            selected={isSelected(item.id)}
            onToggleSelect={onToggleSelect}
            onDeleted={onDeleted}
            href={makeHref(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

