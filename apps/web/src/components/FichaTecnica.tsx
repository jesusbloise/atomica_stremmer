"use client";

import { useEffect, useRef, useState } from "react";

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
  otros?: string | null;
  duracion?: string | null;
  formato?: string | null;
  version?: string | null;
  fecha?: string | null;
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
  | {
    id: string;
    name: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USUARIO" | "PROFESOR" | "ESTUDIANTE";
    email?: string | null;
  }
  | null;

const OFICINA_OPTIONS = ["Chile", "Mexico"] as const;
const TIPO_OPTIONS = [
  "Color",
  "3D",
  "IA",
  "Musica",
  "Sonido",
  "VFX",
  "Edicion",
  "Motion",
  "Dailies",
  "Master & Deliveries",
] as const;

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

  // sesión para saber si puede editar
  const [me, setMe] = useState<SessionMe>(null);
  const canEdit =
    me?.role === "SUPER_ADMIN" ||
    me?.role === "ADMIN" ||
    me?.role === "PROFESOR";

  // edición
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FichaTecnicaData>({});
  const formRef = useRef<FichaTecnicaData>({});
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
          setHasFicha(false);
          setData({});
          if (editing) setForm({});
          return;
        }

        // Normalización defensiva (tipo siempre array)
        const mapped: FichaTecnicaData = {
          titulo: f.titulo ?? null,

          marca: f.marca ?? null,
          agencia: f.agencia ?? null,
          productora: f.productora ?? null,
          contacto: f.contacto ?? null,

          oficina: (f.oficina ?? null) as any,
          tipo: Array.isArray(f.tipo) ? f.tipo : typeof f.tipo === "string" ? safeSplitTipo(f.tipo) : [],

          estudio: f.estudio ?? null,
          director: f.director ?? null,
          productor: f.productor ?? null,

          produccion: f.produccion ?? null,
          corporativo: f.corporativo ?? null,
          nuevosNegocios: f.nuevosNegocios ?? f.nuevos_negocios ?? null,
          otros: f.otros ?? null,
duracion: f.duracion ?? null,
formato: f.formato ?? null,
version: f.version ?? null,
fecha: f.fecha ?? null,
        };

        setHasFicha(true);
        setData(mapped);
        if (editing) setForm({ ...mapped, tipo: Array.isArray(mapped.tipo) ? mapped.tipo : [] });
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
  const base = data ? { ...data } : {};
  const next = { ...base, tipo: Array.isArray(base.tipo) ? base.tipo : [] };
  formRef.current = next;
  setForm(next);
  setEditing(true);
};

  const cancelEdit = () => {
  const base = data ? { ...data } : {};
  const next = { ...base, tipo: Array.isArray(base.tipo) ? base.tipo : [] };
  formRef.current = next;
  setForm(next);
  setEditing(false);
};

  const setField = (k: keyof FichaTecnicaData, v: any) => {
  setForm((prev) => {
    const next = { ...(prev ?? {}), [k]: v };
    formRef.current = next;
    return next;
  });
};

