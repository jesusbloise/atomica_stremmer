"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Menu as MenuIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Role = "ADMIN" | "PROFESOR" | "ESTUDIANTE" | null;

function Item({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block w-full text-left rounded-xl px-3 py-2 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50 text-sm"
    >
      {children}
    </Link>
  );
}

/** Exportado porque AppShell lo importa */
export function SidebarContent() {
  const [role, setRole] = useState<Role>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const s = await r.json();
        if (alive) setRole((s?.role as Role) ?? null);
      } catch {
        if (alive) setRole(null);
      } finally {
        if (alive) setLoadingRole(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const isStudent = role === "ESTUDIANTE";
  const isAdmin = role === "ADMIN";
  const canSeeExtra = !isStudent;

  return (
    <nav className="space-y-3">
      <Item href="/explorar">Todos los archivos</Item>
      <Item href="/organizar">Nuestra Facultad</Item>

      {!loadingRole && isAdmin && (
        <>
          <Item href="/subir">Subir archivos</Item>
          <Item href="/admin/usuarios">Gestionar usuarios</Item>
        </>
      )}

      {!loadingRole && canSeeExtra && (
        <>
          <div className="pt-4">
            <div className="text-xs uppercase text-zinc-400 px-1 mb-2">Usuarios</div>
            <div className="space-y-2">{/* extras */}</div>
          </div>

          <div className="pt-4">
            <div className="text-xs uppercase text-zinc-400 px-1 mb-2">Configuración</div>
            <div className="space-y-2">{/* extras */}</div>
          </div>
        </>
      )}
    </nav>
  );
}

/** Sidebar flotante superpuesto (sin huecos de layout) */
export default function Sidebar({ videoId }: { videoId?: string }) {
  const [open, setOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // ESC cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Polling subtítulos
  useEffect(() => {
    if (!videoId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/estado-subtitulos/${videoId}`);
        const data = await res.json();
        if (data.status === "procesando") setProcesando(true);
        else if (data.status === "completado") {
          setProcesando(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("❌ Error al consultar estado de subtítulos:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [videoId]);

  const variants = {
    hidden: { x: -24, opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: -24, opacity: 0 },
  };

  return (
    <>
      {/* Franja de hover SOLO en desktop (para no bloquear el borde en mobile) */}
      <div
        className="hidden md:block fixed inset-y-0 left-0 w-10 z-[49] pointer-events-auto"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      />

      {/* Panel superpuesto */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="panel"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={variants}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed top-4 left-4 z-[50] h-[calc(100vh-2rem)] w-[88vw] max-w-[320px] md:w-[280px] rounded-2xl border border-zinc-800/70 bg-zinc-950/80 backdrop-blur-md shadow-2xl p-4"
            role="dialog"
            aria-label="Menú lateral"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {/* Cerrar (necesario en mobile) */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full border p-1
                         border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-xs uppercase text-zinc-400 px-1 mb-2">Menú</div>
            <SidebarContent />

            {procesando && (
              <div className="mt-6 flex items-center text-xs text-zinc-400 animate-pulse gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                Procesando subtítulos...
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Botón flotante: SOLO cuando el menú está cerrado. Posición responsive */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="sidebar-flyout"
          aria-label="Abrir menú"
          className="fixed left-4 top-[104px] md:top-16 z-[50] inline-flex items-center justify-center rounded-full border p-2 text-sm font-medium
                     border-orange-400 text-orange-400 hover:border-orange-500 hover:text-orange-500
                     bg-black/40 backdrop-blur-md shadow-lg"
        >
          <MenuIcon className="h-4 w-4" />
          <span className="sr-only">Menú</span>
        </button>
      )}
    </>
  );
}


