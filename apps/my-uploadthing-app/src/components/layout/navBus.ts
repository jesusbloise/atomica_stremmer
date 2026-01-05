// Bus simple para comunicar Navbar -> pantallas (buscar, filtrar, seleccionar)
import type { FilterKey } from "@/components/UploadVideo/types";

type Handlers = {
  onSearch?: (q: string) => void;
  onFilter?: (key: FilterKey) => void;
  onToggleSelect?: () => void;
};

const listeners = new Set<Handlers>();

export function navSubscribe(h: Handlers): () => void {
  listeners.add(h);
  // 👇 el cleanup debe ser () => void (NO devolver boolean)
  return () => {
    listeners.delete(h);
  };
}

export function navEmitSearch(q: string) {
  for (const l of listeners) l.onSearch?.(q);
}

export function navEmitFilter(key: FilterKey) {
  for (const l of listeners) l.onFilter?.(key);
}

export function navEmitToggleSelect() {
  for (const l of listeners) l.onToggleSelect?.();
}
