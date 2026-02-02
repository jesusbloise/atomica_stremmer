"use client";

import { useEffect, useState } from "react";

/* ====================== Tipos ====================== */
export type FichaTecnicaData = {
  // Título del archivo / pieza
  titulo?: string | null;

  // Publicidad
  marca?: string | null;
  agencia?: string | null;
  productora?: string | null;
  contacto?: string | null;

  oficina?: "Chile" | "Mexico" | null; // single
  tipo?: string[] | null; // multi

  // Entretenimiento
  estudio?: string | null;
  director?: string | null;
  productor?: string | null;

  // Otros
  produccion?: string | null;
  corporativo?: string | null;
  nuevosNegocios?: string | null;
};

type ProfileLite = {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  generacion?: string;
  facultad?: string;
};

type Participacion = { fecha?: string; nombre?: string; miniatura?: string; ruta?: string };

type ProfileFull = ProfileLite & {
  descripcion?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  participaciones?: Participacion[];
};

type SessionMe =
  | { id: string; name: string; role: "ADMIN" | "PROFESOR" | "ESTUDIANTE"; email?: string | null }
  | null;

const OFICINA_OPTIONS = ["Chile", "Mexico"] as const;
const TIPO_OPTIONS = ["Color", "3D", "IA", "Musica", "Sonido", "VFX", "Edicion"] as const;

