"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Menu as MenuIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Role = "SUPER_ADMIN" | "ADMIN" | "USUARIO" | null;

type SidebarProps = {
  videoId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Item({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block w-full rounded-xl border border-zinc-700 px-3 py-2 text-left text-sm transition hover:border-zinc-500 hover:bg-zinc-900/50"
    >
      {children}
    </Link>
  );
}

export function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const [role, setRole] = useState<Role>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
        });

        const session = await response.json();

        if (alive) {
          setRole((session?.role as Role) ?? null);
        }
      } catch {
        if (alive) {
          setRole(null);
        }
      } finally {
        if (alive) {
          setLoadingRole(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN";
  const isUsuario = role === "USUARIO";

  const canUpload = isSuperAdmin || isAdmin;
  const canManageSystem = isSuperAdmin;

  return (
    <nav className="space-y-3">
      <Item href="/organizar" onClick={onNavigate}>
        Home
      </Item>

      <Item href="/explorar" onClick={onNavigate}>
        Todos los archivos
      </Item>

      {!loadingRole && canUpload && (
        <>
          <Item href="/subir" onClick={onNavigate}>
            Subir archivos
          </Item>

          <Item href="/admin/control-cargas" onClick={onNavigate}>
            Control de cargas
          </Item>
        </>
      )}

      {!loadingRole && canManageSystem && (
        <>
          <Item href="/admin/usuarios" onClick={onNavigate}>
            Gestionar usuarios
          </Item>

          <Item href="/admin/categorias" onClick={onNavigate}>
            Gestionar categorías
          </Item>
        </>
      )}

      {!loadingRole && !isUsuario && (
        <>
          <div className="pt-4">
            <div className="mb-2 px-1 text-xs uppercase text-zinc-400">
              Usuarios
            </div>

            <div className="space-y-2">{/* extras */}</div>
          </div>

          <div className="pt-4">
            <div className="mb-2 px-1 text-xs uppercase text-zinc-400">
              Configuración
            </div>

            <div className="space-y-2">{/* extras */}</div>
          </div>
        </>
      )}
    </nav>
  );
}

export default function Sidebar({
  videoId,
  open: controlledOpen,
  onOpenChange,
}: SidebarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isControlled, onOpenChange]);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/estado-subtitulos/${videoId}`
        );

        const data = await response.json();

        if (data.status === "procesando") {
          setProcesando(true);
        } else if (data.status === "completado") {
          setProcesando(false);
          window.clearInterval(interval);
        }
      } catch (error) {
        console.error(
          "❌ Error al consultar estado de subtítulos:",
          error
        );
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [videoId]);

  const variants = {
    hidden: {
      x: -24,
      opacity: 0,
    },
    visible: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: -24,
      opacity: 0,
    },
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            id="sidebar-flyout"
            key="panel"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={variants}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 24,
            }}
            className="
              fixed left-3 top-3 z-[60]
              h-[calc(100dvh-1.5rem)]
              w-[calc(100vw-1.5rem)]
              max-w-[320px]
              rounded-2xl
              border border-zinc-800/80
              bg-zinc-950/95
              p-4
              shadow-2xl
              backdrop-blur-xl
              md:left-4 md:top-4
              md:h-[calc(100dvh-2rem)]
              md:w-[280px]
            "
            role="dialog"
            aria-label="Menú lateral"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="
                absolute right-3 top-3
                inline-flex h-8 w-8
                items-center justify-center
                rounded-full
                border border-zinc-700
                text-zinc-300
                transition
                hover:border-orange-500
                hover:text-orange-400
              "
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-orange-400">
              Menú
            </div>

            <SidebarContent onNavigate={() => setOpen(false)} />

            {procesando && (
              <div className="mt-6 flex animate-pulse items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                Procesando subtítulos...
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

  {!open && (
  <button
    type="button"
    onClick={() => setOpen(true)}
    aria-expanded={open}
    aria-controls="sidebar-flyout"
    aria-label="Abrir menú"
    className="
      fixed top-[92px] z-[50]
      left-3
      sm:left-[max(12px,calc((100vw-1600px)/2+24px))]
      inline-flex items-center gap-2
      rounded-xl
      border border-orange-500/80
      bg-black/90
      px-3 py-2
      text-sm font-medium
      text-orange-400
      shadow-xl
      backdrop-blur-md
      transition-all duration-200
      hover:border-orange-400
      hover:bg-zinc-900
      hover:text-orange-300
    "
  >
    <MenuIcon className="h-4 w-4" />
    <span>Menú</span>
  </button>
)}
    </>
  );
}