const toggleTipo = (opt: (typeof TIPO_OPTIONS)[number]) => {
  setForm((prev) => {
    const cur = new Set(prev.tipo ?? []);
    if (cur.has(opt)) cur.delete(opt);
    else cur.add(opt);

    const next = { ...prev, tipo: Array.from(cur) };
    formRef.current = next;
    return next;
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

      const currentForm = formRef.current;

const payload = {
  titulo: toNullIfEmpty(currentForm.titulo),

  marca: toNullIfEmpty(currentForm.marca),
  agencia: toNullIfEmpty(currentForm.agencia),
  productora: toNullIfEmpty(currentForm.productora),
  contacto: toNullIfEmpty(currentForm.contacto),

  oficina: toNullIfEmpty(currentForm.oficina),
  tipo: Array.isArray(currentForm.tipo) ? currentForm.tipo : [],

  estudio: toNullIfEmpty(currentForm.estudio),
  director: toNullIfEmpty(currentForm.director),
  productor: toNullIfEmpty(currentForm.productor),

  produccion: toNullIfEmpty(currentForm.produccion),
  corporativo: toNullIfEmpty(currentForm.corporativo),
  nuevosNegocios: toNullIfEmpty(currentForm.nuevosNegocios),
  otros: toNullIfEmpty(currentForm.otros),
  duracion: toNullIfEmpty(currentForm.duracion),
  formato: toNullIfEmpty(currentForm.formato),
  version: toNullIfEmpty(currentForm.version),
  fecha: toNullIfEmpty(currentForm.fecha),
};

      const res = await fetch(`/api/fichas/${uploadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error || err?.message || `HTTP ${res.status}`;
        throw new Error(msg);
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
          tipo: Array.isArray(f.tipo) ? f.tipo : typeof f.tipo === "string" ? safeSplitTipo(f.tipo) : [],

          estudio: f.estudio ?? null,
          director: f.director ?? null,
          productor: f.productor ?? null,

          produccion: f.produccion ?? null,
          corporativo: f.corporativo ?? null,
          nuevosNegocios: f.nuevosNegocios ?? f.nuevos_negocios ?? null,
          otros: f.otros ?? null,
          duracion: f.duracion ?? null,
          formato: f.formato ?? null,
          version: f.version ?? null,
          fecha: f.fecha ?? null,
        };
        setHasFicha(true);
        setData(mapped);
      } else {
        setHasFicha(true);
        setData({ ...currentForm, tipo: Array.isArray(currentForm.tipo) ? currentForm.tipo : [] });
      }

      setEditing(false);
      alert("Ficha guardada");
    } catch (e: any) {
      console.error(e);
      alert(`No se pudo guardar la ficha: ${e?.message || "error"}`);
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

      {canEdit && !loading && (
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

      <Section title="Información del archivo">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <Item label="Título" value={data.titulo} />
          <Item label="Marca" value={data.marca} />
          <Item label="Agencia" value={data.agencia} />
          <Item label="Productora" value={data.productora} />
          <Item label="Contacto" value={data.contacto} />
          <Item label="Duración" value={data.duracion} />
<Item label="Formato" value={data.formato} />
<Item label="Versión" value={data.version} />
<Item label="Fecha" value={data.fecha} />

          <Item label="Producción" value={data.produccion} />
          <Item label="Corporativo" value={data.corporativo} />
          <Item label="Nuevos Negocios" value={data.nuevosNegocios} />

          <Item label="Oficina" value={data.oficina ?? null} />
          <Item label="Tipo" value={formatTipo(data.tipo)} />
        </dl>

        <div className="mt-3">
          <dt className="text-zinc-500 text-[11px]">Otros</dt>
          <dd className="text-zinc-100 text-[13px] whitespace-pre-wrap">
            {data.otros && String(data.otros).trim() ? data.otros : "—"}
          </dd>
        </div>
      </Section>
    </div>
  );

  /* ====================== Vista edición ====================== */
  const cardEdit = (
    <div className="space-y-4">
      <Section title="Información del archivo">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          <InputItem label="Título" value={form.titulo} onChange={(v) => setField("titulo", v)} />
          <InputItem label="Marca" value={form.marca} onChange={(v) => setField("marca", v)} />
          <InputItem label="Agencia" value={form.agencia} onChange={(v) => setField("agencia", v)} />
          <InputItem label="Productora" value={form.productora} onChange={(v) => setField("productora", v)} />
          <InputItem label="Contacto" value={form.contacto} onChange={(v) => setField("contacto", v)} />
          <InputItem label="Duración" value={form.duracion} onChange={(v) => setField("duracion", v)} placeholder="Ej: 00:30 / 1:20" />
<InputItem label="Formato" value={form.formato} onChange={(v) => setField("formato", v)} placeholder="Ej: 16:9 / 9:16 / 4:5" />
<InputItem label="Versión" value={form.version} onChange={(v) => setField("version", v)} placeholder="Ej: V1 / Final / Master" />
<InputItem label="Fecha" value={form.fecha} onChange={(v) => setField("fecha", v)} type="date" />

          <InputItem label="Producción" value={form.produccion} onChange={(v) => setField("produccion", v)} />
          <InputItem label="Corporativo" value={form.corporativo} onChange={(v) => setField("corporativo", v)} />
          <InputItem label="Nuevos Negocios" value={form.nuevosNegocios} onChange={(v) => setField("nuevosNegocios", v)} />

          <SelectItem
            label="Oficina"
            value={(form.oficina ?? "") as any}
            onChange={(v) => setField("oficina", v ? (v as any) : null)}
            options={[
              { value: "", label: "Selecciona…" },
              ...OFICINA_OPTIONS.map((o) => ({ value: o, label: o })),
            ]}
          />

          <div className="flex flex-col sm:col-span-2">
            <dt className="text-zinc-500 text-[11px] mb-2">
              Tipo (puede ser una o varias)
            </dt>
            <dd>
              <div className="flex flex-wrap gap-2">
                {TIPO_OPTIONS.map((opt) => {
                  const active = ((form.tipo ?? []) as string[]).includes(opt);

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
                Seleccionado:{" "}
                <span className="text-zinc-200">{formatTipo(form.tipo)}</span>
              </div>
            </dd>
          </div>
        </dl>

        <div className="mt-3">
          <dt className="text-zinc-500 text-[11px]">Otros</dt>
          <dd>
            <textarea
              value={form.otros ?? ""}
              onChange={(e) => setField("otros", e.target.value)}
              rows={5}
              placeholder="Escribe una nota, descripción, comentario o información adicional..."
              className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-[13px] resize-y"
            />
          </dd>
        </div>
      </Section>
    </div>
  );

  const card = (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow">
      {header}
      {loading ? <div className="text-[12px] text-zinc-400 py-2">Cargando…</div> : editing ? cardEdit : cardRead}
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
            className={`${(modal.side ?? "right") === "center"
              ? "inset-0 max-w-2xl mx-auto my-8"
              : "absolute inset-x-0 md:inset-x-auto md:right-8 md:max-w-xl top-8 bottom-8"
              } overflow-auto p-4`}
          >
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white truncate">{modal.title || title}</h3>
                <button className="text-zinc-400 hover:text-white text-xl leading-none px-2" onClick={modal.onClose} aria-label="Cerrar">
                  ×
                </button>
              </div>
              <div className="p-3">{card}</div>
            </div>
          </div>
        </div>
      )}

      {overlayOpen && (
        <ProfileOverlay
          state={overlayState}
          onClose={closeOverlay}
          onPick={(id) => setOverlayState({ kind: "view", user_id: id })}
        />
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