/* ====================== Componente principal ====================== */
export default function FichaTecnica({
  uploadId,
  modal,
  title = "Ficha técnica",
}: {
  uploadId: string;
  modal?: { open: boolean; onClose: () => void; title?: string; side?: "right" | "center" };
  title?: string;
}) {
  const [data, setData] = useState<FichaTecnicaData>({});
  const [hasFicha, setHasFicha] = useState(false);
  const [loading, setLoading] = useState(true);

  // sesión para saber si es ADMIN
  const [me, setMe] = useState<SessionMe>(null);
  const isAdmin = me?.role === "ADMIN";

  // edición (solo admin)
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FichaTecnicaData>({});
  const [saving, setSaving] = useState(false);

  // overlay de perfil
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayState, setOverlayState] = useState<
    | { kind: "idle" }
    | { kind: "loading"; name: string }
    | { kind: "select"; name: string; options: ProfileLite[] }
    | { kind: "view"; user_id: string }
  >({ kind: "idle" });

  // cargar sesión
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        setMe(r.ok ? await r.json() : null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // cargar ficha
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;

        const f = j?.ficha;
        if (!f) {
          // Importante: aunque no exista ficha, mostramos las casillas vacías
          setHasFicha(false);
          setData({});
          if (editing) setForm({});
          return;
        }

        // Si tu API devuelve snake_case o un JSON ya limpio, esto igual funciona.
        // Intento primero camelCase, luego snake_case.
        const mapped: FichaTecnicaData = {
          titulo: f.titulo ?? null,

          marca: f.marca ?? null,
          agencia: f.agencia ?? null,
          productora: f.productora ?? null,
          contacto: f.contacto ?? null,

          oficina: (f.oficina ?? null) as any,
          tipo: Array.isArray(f.tipo) ? f.tipo : typeof f.tipo === "string" ? safeSplitTipo(f.tipo) : null,

          estudio: f.estudio ?? null,
          director: f.director ?? null,
          productor: f.productor ?? null,

          produccion: f.produccion ?? null,
          corporativo: f.corporativo ?? null,
          nuevosNegocios: f.nuevosNegocios ?? f.nuevos_negocios ?? null,
        };

        setHasFicha(true);
        setData(mapped);
        if (editing) setForm(mapped);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  // resolver nombre -> abrir overlay
  const openProfileByName = async (name: string) => {
    if (!name?.trim()) return;
    setOverlayOpen(true);
    setOverlayState({ kind: "loading", name });

    try {
      const res = await fetch(`/api/perfiles?search=${encodeURIComponent(name)}`, { cache: "no-store" });
      const rows: ProfileLite[] = (await res.json()) ?? [];
      if (rows.length === 0) {
        setOverlayOpen(false);
        setOverlayState({ kind: "idle" });
        return;
      }
      if (rows.length === 1) {
        setOverlayState({ kind: "view", user_id: rows[0].user_id });
        return;
      }
      setOverlayState({ kind: "select", name, options: rows.slice(0, 8) });
    } catch {
      setOverlayOpen(false);
      setOverlayState({ kind: "idle" });
    }
  };

  /* ====================== Helpers edición ====================== */
  const startEdit = () => {
    setForm(data ? { ...data } : {});
    setEditing(true);
  };

  const cancelEdit = () => {
    setForm(data ? { ...data } : {});
    setEditing(false);
  };

  const setField = (k: keyof FichaTecnicaData, v: any) => {
    setForm((prev) => ({ ...(prev ?? {}), [k]: v }));
  };

  const toggleTipo = (opt: (typeof TIPO_OPTIONS)[number]) => {
    setForm((prev) => {
      const cur = new Set(prev.tipo ?? []);
      if (cur.has(opt)) cur.delete(opt);
      else cur.add(opt);
      return { ...prev, tipo: Array.from(cur) };
    });
  };

  const toNullIfEmpty = (v: any) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    return v;
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        titulo: toNullIfEmpty(form.titulo),

        marca: toNullIfEmpty(form.marca),
        agencia: toNullIfEmpty(form.agencia),
        productora: toNullIfEmpty(form.productora),
        contacto: toNullIfEmpty(form.contacto),

        oficina: toNullIfEmpty(form.oficina),
        tipo: Array.isArray(form.tipo) ? form.tipo : null,

        estudio: toNullIfEmpty(form.estudio),
        director: toNullIfEmpty(form.director),
        productor: toNullIfEmpty(form.productor),

        produccion: toNullIfEmpty(form.produccion),
        corporativo: toNullIfEmpty(form.corporativo),
        nuevosNegocios: toNullIfEmpty(form.nuevosNegocios),
      };

      const res = await fetch(`/api/fichas/${uploadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Error al guardar ficha");
      }

      // refrescar
      const j = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      const f = j?.ficha;

      if (f) {
        const mapped: FichaTecnicaData = {
          titulo: f.titulo ?? null,

          marca: f.marca ?? null,
          agencia: f.agencia ?? null,
          productora: f.productora ?? null,
          contacto: f.contacto ?? null,

          oficina: (f.oficina ?? null) as any,
          tipo: Array.isArray(f.tipo) ? f.tipo : typeof f.tipo === "string" ? safeSplitTipo(f.tipo) : null,

          estudio: f.estudio ?? null,
          director: f.director ?? null,
          productor: f.productor ?? null,

          produccion: f.produccion ?? null,
          corporativo: f.corporativo ?? null,
          nuevosNegocios: f.nuevosNegocios ?? f.nuevos_negocios ?? null,
        };
        setHasFicha(true);
        setData(mapped);
      } else {
        // si no devolvió nada, igual mantenemos lo editado en pantalla
        setHasFicha(true);
        setData({ ...form });
      }

      setEditing(false);
      alert("Ficha guardada");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la ficha");
    } finally {
      setSaving(false);
    }
  };

  /* ====================== Header tarjeta ====================== */
  const header = (
    <div className="flex items-center justify-between mb-2">
      <div>
        <h2 className="text-xs font-semibold text-white">{title}</h2>
        <span className="text-[10px] text-zinc-400">Datos y clasificación</span>
      </div>

      {isAdmin && !loading && (
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={startEdit}
              className="px-3 py-1.5 rounded-md border border-orange-500/40 text-orange-400 hover:text-orange-500 text-xs"
              title="Editar ficha"
            >
              Editar
            </button>
          ) : (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 rounded-md border border-emerald-500/40 text-emerald-300 hover:text-emerald-400 text-xs disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="px-3 py-1.5 rounded-md border border-zinc-600 text-zinc-200 hover:text-white text-xs disabled:opacity-60"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  /* ====================== Vista lectura ====================== */
  const cardRead = (
    <div>
      {!hasFicha && (
        <div className="text-[12px] text-zinc-400 mb-3">
          No hay ficha guardada aún. Puedes completarla con el botón Editar.
        </div>
      )}

      <div className="space-y-4">
        <Section title="Publicidad">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
            <Item label="Título" value={data.titulo} />

            <Item label="Marca" value={data.marca} />
            <Item label="Agencia" value={data.agencia} />
            <Item label="Productora" value={data.productora} />
            <Item label="Contacto" value={data.contacto} />

            <Item label="Oficina" value={data.oficina ?? null} />
            <Item label="Tipo" value={formatTipo(data.tipo)} />
          </dl>
        </Section>

        <Section title="Entretenimiento">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
            <Item label="Estudio" value={data.estudio} />
            <RoleItem label="Director" name={data.director} onOpen={openProfileByName} />
            <RoleItem label="Productor" name={data.productor} onOpen={openProfileByName} />
          </dl>
        </Section>

        <Section title="Otros">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
            <Item label="Producción" value={data.produccion} />
            <Item label="Corporativo" value={data.corporativo} />
            <Item label="Nuevos Negocios" value={data.nuevosNegocios} />
          </dl>
        </Section>
      </div>
    </div>
  );

  /* ====================== Vista edición ====================== */
  const cardEdit = (
    <div className="space-y-4">
      <Section title="Publicidad">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <InputItem label="Título" value={form.titulo} onChange={(v) => setField("titulo", v)} />

          <InputItem label="Marca" value={form.marca} onChange={(v) => setField("marca", v)} />
          <InputItem label="Agencia" value={form.agencia} onChange={(v) => setField("agencia", v)} />
          <InputItem label="Productora" value={form.productora} onChange={(v) => setField("productora", v)} />
          <InputItem label="Contacto" value={form.contacto} onChange={(v) => setField("contacto", v)} />

          <SelectItem
            label="Oficina"
            value={form.oficina ?? ""}
            onChange={(v) => setField("oficina", v ? (v as any) : null)}
            options={[{ value: "", label: "Selecciona…" }, ...OFICINA_OPTIONS.map((o) => ({ value: o, label: o }))]}
          />

          <div className="flex flex-col sm:col-span-2">
            <dt className="text-zinc-500 text-[11px] mb-2">Tipo (puede ser una o varias)</dt>
            <dd>
              <div className="flex flex-wrap gap-2">
                {TIPO_OPTIONS.map((opt) => {
                  const active = (form.tipo ?? []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTipo(opt)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs border transition",
                        active
                          ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                          : "bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Seleccionado: <span className="text-zinc-200">{formatTipo(form.tipo)}</span>
              </div>
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Entretenimiento">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <InputItem label="Estudio" value={form.estudio} onChange={(v) => setField("estudio", v)} />
          <InputItem label="Director" value={form.director} onChange={(v) => setField("director", v)} />
          <InputItem label="Productor" value={form.productor} onChange={(v) => setField("productor", v)} />
        </dl>
      </Section>

      <Section title="Otros">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <InputItem label="Producción" value={form.produccion} onChange={(v) => setField("produccion", v)} />
          <InputItem label="Corporativo" value={form.corporativo} onChange={(v) => setField("corporativo", v)} />
          <InputItem label="Nuevos Negocios" value={form.nuevosNegocios} onChange={(v) => setField("nuevosNegocios", v)} />
        </dl>
      </Section>
    </div>
  );

  const card = (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow">
      {header}
      {loading ? (
        <div className="text-[12px] text-zinc-400 py-2">Cargando…</div>
      ) : editing ? (
        cardEdit
      ) : (
        cardRead
      )}
    </section>
  );

  /* ===== Overlay de Perfil ===== */
  const closeOverlay = () => {
    setOverlayOpen(false);
    setOverlayState({ kind: "idle" });
  };

  return (
    <>
      {!modal ? (
        card
      ) : !modal.open ? null : (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog" onClick={modal.onClose}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className={`${
              (modal.side ?? "right") === "center"
                ? "inset-0 max-w-2xl mx-auto my-8"
                : "absolute inset-x-0 md:inset-x-auto md:right-8 md:max-w-xl top-8 bottom-8"
            } overflow-auto p-4`}
          >
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white truncate">{modal.title || title}</h3>
                <button
                  className="text-zinc-400 hover:text-white text-xl leading-none px-2"
                  onClick={modal.onClose}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <div className="p-3">{card}</div>
            </div>
          </div>
        </div>
      )}

      {overlayOpen && (
        <ProfileOverlay state={overlayState} onClose={closeOverlay} onPick={(id) => setOverlayState({ kind: "view", user_id: id })} />
      )}
    </>
  );
}

/* ====================== Subcomponentes ====================== */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-950/30">
      <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd className="text-zinc-100 text-[13px]">{value && String(value).trim() ? value : "—"}</dd>
    </div>
  );
}

function InputItem({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value?: string | number | null;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd>
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-[13px]"
        />
      </dd>
    </div>
  );
}

function SelectItem({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-[13px]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-black">
              {o.label}
            </option>
          ))}
        </select>
      </dd>
    </div>
  );
}

function RoleItem({ label, name, onOpen }: { label: string; name?: string | null; onOpen: (name: string) => void }) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd className="text-zinc-100 text-[13px]">
        {name && String(name).trim() ? (
          <button
            type="button"
            onClick={() => onOpen(String(name))}
            className="text-orange-400 hover:text-orange-500 underline underline-offset-4 decoration-dotted"
            title={`Ver perfil de ${name}`}
          >
            {name}
          </button>
        ) : (
          "—"
        )}
      </dd>
    </div>
  );
}

/* ====================== Overlay de Perfil ====================== */
function ProfileOverlay({
  state,
  onClose,
  onPick,
}: {
  state:
    | { kind: "idle" }
    | { kind: "loading"; name: string }
    | { kind: "select"; name: string; options: ProfileLite[] }
    | { kind: "view"; user_id: string };
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  useEscapeToClose(onClose);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 top-8 mx-auto w-[min(96vw,860px)]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white">Perfil</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none px-2" aria-label="Cerrar">
              ×
            </button>
          </div>

          <div className="p-5">
            {state.kind === "loading" && <div className="text-zinc-400 text-sm">Buscando “{state.name}”…</div>}

            {state.kind === "select" && (
              <div>
                <p className="text-zinc-300 text-sm mb-3">
                  Varios perfiles coinciden con <span className="text-white font-semibold">“{state.name}”</span>. Elige uno:
                </p>
                <ul className="space-y-2">
                  {state.options.map((p) => (
                    <li key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800 bg-zinc-900">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
                        {p.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-[10px] text-zinc-400">—</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{p.name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{p.email}</p>
                      </div>
                      <button
                        onClick={() => onPick(p.user_id)}
                        className="ml-auto text-xs px-3 py-1.5 rounded border border-orange-500/40 text-orange-400 hover:text-orange-500"
                      >
                        Ver
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.kind === "view" && <ProfileDetail user_id={state.user_id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileDetail({ user_id }: { user_id: string }) {
  const [data, setData] = useState<ProfileFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/perfiles/${user_id}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const row = await res.json();
        if (!alive) return;
        if (!Array.isArray(row.participaciones)) row.participaciones = [];
        setData(row);
      } catch {
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user_id]);

  if (loading) return <div className="text-zinc-400 text-sm">Cargando perfil…</div>;
  if (!data) return <div className="text-zinc-400 text-sm">No se pudo cargar el perfil.</div>;

  return (
    <div className="text-white">
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
            {data.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-[10px] text-zinc-400">Sin foto</div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{data.name}</h2>
            <p className="text-xs text-zinc-400">{data.email}</p>
            <p className="text-xs text-zinc-500">
              {data.generacion ? `Generación ${data.generacion} · ` : ""}
              {data.facultad || ""}
            </p>
            {data.descripcion && <p className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">{data.descripcion}</p>}
            <div className="mt-3 flex gap-3 text-xs">
              {data.instagram && (
                <a className="text-orange-400 hover:text-orange-500 underline" href={data.instagram} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              )}
              {data.facebook && (
                <a className="text-orange-400 hover:text-orange-500 underline" href={data.facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              )}
              {data.whatsapp && (
                <a
                  className="text-orange-400 hover:text-orange-500 underline"
                  href={`https://wa.me/${String(data.whatsapp).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2">Participaciones</h3>
        {!data.participaciones?.length ? (
          <p className="text-zinc-400 text-sm">Sin participaciones registradas.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.participaciones.map((p: Participacion, i: number) => (
              <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex gap-3">
                  <div className="w-24 h-16 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
                    {p.miniatura ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.miniatura} alt={p.nombre || "miniatura"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[11px] text-zinc-400">Sin imagen</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.nombre || "—"}</p>
                    <p className="text-[11px] text-zinc-500">{p.fecha || "—"}</p>
                    {p.ruta ? (
                      <a className="text-[11px] text-orange-400 hover:text-orange-500 underline" href={p.ruta} target="_blank" rel="noreferrer">
                        Abrir proyecto
                      </a>
                    ) : (
                      <span className="text-[11px] text-zinc-500">Sin ruta</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ====================== Helpers ====================== */
function formatTipo(tipo?: string[] | null) {
  if (!tipo || !Array.isArray(tipo) || tipo.length === 0) return "—";
  return tipo.join(", ");
}

function safeSplitTipo(s: string) {
  // por si viene "Color, 3D, IA"
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}


// "use client";

// import { useEffect, useRef, useState } from "react";

// /* ===== Tipos ===== */
// export type FichaTecnicaData = {
//   titulo?: string;
//   director?: string;
//   productor?: string;
//   jefeProduccion?: string;
//   directorFotografia?: string;
//   sonido?: string;
//   direccionArte?: string;
//   asistenteDireccion?: string;
//   montaje?: string;
//   otroCargo?: string;
//   contactoPrincipal?: string;
//   correo?: string;
//   curso?: string;
//   profesor?: string;
//   anio?: string | number;
//   duracion?: string;
//   sinopsis?: string;
//   procesoAnterior?: string;
//   pendientes?: string;
//   visto?: boolean | "Sí" | "No";
//   reunion?: string;
//   formato?: string;
//   estado?: string;
//   deliveryEstimado?: string;
//   seleccion?: string;
//   link?: string;
//   foto?: string | null;
// };

// type ProfileLite = { user_id: string; name: string; email: string; avatar_url?: string | null; generacion?: string; facultad?: string };
// type Participacion = { fecha?: string; nombre?: string; miniatura?: string; ruta?: string };
// type ProfileFull = ProfileLite & {
//   descripcion?: string;
//   instagram?: string; facebook?: string; whatsapp?: string;
//   participaciones?: Participacion[];
// };

// type SessionMe = { id: string; name: string; role: "ADMIN" | "PROFESOR" | "ESTUDIANTE"; email?: string | null } | null;

// /* ===== Componente principal ===== */
// export default function FichaTecnica({
//   uploadId,
//   modal,
//   title = "Ficha técnica",
// }: {
//   uploadId: string;
//   modal?: { open: boolean; onClose: () => void; title?: string; side?: "right" | "center" };
//   title?: string;
// }) {
//   const [data, setData] = useState<FichaTecnicaData | null>(null);
//   const [loading, setLoading] = useState(true);

//   // ====== sesión para saber si es ADMIN
//   const [me, setMe] = useState<SessionMe>(null);
//   const isAdmin = me?.role === "ADMIN";

//   // ====== edición (solo admin)
//   const [editing, setEditing] = useState(false);
//   const [form, setForm] = useState<FichaTecnicaData | null>(null);
//   const [saving, setSaving] = useState(false);

//   // ====== Overlay de perfil (se mantiene tal cual)
//   const [overlayOpen, setOverlayOpen] = useState(false);
//   const [overlayState, setOverlayState] = useState<
//     | { kind: "idle" }
//     | { kind: "loading"; name: string }
//     | { kind: "select"; name: string; options: ProfileLite[] }
//     | { kind: "view"; user_id: string }
//   >({ kind: "idle" });

//   // Cargar sesión
//   useEffect(() => {
//     (async () => {
//       try {
//         const r = await fetch("/api/me", { cache: "no-store" });
//         setMe(r.ok ? await r.json() : null);
//       } catch {
//         setMe(null);
//       }
//     })();
//   }, []);

//   // Cargar ficha
//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       try {
//         setLoading(true);
//         const r = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" });
//         const j = await r.json();
//         if (!alive) return;
//         const f = j?.ficha;
//         if (!f) { setData(null); setForm(null); return; }
//         const mapped: FichaTecnicaData = {
//           titulo: f.titulo ?? null,
//           director: f.director ?? null,
//           productor: f.productor ?? null,
//           jefeProduccion: f.jefe_produccion ?? null,
//           directorFotografia: f.director_fotografia ?? null,
//           sonido: f.sonido ?? null,
//           direccionArte: f.direccion_arte ?? null,
//           asistenteDireccion: f.asistente_direccion ?? null,
//           montaje: f.montaje ?? null,
//           otroCargo: f.otro_cargo ?? null,
//           contactoPrincipal: f.contacto_principal ?? null,
//           correo: f.correo ?? null,
//           curso: f.curso ?? null,
//           profesor: f.profesor ?? null,
//           anio: f.anio ?? null,
//           duracion: f.duracion ?? null,
//           sinopsis: f.sinopsis ?? null,
//           procesoAnterior: f.proceso_anterior ?? null,
//           pendientes: f.pendientes ?? null,
//           visto: typeof f.visto === "boolean" ? f.visto : undefined,
//           reunion: f.reunion ?? null,
//           formato: f.formato ?? null,
//           estado: f.estado ?? null,
//           deliveryEstimado: f.delivery_estimado ?? null,
//           seleccion: f.seleccion ?? null,
//           link: f.link ?? null,
//           foto: f.foto ?? null,
//         };
//         setData(mapped);
//         if (editing) setForm(mapped);
//       } finally {
//         if (alive) setLoading(false);
//       }
//     })();
//     return () => { alive = false; };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [uploadId]);

//   // Resolver nombre → abrir overlay (se mantiene)
//   const openProfileByName = async (name: string) => {
//     if (!name?.trim()) return;
//     setOverlayOpen(true);
//     setOverlayState({ kind: "loading", name });

//     try {
//       const res = await fetch(`/api/perfiles?search=${encodeURIComponent(name)}`, { cache: "no-store" });
//       const rows: ProfileLite[] = (await res.json()) ?? [];
//       if (rows.length === 0) {
//         setOverlayOpen(false);
//         setOverlayState({ kind: "idle" });
//         return;
//       }
//       if (rows.length === 1) {
//         setOverlayState({ kind: "view", user_id: rows[0].user_id });
//         return;
//       }
//       setOverlayState({ kind: "select", name, options: rows.slice(0, 8) });
//     } catch {
//       setOverlayOpen(false);
//       setOverlayState({ kind: "idle" });
//     }
//   };

//   /* ===== helpers edición ===== */
//   const startEdit = () => {
//     setForm(data ? { ...data } : {});
//     setEditing(true);
//   };
//   const cancelEdit = () => {
//     setForm(data ? { ...data } : {});
//     setEditing(false);
//   };
//   const setField = (k: keyof FichaTecnicaData, v: any) => {
//     setForm((prev) => ({ ...(prev ?? {}), [k]: v }));
//   };
//   const toNullIfEmpty = (v: any) => {
//     if (v === undefined || v === null) return null;
//     if (typeof v === "string" && v.trim() === "") return null;
//     return v;
//   };
//   const save = async () => {
//     if (!form) return;
//     setSaving(true);
//     try {
//       // map camelCase -> snake_case, y strings vacíos -> null
//       const payload = {
//         titulo: toNullIfEmpty(form.titulo),
//         director: toNullIfEmpty(form.director),
//         productor: toNullIfEmpty(form.productor),
//         jefe_produccion: toNullIfEmpty(form.jefeProduccion),
//         director_fotografia: toNullIfEmpty(form.directorFotografia),
//         sonido: toNullIfEmpty(form.sonido),
//         direccion_arte: toNullIfEmpty(form.direccionArte),
//         asistente_direccion: toNullIfEmpty(form.asistenteDireccion),
//         montaje: toNullIfEmpty(form.montaje),
//         otro_cargo: toNullIfEmpty(form.otroCargo),
//         contacto_principal: toNullIfEmpty(form.contactoPrincipal),
//         correo: toNullIfEmpty(form.correo),
//         curso: toNullIfEmpty(form.curso),
//         profesor: toNullIfEmpty(form.profesor),
//         anio: form.anio === "" ? null : form.anio,
//         duracion: toNullIfEmpty(form.duracion),
//         sinopsis: toNullIfEmpty(form.sinopsis),
//         proceso_anterior: toNullIfEmpty(form.procesoAnterior),
//         pendientes: toNullIfEmpty(form.pendientes),
//         visto: typeof form.visto === "boolean" ? form.visto : null,
//         reunion: toNullIfEmpty(form.reunion),
//         formato: toNullIfEmpty(form.formato),
//         estado: toNullIfEmpty(form.estado),
//         delivery_estimado: toNullIfEmpty(form.deliveryEstimado),
//         seleccion: toNullIfEmpty(form.seleccion),
//         link: toNullIfEmpty(form.link),
//         foto: toNullIfEmpty(form.foto),
//       };

//       const res = await fetch(`/api/fichas/${uploadId}`, {
//         method: "PUT",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) {
//         const err = await res.json().catch(() => ({}));
//         throw new Error(err?.error || "Error al guardar ficha");
//       }

//       // refrescar datos
//       const j = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
//       const f = j?.ficha;
//       if (f) {
//         const mapped: FichaTecnicaData = {
//           titulo: f.titulo ?? null,
//           director: f.director ?? null,
//           productor: f.productor ?? null,
//           jefeProduccion: f.jefe_produccion ?? null,
//           directorFotografia: f.director_fotografia ?? null,
//           sonido: f.sonido ?? null,
//           direccionArte: f.direccion_arte ?? null,
//           asistenteDireccion: f.asistente_direccion ?? null,
//           montaje: f.montaje ?? null,
//           otroCargo: f.otro_cargo ?? null,
//           contactoPrincipal: f.contacto_principal ?? null,
//           correo: f.correo ?? null,
//           curso: f.curso ?? null,
//           profesor: f.profesor ?? null,
//           anio: f.anio ?? null,
//           duracion: f.duracion ?? null,
//           sinopsis: f.sinopsis ?? null,
//           procesoAnterior: f.proceso_anterior ?? null,
//           pendientes: f.pendientes ?? null,
//           visto: typeof f.visto === "boolean" ? f.visto : undefined,
//           reunion: f.reunion ?? null,
//           formato: f.formato ?? null,
//           estado: f.estado ?? null,
//           deliveryEstimado: f.delivery_estimado ?? null,
//           seleccion: f.seleccion ?? null,
//           link: f.link ?? null,
//           foto: f.foto ?? null,
//         };
//         setData(mapped);
//       }
//       setEditing(false);
//       alert("Ficha guardada ✅");
//     } catch (e) {
//       console.error(e);
//       alert("No se pudo guardar la ficha ❌");
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* ====== Tarjeta base con header ====== */
//   const header = (
//     <div className="flex items-center justify-between mb-2">
//       <div>
//         <h2 className="text-xs font-semibold text-white">{title}</h2>
//         <span className="text-[10px] text-zinc-400">Datos de producción</span>
//       </div>

//       {/* Botonera solo ADMIN */}
//       {isAdmin && !loading && (
//         <div className="flex items-center gap-2">
//           {!editing ? (
//             <button
//               onClick={startEdit}
//               className="px-3 py-1.5 rounded-md border border-orange-500/40 text-orange-400 hover:text-orange-500 text-xs"
//               title="Editar ficha"
//             >
//               Editar
//             </button>
//           ) : (
//             <>
//               <button
//                 onClick={save}
//                 disabled={saving}
//                 className="px-3 py-1.5 rounded-md border border-emerald-500/40 text-emerald-300 hover:text-emerald-400 text-xs disabled:opacity-60"
//               >
//                 {saving ? "Guardando…" : "Guardar"}
//               </button>
//               <button
//                 onClick={cancelEdit}
//                 disabled={saving}
//                 className="px-3 py-1.5 rounded-md border border-zinc-600 text-zinc-200 hover:text-white text-xs disabled:opacity-60"
//               >
//                 Cancelar
//               </button>
//             </>
//           )}
//         </div>
//       )}
//     </div>
//   );

//   /* ====== Vistas (lectura / edición) ====== */

//   const cardRead = (
//     <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
//       <Item label="Título" value={data?.titulo} />

//       {/* Roles → botón que abre overlay (SE MANTIENE) */}
//       <RoleItem label="Director" name={data?.director} onOpen={openProfileByName} />
//       <RoleItem label="Productor" name={data?.productor} onOpen={openProfileByName} />
//       <RoleItem label="Jefe de Producción" name={data?.jefeProduccion} onOpen={openProfileByName} />
//       <RoleItem label="Director de Fotografía" name={data?.directorFotografia} onOpen={openProfileByName} />
//       <RoleItem label="Sonido" name={data?.sonido} onOpen={openProfileByName} />
//       <RoleItem label="Dirección de Arte" name={data?.direccionArte} onOpen={openProfileByName} />
//       <RoleItem label="Asistente de Dirección" name={data?.asistenteDireccion} onOpen={openProfileByName} />
//       <RoleItem label="Montaje" name={data?.montaje} onOpen={openProfileByName} />
//       <RoleItem label="Profesor" name={data?.profesor} onOpen={openProfileByName} />

//       {/* Resto igual */}
//       <Item label="Otro cargo" value={data?.otroCargo} />
//       <Item label="Contacto Principal" value={data?.contactoPrincipal} />
//       <Item label="Correo" value={data?.correo} />
//       <Item label="Curso" value={data?.curso} />
//       <Item label="Año" value={String(data?.anio ?? "")} />
//       <Item label="Duración" value={data?.duracion} />

//       <ItemFull label="Sinopsis" value={data?.sinopsis} />
//       <ItemFull label="Proceso anterior" value={data?.procesoAnterior} />
//       <ItemFull label="Pendientes" value={data?.pendientes} />

//       <Pill label="Visto" value={typeof data?.visto === "boolean" ? (data?.visto ? "Sí" : "No") : "No"} color="emerald" />
//       <Pill label="Reunión" value={data?.reunion || "—"} color="sky" />

//       <Item label="Formato" value={data?.formato} />
//       <Pill label="Estado" value={data?.estado || "—"} color="amber" />

//       <Item label="Delivery Estimado" value={data?.deliveryEstimado} />
//       <Item label="Selección" value={data?.seleccion} />

//       <div className="flex flex-col sm:col-span-2">
//         <dt className="text-zinc-500 text-[11px]">Link</dt>
//         <dd>
//           <a
//             href={data?.link || "#"}
//             className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4 text-[12px]"
//           >
//             {data?.link || "—"}
//           </a>
//         </dd>
//       </div>

//       <div className="flex flex-col">
//         <dt className="text-zinc-500 text-[11px]">Foto</dt>
//         <dd>
//           {data?.foto ? (
//             // eslint-disable-next-line @next/next/no-img-element
//             <img
//               src={data.foto}
//               alt="Foto"
//               className="h-14 w-full object-cover border border-zinc-700 rounded-md"
//             />
//           ) : (
//             <div className="h-14 w-full bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center text-[10px] text-zinc-500">
//               Vista previa
//             </div>
//           )}
//         </dd>
//       </div>
//     </dl>
//   );

//   const cardEdit = (
//     <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
//       <InputItem label="Título" value={form?.titulo} onChange={(v) => setField("titulo", v)} />
//       <InputItem label="Director" value={form?.director} onChange={(v) => setField("director", v)} />
//       <InputItem label="Productor" value={form?.productor} onChange={(v) => setField("productor", v)} />
//       <InputItem label="Jefe de Producción" value={form?.jefeProduccion} onChange={(v) => setField("jefeProduccion", v)} />
//       <InputItem label="Director de Fotografía" value={form?.directorFotografia} onChange={(v) => setField("directorFotografia", v)} />
//       <InputItem label="Sonido" value={form?.sonido} onChange={(v) => setField("sonido", v)} />
//       <InputItem label="Dirección de Arte" value={form?.direccionArte} onChange={(v) => setField("direccionArte", v)} />
//       <InputItem label="Asistente de Dirección" value={form?.asistenteDireccion} onChange={(v) => setField("asistenteDireccion", v)} />
//       <InputItem label="Montaje" value={form?.montaje} onChange={(v) => setField("montaje", v)} />
//       <InputItem label="Otro cargo" value={form?.otroCargo} onChange={(v) => setField("otroCargo", v)} />
//       <InputItem label="Contacto Principal" value={form?.contactoPrincipal} onChange={(v) => setField("contactoPrincipal", v)} />
//       <InputItem label="Correo" value={form?.correo} onChange={(v) => setField("correo", v)} />
//       <InputItem label="Curso" value={form?.curso} onChange={(v) => setField("curso", v)} />
//       <InputItem label="Profesor" value={form?.profesor} onChange={(v) => setField("profesor", v)} />
//       <InputItem label="Año" value={String(form?.anio ?? "")} onChange={(v) => setField("anio", v)} type="number" />
//       <InputItem label="Duración" value={form?.duracion} onChange={(v) => setField("duracion", v)} />
//       <TextareaItem label="Sinopsis" value={form?.sinopsis} onChange={(v) => setField("sinopsis", v)} />
//       <TextareaItem label="Proceso anterior" value={form?.procesoAnterior} onChange={(v) => setField("procesoAnterior", v)} />
//       <TextareaItem label="Pendientes" value={form?.pendientes} onChange={(v) => setField("pendientes", v)} />
//       <ToggleItem label="Visto" checked={!!form?.visto} onChange={(v) => setField("visto", v)} />
//       <InputItem label="Reunión (ISO)" value={form?.reunion || ""} onChange={(v) => setField("reunion", v)} placeholder="2025-10-08T12:00:00Z" />
//       <InputItem label="Formato" value={form?.formato} onChange={(v) => setField("formato", v)} />
//       <InputItem label="Estado" value={form?.estado} onChange={(v) => setField("estado", v)} />
//       <InputItem label="Delivery Estimado" value={form?.deliveryEstimado} onChange={(v) => setField("deliveryEstimado", v)} />
//       <InputItem label="Selección" value={form?.seleccion} onChange={(v) => setField("seleccion", v)} />
//       <InputItem label="Link" value={form?.link} onChange={(v) => setField("link", v)} />
//       <InputItem label="Foto (URL)" value={form?.foto || ""} onChange={(v) => setField("foto", v)} />
//     </dl>
//   );

//   const card = (
//     <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow">
//       {header}
//       {loading ? (
//         <div className="text-[12px] text-zinc-400 py-2">Cargando…</div>
//       ) : !data ? (
//         <div className="text-[12px] text-zinc-400 py-2">Sin ficha aún.</div>
//       ) : editing ? (
//         cardEdit
//       ) : (
//         cardRead
//       )}
//     </section>
//   );

//   /* ===== Overlay de Perfil ===== */
//   const closeOverlay = () => {
//     setOverlayOpen(false);
//     setOverlayState({ kind: "idle" });
//   };

//   return (
//     <>
//       {/* Tarjeta normal o dentro de tu modal existente */}
//       {!modal ? card : !modal.open ? null : (
//         <div className="fixed inset-0 z-50" aria-modal="true" role="dialog" onClick={modal.onClose}>
//           <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
//           <div className={`${(modal.side ?? "right") === "center" ? "inset-0 max-w-2xl mx-auto my-8" : "absolute inset-x-0 md:inset-x-auto md:right-8 md:max-w-xl top-8 bottom-8"} overflow-auto p-4`}>
//             <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
//               <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
//                 <h3 className="text-sm font-semibold text-white truncate">
//                   {modal.title || title}
//                 </h3>
//                 <button className="text-zinc-400 hover:text-white text-xl leading-none px-2" onClick={modal.onClose} aria-label="Cerrar">×</button>
//               </div>
//               <div className="p-3">{card}</div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Overlay de perfil independiente (oscuro, centrado) */}
//       {overlayOpen && (
//         <ProfileOverlay state={overlayState} onClose={closeOverlay} onPick={(id) => setOverlayState({ kind: "view", user_id: id })} />
//       )}
//     </>
//   );
// }

// /* ===== Subcomponentes simples ===== */
// function Item({ label, value }: { label: string; value?: string | number | null }) {
//   return (
//     <div className="flex flex-col">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd className="text-zinc-100 text-[13px]">{value ?? "—"}</dd>
//     </div>
//   );
// }

// function ItemFull({ label, value }: { label: string; value?: string | null }) {
//   return (
//     <div className="flex flex-col sm:col-span-2">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd className="text-zinc-300 text-[12px] whitespace-pre-wrap">{value ?? "—"}</dd>
//     </div>
//   );
// }

// function Pill({ label, value, color }:{ label:string; value:string; color:"emerald"|"sky"|"amber"}) {
//   const cls = color === "emerald"
//     ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
//     : color === "sky"
//       ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
//       : "border-amber-500/30 bg-amber-500/10 text-amber-300";
//   return (
//     <div className="flex flex-col">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd>
//         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${cls}`}>
//           {value}
//         </span>
//       </dd>
//     </div>
//   );
// }

// /* ===== Inputs de edición ===== */
// function InputItem({ label, value, onChange, type="text", placeholder }:{
//   label:string; value?: string | number | null;
//   onChange: (v: string) => void; type?: string; placeholder?: string;
// }) {
//   return (
//     <div className="flex flex-col">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd>
//         <input
//           type={type}
//           value={value ?? ""}
//           onChange={(e) => onChange(e.target.value)}
//           placeholder={placeholder}
//           className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-[13px]"
//         />
//       </dd>
//     </div>
//   );
// }
// function TextareaItem({ label, value, onChange }:{
//   label:string; value?: string | null; onChange:(v:string)=>void;
// }) {
//   return (
//     <div className="flex flex-col sm:col-span-2">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd>
//         <textarea
//           value={value ?? ""}
//           onChange={(e) => onChange(e.target.value)}
//           rows={3}
//           className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-[13px]"
//         />
//       </dd>
//     </div>
//   );
// }
// function ToggleItem({ label, checked, onChange }:{
//   label:string; checked:boolean; onChange:(v:boolean)=>void;
// }) {
//   return (
//     <div className="flex items-center gap-2">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd>
//         <label className="inline-flex items-center gap-2">
//           <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
//           <span className="text-[12px] text-zinc-200">{checked ? "Sí" : "No"}</span>
//         </label>
//       </dd>
//     </div>
//   );
// }

// /* ===== Botón de rol → abre overlay (se mantiene) ===== */
// function RoleItem({ label, name, onOpen }:{ label:string; name?:string|null; onOpen:(name:string)=>void }) {
//   return (
//     <div className="flex flex-col">
//       <dt className="text-zinc-500 text-[11px]">{label}</dt>
//       <dd className="text-zinc-100 text-[13px]">
//         {name ? (
//           <button
//             type="button"
//             onClick={() => onOpen(name)}
//             className="text-orange-400 hover:text-orange-500 underline underline-offset-4 decoration-dotted"
//             title={`Ver perfil de ${name}`}
//           >
//             {name}
//           </button>
//         ) : "—"}
//       </dd>
//     </div>
//   );
// }

// /* ===== Overlay de Perfil (selector + vista) ===== */
// function ProfileOverlay({
//   state,
//   onClose,
//   onPick,
// }: {
//   state:
//     | { kind:"idle" }
//     | { kind:"loading"; name:string }
//     | { kind:"select"; name:string; options: ProfileLite[] }
//     | { kind:"view"; user_id:string };
//   onClose: () => void;
//   onPick: (id: string) => void;
// }) {
//   useEscapeToClose(onClose);

//   return (
//     <div className="fixed inset-0 z-[60]">
//       <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
//       <div className="absolute inset-x-0 top-8 mx-auto w-[min(96vw,860px)]">
//         <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl overflow-hidden">
//           <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
//             <h3 className="text-sm font-semibold text-white">Perfil</h3>
//             <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none px-2" aria-label="Cerrar">×</button>
//           </div>

//           {/* Contenido */}
//           <div className="p-5">
//             {state.kind === "loading" && (
//               <div className="text-zinc-400 text-sm">Buscando “{state.name}”…</div>
//             )}

//             {state.kind === "select" && (
//               <div>
//                 <p className="text-zinc-300 text-sm mb-3">
//                   Varios perfiles coinciden con <span className="text-white font-semibold">“{state.name}”</span>. Elige uno:
//                 </p>
//                 <ul className="space-y-2">
//                   {state.options.map((p) => (
//                     <li key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800 bg-zinc-900">
//                       <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
//                         {p.avatar_url ? (
//                           // eslint-disable-next-line @next/next/no-img-element
//                           <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
//                         ) : (
//                           <div className="w-full h-full grid place-items-center text-[10px] text-zinc-400">—</div>
//                         )}
//                       </div>
//                       <div className="min-w-0">
//                         <p className="text-white text-sm truncate">{p.name}</p>
//                         <p className="text-[11px] text-zinc-500 truncate">{p.email}</p>
//                       </div>
//                       <button
//                         onClick={() => onPick(p.user_id)}
//                         className="ml-auto text-xs px-3 py-1.5 rounded border border-orange-500/40 text-orange-400 hover:text-orange-500"
//                       >
//                         Ver
//                       </button>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             )}

//             {state.kind === "view" && (
//               <ProfileDetail user_id={state.user_id} />
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ===== Vista detallada del perfil (dentro del overlay) ===== */
// function ProfileDetail({ user_id }: { user_id: string }) {
//   const [data, setData] = useState<ProfileFull | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       try {
//         setLoading(true);
//         const res = await fetch(`/api/perfiles/${user_id}`, { cache: "no-store" });
//         if (!res.ok) throw new Error();
//         const row = await res.json();
//         if (!alive) return;
//         if (!Array.isArray(row.participaciones)) row.participaciones = [];
//         setData(row);
//       } catch {
//         setData(null);
//       } finally {
//         if (alive) setLoading(false);
//       }
//     })();
//     return () => { alive = false; };
//   }, [user_id]);

//   if (loading) return <div className="text-zinc-400 text-sm">Cargando perfil…</div>;
//   if (!data)   return <div className="text-zinc-400 text-sm">No se pudo cargar el perfil.</div>;

//   return (
//     <div className="text-white">
//       {/* Header lindo */}
//       <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-4">
//         <div className="flex items-start gap-4">
//           <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
//             {data.avatar_url ? (
//               // eslint-disable-next-line @next/next/no-img-element
//               <img src={data.avatar_url} alt={data.name} className="w-full h-full object-cover" />
//             ) : (
//               <div className="w-full h-full grid place-items-center text-[10px] text-zinc-400">Sin foto</div>
//             )}
//           </div>
//           <div className="min-w-0">
//             <h2 className="text-xl font-bold">{data.name}</h2>
//             <p className="text-xs text-zinc-400">{data.email}</p>
//             <p className="text-xs text-zinc-500">
//               {data.generacion ? `Generación ${data.generacion} · ` : ""}{data.facultad || ""}
//             </p>
//             {data.descripcion && (
//               <p className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">{data.descripcion}</p>
//             )}
//             <div className="mt-3 flex gap-3 text-xs">
//               {data.instagram && <a className="text-orange-400 hover:text-orange-500 underline" href={data.instagram} target="_blank">Instagram</a>}
//               {data.facebook  && <a className="text-orange-400 hover:text-orange-500 underline" href={data.facebook} target="_blank">Facebook</a>}
//               {data.whatsapp  && <a className="text-orange-400 hover:text-orange-500 underline" href={`https://wa.me/${String(data.whatsapp).replace(/\D/g,"")}`} target="_blank">WhatsApp</a>}
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Participaciones */}
//       <div className="mt-6">
//         <h3 className="text-sm font-semibold mb-2">Participaciones</h3>
//         {!data.participaciones?.length ? (
//           <p className="text-zinc-400 text-sm">Sin participaciones registradas.</p>
//         ) : (
//           <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
//             {data.participaciones.map((p: Participacion, i: number) => (
//               <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
//                 <div className="flex gap-3">
//                   <div className="w-24 h-16 rounded overflow-hidden bg-zinc-800 border border-zinc-700">
//                     {p.miniatura ? (
//                       // eslint-disable-next-line @next/next/no-img-element
//                       <img src={p.miniatura} alt={p.nombre || "miniatura"} className="w-full h-full object-cover" />
//                     ) : (
//                       <div className="w-full h-full grid place-items-center text-[11px] text-zinc-400">Sin imagen</div>
//                     )}
//                   </div>
//                   <div className="min-w-0">
//                     <p className="font-semibold text-sm truncate">{p.nombre || "—"}</p>
//                     <p className="text-[11px] text-zinc-500">{p.fecha || "—"}</p>
//                     {p.ruta ? (
//                       <a className="text-[11px] text-orange-400 hover:text-orange-500 underline" href={p.ruta} target="_blank" rel="noreferrer">
//                         Abrir proyecto
//                       </a>
//                     ) : (
//                       <span className="text-[11px] text-zinc-500">Sin ruta</span>
//                     )}
//                   </div>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// }

// /* ===== Hook: cerrar con Escape ===== */
// function useEscapeToClose(onClose: () => void) {
//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [onClose]);
// }
