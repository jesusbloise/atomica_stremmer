"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import SocialLinks from "./SocialLinks";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode; // aquí insertamos <SidebarContent />
};

export default function SidebarDrawer({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside
        className="absolute left-0 top-0 h-full w-[84%] max-w-[320px] bg-zinc-950 border-r border-zinc-800 shadow-xl flex flex-col"
        role="dialog" aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="text-sm font-medium uppercase tracking-wide text-zinc-300">Menú</div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 hover:bg-zinc-800/60"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
     
        </div>
        <div className="p-3 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
