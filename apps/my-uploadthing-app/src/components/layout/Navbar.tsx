"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, ChevronDown } from "lucide-react";
import { navEmitFilter, navEmitSearch, navEmitToggleSelect } from "./navBus";
import type { FilterKey } from "@/components/UploadVideo/types";

type Me =
  | null
  | {
      id?: string; // ← necesitamos el id para pedir el perfil
      name: string;
      role: "ADMIN" | "PROFESOR" | "ESTUDIANTE";
      email?: string | null;
      avatarUrl?: string | null; // pudiera venir, pero preferimos profiles.avatar_url
    };

const tabs = [
  { id: "ultimos", label: "Últimos agregados" },
  { id: "mas-vistos", label: "Más vistos" },
];

/** Normaliza: quita espacios extremos, pasa a minúsculas y elimina acentos/diacríticos */
const DIAC = /[\u0300-\u036f]/g;
function normalizeQuery(s: string) {
  return s.normalize("NFD").replace(DIAC, "").toLowerCase().trim();
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // qVisible: lo que escribe el usuario (con mayúsculas/acentos)
  // qNorm: versión normalizada, la que usamos para buscar y poner en la URL
  const [qVisible, setQVisible] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const [session, setSession] = useState<Me>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("/next.svg"); // ← avatar real mostrado
  const isStudent = session?.role === "ESTUDIANTE";

  // cargar sesión + avatar de profiles (preferido)
  async function loadSessionAndAvatar() {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const s = await r.json();
      setSession(s ?? null);

      // Fallback provisional
      let fallback =
        s?.avatarUrl ??
        (s?.email || s?.name
          ? `https://i.pravatar.cc/64?u=${encodeURIComponent(s.email ?? s.name)}`
          : "/next.svg");

      if (s?.id) {
        const det = await fetch(`/api/perfiles/${s.id}`, { cache: "no-store" }).then(res => (res.ok ? res.json() : null));
        const raw = det?.avatar_url || fallback;
        const withBust = raw ? `${raw}${raw.includes("?") ? "&" : "?"}v=${Date.now()}` : "/next.svg";
        setAvatarUrl(withBust);
      } else {
        setAvatarUrl(fallback);
      }
    } catch {
      setSession(null);
      setAvatarUrl("/next.svg");
    }
  }

  // Carga inicial
  useEffect(() => {
    loadSessionAndAvatar();
  }, []);

  // Refrescar al volver a la pestaña / foco (por si se cambió el avatar en otra vista)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") loadSessionAndAvatar();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // (Opcional) Escucha evento disparado desde la página de perfil al guardar
  // window.dispatchEvent(new CustomEvent('profile:avatar-changed', { detail: urlFinal }))
  useEffect(() => {
    const onChanged = (e: any) => {
      const raw = String(e?.detail || "");
      if (!raw) return;
      const withBust = `${raw}${raw.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setAvatarUrl(withBust);
    };
    window.addEventListener("profile:avatar-changed" as any, onChanged);
    return () => window.removeEventListener("profile:avatar-changed" as any, onChanged);
  }, []);

  // si estamos en /explorar, toma q de la URL (ya normalizada) y aplica filtro también
  useEffect(() => {
    if (pathname !== "/explorar") return;
    const urlQ = searchParams.get("q") ?? "";
    setQVisible(urlQ);

    const f = (searchParams.get("filter") || "") as FilterKey | "";
    if (f === "con_subtitulos" || f === "sin_subtitulos" || f === "hoy" || f === "") {
      navEmitFilter((f || null) as FilterKey);
    }
  }, [pathname, searchParams]);

  // debounce SOLO en /explorar, emitiendo SIEMPRE la query normalizada
  const qNorm = useMemo(() => normalizeQuery(qVisible), [qVisible]);
  useEffect(() => {
    if (pathname !== "/explorar") return;
    const t = setTimeout(() => navEmitSearch(qNorm), 280);
    return () => clearTimeout(t);
  }, [qNorm, pathname]);

  // submit global: si no estamos en /explorar ⇒ navegar allí con q normalizada
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const termNorm = qNorm;
    if (!termNorm && pathname !== "/explorar") return;

    if (pathname !== "/explorar") {
      const p = new URLSearchParams();
      if (termNorm) p.set("q", termNorm); // guardamos normalizada
      router.push(`/explorar?${p.toString()}`);
    } else {
      navEmitSearch(termNorm);
      const p = new URLSearchParams(searchParams.toString());
      if (termNorm) p.set("q", termNorm);
      else p.delete("q");
      router.replace(`/explorar?${p.toString()}`);
    }
  }

  const applyFilter = (key: FilterKey) => {
    if (pathname !== "/explorar") {
      const p = new URLSearchParams();
      const termNorm = qNorm;
      if (termNorm) p.set("q", termNorm);
      if (key) p.set("filter", key);
      router.push(`/explorar?${p.toString()}`);
    } else {
      navEmitFilter(key);
      const p = new URLSearchParams(searchParams.toString());
      if (key) p.set("filter", key);
      else p.delete("filter");
      router.replace(`/explorar?${p.toString()}`);
    }
    setMenuOpen(false);
  };

  // --- Avatar dropdown: close on outside / esc
  const avatarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!avatarRef.current) return;
      if (!avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAvatarOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/80 backdrop-blur">
      <div className="w-full max-w-[1600px] mx-auto flex flex-wrap items-center gap-3 px-3 md:px-6 py-2.5">
        {/* Logo */}
        <Link href="/organizar" className="order-1 shrink-0">
          <Image
            src="/ATOMICA-Logo-02.png"
            alt="Falabella"
            width={280}
            height={56}
            className="h-12 w-auto md:h-8"
            priority
          />
        </Link>

        {/* Tabs */}
        <div className="order-3 sm:order-2 flex items-center gap-2 ml-3 overflow-x-auto whitespace-nowrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/?tab=${t.id}`)}
              className={`px-3 py-1.5 rounded-md border text-xs ${
                searchParams.get("tab") === t.id
                  ? "border-orange-500 text-orange-400 bg-zinc-800/60"
                  : "border-zinc-700 text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="order-4 sm:order-3 w-full sm:w-auto sm:flex-1 sm:min-w-[240px] sm:mx-2">
          <form className="relative" onSubmit={submitSearch}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={qVisible}
              onChange={(e) => setQVisible(e.target.value)}
              placeholder="Buscar archivos (insensible a mayúsculas y acentos)"
              className="w-full rounded-md bg-zinc-900/70 border border-zinc-700 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </form>
        </div>

        {/* Acciones */}
        <div className="order-3 sm:order-4 ml-auto flex items-center gap-2">
          {/* Filtros */}
          <div className="relative">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800/60"
              onClick={() => {
                setMenuOpen((v) => !v);
                setAvatarOpen(false);
              }}
            >
              <Filter className="h-4 w-4" />
              Filtros
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-700 bg-zinc-900 shadow-lg z-50">
                <button
                  onClick={() => applyFilter("con_subtitulos")}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  Con subtítulos
                </button>
                <button
                  onClick={() => applyFilter("sin_subtitulos")}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  Sin subtítulos
                </button>
                <button
                  onClick={() => applyFilter("hoy")}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  Subidos hoy
                </button>
                <button
                  onClick={() => applyFilter(null)}
                  className="block w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-zinc-800"
                >
                  Resetear filtros
                </button>
              </div>
            )}
          </div>

          {/* Seleccionar (oculto a estudiante) */}
          {!isStudent && session && (
            <button
              onClick={() => navEmitToggleSelect()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800/60"
              aria-label="Seleccionar"
              title="Seleccionar"
            >
              Seleccionar
            </button>
          )}

          {/* Auth */}
          {!session && (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800/60"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-md border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800/60"
              >
                Registrarme
              </Link>
            </div>
          )}

          {/* Avatar */}
          {session && (
            <div className="relative" ref={avatarRef}>
              <button
                className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-zinc-800/60"
                onClick={() => {
                  setAvatarOpen((v) => !v);
                  setMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={avatarOpen}
              >
                <img
                  src={avatarUrl}
                  alt={session?.name ?? "Usuario"}
                  className="h-8 w-8 rounded-full border border-zinc-700 object-cover"
                />
                <ChevronDown className="h-4 w-4 text-zinc-300" />
              </button>

              {avatarOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-md border border-zinc-700 bg-zinc-900 shadow-lg z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-sm font-medium truncate">{session?.name}</p>
                    <p className="text-xs text-zinc-400">{session?.role}</p>
                  </div>
                  <Link
                    href="/perfil"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                    role="menuitem"
                    onClick={() => setAvatarOpen(false)}
                  >
                    Perfil
                  </Link>
                  <button
                    role="menuitem"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                    onClick={async () => {
                      setAvatarOpen(false);
                      await fetch("/api/logout", { method: "POST" });
                      location.reload();
                    }}
                  >
                    Salir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

