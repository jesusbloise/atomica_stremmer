"use client";

import { useEffect, useRef, useState } from "react";

/* ===== Tipos ===== */
export type FichaTecnicaData = {
  titulo?: string;
  director?: string;
  productor?: string;
  jefeProduccion?: string;
  directorFotografia?: string;
  sonido?: string;
  direccionArte?: string;
  asistenteDireccion?: string;
  montaje?: string;
  otroCargo?: string;
  contactoPrincipal?: string;
  correo?: string;
  curso?: string;
  profesor?: string;
  anio?: string | number;
  duracion?: string;
  sinopsis?: string;
  procesoAnterior?: string;
  pendientes?: string;
  visto?: boolean | "Sí" | "No";
  reunion?: string;
  formato?: string;
  estado?: string;
  deliveryEstimado?: string;
  seleccion?: string;
  link?: string;
  foto?: string | null;
};

type ProfileLite = { user_id: string; name: string; email: string; avatar_url?: string | null; generacion?: string; facultad?: string };
type Participacion = { fecha?: string; nombre?: string; miniatura?: string; ruta?: string };
type ProfileFull = ProfileLite & {
  descripcion?: string;
  instagram?: string; facebook?: string; whatsapp?: string;
  participaciones?: Participacion[];
};

type SessionMe = { id: string; name: string; role: "ADMIN" | "PROFESOR" | "ESTUDIANTE"; email?: string | null } | null;

/* ===== Componente principal ===== */
export default function FichaTecnica({
  uploadId,
  modal,
  title = "Ficha técnica",
}: {
  uploadId: string;
  modal?: { open: boolean; onClose: () => void; title?: string; side?: "right" | "center" };
  title?: string;
}) {
  const [data, setData] = useState<FichaTecnicaData | null>(null);
  const [loading, setLoading] = useState(true);

  // ====== sesión para saber si es ADMIN
  const [me, setMe] = useState<SessionMe>(null);
  const isAdmin = me?.role === "ADMIN";

  // ====== edición (solo admin)
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FichaTecnicaData | null>(null);
  const [saving, setSaving] = useState(false);

  // ====== Overlay de perfil (se mantiene tal cual)
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayState, setOverlayState] = useState<
    | { kind: "idle" }
    | { kind: "loading"; name: string }
    | { kind: "select"; name: string; options: ProfileLite[] }
    | { kind: "view"; user_id: string }
  >({ kind: "idle" });

  // Cargar sesión
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

  // Cargar ficha
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        const f = j?.ficha;
        if (!f) { setData(null); setForm(null); return; }
        const mapped: FichaTecnicaData = {
          titulo: f.titulo ?? null,
          director: f.director ?? null,
          productor: f.productor ?? null,
          jefeProduccion: f.jefe_produccion ?? null,
          directorFotografia: f.director_fotografia ?? null,
          sonido: f.sonido ?? null,
          direccionArte: f.direccion_arte ?? null,
          asistenteDireccion: f.asistente_direccion ?? null,
          montaje: f.montaje ?? null,
          otroCargo: f.otro_cargo ?? null,
          contactoPrincipal: f.contacto_principal ?? null,
          correo: f.correo ?? null,
          curso: f.curso ?? null,
          profesor: f.profesor ?? null,
          anio: f.anio ?? null,
          duracion: f.duracion ?? null,
          sinopsis: f.sinopsis ?? null,
          procesoAnterior: f.proceso_anterior ?? null,
          pendientes: f.pendientes ?? null,
          visto: typeof f.visto === "boolean" ? f.visto : undefined,
          reunion: f.reunion ?? null,
          formato: f.formato ?? null,
          estado: f.estado ?? null,
          deliveryEstimado: f.delivery_estimado ?? null,
          seleccion: f.seleccion ?? null,
          link: f.link ?? null,
          foto: f.foto ?? null,
        };
        setData(mapped);
        if (editing) setForm(mapped);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  // Resolver nombre → abrir overlay (se mantiene)
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

  /* ===== helpers edición ===== */
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
  const toNullIfEmpty = (v: any) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    return v;
  };
  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      // map camelCase -> snake_case, y strings vacíos -> null
      const payload = {
        titulo: toNullIfEmpty(form.titulo),
        director: toNullIfEmpty(form.director),
        productor: toNullIfEmpty(form.productor),
        jefe_produccion: toNullIfEmpty(form.jefeProduccion),
        director_fotografia: toNullIfEmpty(form.directorFotografia),
        sonido: toNullIfEmpty(form.sonido),
        direccion_arte: toNullIfEmpty(form.direccionArte),
        asistente_direccion: toNullIfEmpty(form.asistenteDireccion),
        montaje: toNullIfEmpty(form.montaje),
        otro_cargo: toNullIfEmpty(form.otroCargo),
        contacto_principal: toNullIfEmpty(form.contactoPrincipal),
        correo: toNullIfEmpty(form.correo),
        curso: toNullIfEmpty(form.curso),
        profesor: toNullIfEmpty(form.profesor),
        anio: form.anio === "" ? null : form.anio,
        duracion: toNullIfEmpty(form.duracion),
        sinopsis: toNullIfEmpty(form.sinopsis),
        proceso_anterior: toNullIfEmpty(form.procesoAnterior),
        pendientes: toNullIfEmpty(form.pendientes),
        visto: typeof form.visto === "boolean" ? form.visto : null,
        reunion: toNullIfEmpty(form.reunion),
        formato: toNullIfEmpty(form.formato),
        estado: toNullIfEmpty(form.estado),
        delivery_estimado: toNullIfEmpty(form.deliveryEstimado),
        seleccion: toNullIfEmpty(form.seleccion),
        link: toNullIfEmpty(form.link),
        foto: toNullIfEmpty(form.foto),
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

      // refrescar datos
      const j = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      const f = j?.ficha;
      if (f) {
        const mapped: FichaTecnicaData = {
          titulo: f.titulo ?? null,
          director: f.director ?? null,
          productor: f.productor ?? null,
          jefeProduccion: f.jefe_produccion ?? null,
          directorFotografia: f.director_fotografia ?? null,
          sonido: f.sonido ?? null,
          direccionArte: f.direccion_arte ?? null,
          asistenteDireccion: f.asistente_direccion ?? null,
          montaje: f.montaje ?? null,
          otroCargo: f.otro_cargo ?? null,
          contactoPrincipal: f.contacto_principal ?? null,
          correo: f.correo ?? null,
          curso: f.curso ?? null,
          profesor: f.profesor ?? null,
          anio: f.anio ?? null,
          duracion: f.duracion ?? null,
          sinopsis: f.sinopsis ?? null,
          procesoAnterior: f.proceso_anterior ?? null,
          pendientes: f.pendientes ?? null,
          visto: typeof f.visto === "boolean" ? f.visto : undefined,
          reunion: f.reunion ?? null,
          formato: f.formato ?? null,
          estado: f.estado ?? null,
          deliveryEstimado: f.delivery_estimado ?? null,
          seleccion: f.seleccion ?? null,
          link: f.link ?? null,
          foto: f.foto ?? null,
        };
        setData(mapped);
      }
      setEditing(false);
      alert("Ficha guardada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la ficha ❌");
    } finally {
      setSaving(false);
    }
  };

  /* ====== Tarjeta base con header ====== */
  const header = (
    <div className="flex items-center justify-between mb-2">
      <div>
        <h2 className="text-xs font-semibold text-white">{title}</h2>
        <span className="text-[10px] text-zinc-400">Datos de producción</span>
      </div>

      {/* Botonera solo ADMIN */}
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

  /* ====== Vistas (lectura / edición) ====== */

  const cardRead = (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
      <Item label="Título" value={data?.titulo} />

      {/* Roles → botón que abre overlay (SE MANTIENE) */}
      <RoleItem label="Director" name={data?.director} onOpen={openProfileByName} />
      <RoleItem label="Productor" name={data?.productor} onOpen={openProfileByName} />
      <RoleItem label="Jefe de Producción" name={data?.jefeProduccion} onOpen={openProfileByName} />
      <RoleItem label="Director de Fotografía" name={data?.directorFotografia} onOpen={openProfileByName} />
      <RoleItem label="Sonido" name={data?.sonido} onOpen={openProfileByName} />
      <RoleItem label="Dirección de Arte" name={data?.direccionArte} onOpen={openProfileByName} />
      <RoleItem label="Asistente de Dirección" name={data?.asistenteDireccion} onOpen={openProfileByName} />
      <RoleItem label="Montaje" name={data?.montaje} onOpen={openProfileByName} />
      <RoleItem label="Profesor" name={data?.profesor} onOpen={openProfileByName} />

      {/* Resto igual */}
      <Item label="Otro cargo" value={data?.otroCargo} />
      <Item label="Contacto Principal" value={data?.contactoPrincipal} />
      <Item label="Correo" value={data?.correo} />
      <Item label="Curso" value={data?.curso} />
      <Item label="Año" value={String(data?.anio ?? "")} />
      <Item label="Duración" value={data?.duracion} />

      <ItemFull label="Sinopsis" value={data?.sinopsis} />
      <ItemFull label="Proceso anterior" value={data?.procesoAnterior} />
      <ItemFull label="Pendientes" value={data?.pendientes} />

      <Pill label="Visto" value={typeof data?.visto === "boolean" ? (data?.visto ? "Sí" : "No") : "No"} color="emerald" />
      <Pill label="Reunión" value={data?.reunion || "—"} color="sky" />

      <Item label="Formato" value={data?.formato} />
      <Pill label="Estado" value={data?.estado || "—"} color="amber" />

      <Item label="Delivery Estimado" value={data?.deliveryEstimado} />
      <Item label="Selección" value={data?.seleccion} />

      <div className="flex flex-col sm:col-span-2">
        <dt className="text-zinc-500 text-[11px]">Link</dt>
        <dd>
          <a
            href={data?.link || "#"}
            className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4 text-[12px]"
          >
            {data?.link || "—"}
          </a>
        </dd>
      </div>

      <div className="flex flex-col">
        <dt className="text-zinc-500 text-[11px]">Foto</dt>
        <dd>
          {data?.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.foto}
              alt="Foto"
              className="h-14 w-full object-cover border border-zinc-700 rounded-md"
            />
          ) : (
            <div className="h-14 w-full bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center text-[10px] text-zinc-500">
              Vista previa
            </div>
          )}
        </dd>
      </div>
    </dl>
  );

  const cardEdit = (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
      <InputItem label="Título" value={form?.titulo} onChange={(v) => setField("titulo", v)} />
      <InputItem label="Director" value={form?.director} onChange={(v) => setField("director", v)} />
      <InputItem label="Productor" value={form?.productor} onChange={(v) => setField("productor", v)} />
      <InputItem label="Jefe de Producción" value={form?.jefeProduccion} onChange={(v) => setField("jefeProduccion", v)} />
      <InputItem label="Director de Fotografía" value={form?.directorFotografia} onChange={(v) => setField("directorFotografia", v)} />
      <InputItem label="Sonido" value={form?.sonido} onChange={(v) => setField("sonido", v)} />
      <InputItem label="Dirección de Arte" value={form?.direccionArte} onChange={(v) => setField("direccionArte", v)} />
      <InputItem label="Asistente de Dirección" value={form?.asistenteDireccion} onChange={(v) => setField("asistenteDireccion", v)} />
      <InputItem label="Montaje" value={form?.montaje} onChange={(v) => setField("montaje", v)} />
      <InputItem label="Otro cargo" value={form?.otroCargo} onChange={(v) => setField("otroCargo", v)} />
      <InputItem label="Contacto Principal" value={form?.contactoPrincipal} onChange={(v) => setField("contactoPrincipal", v)} />
      <InputItem label="Correo" value={form?.correo} onChange={(v) => setField("correo", v)} />
      <InputItem label="Curso" value={form?.curso} onChange={(v) => setField("curso", v)} />
      <InputItem label="Profesor" value={form?.profesor} onChange={(v) => setField("profesor", v)} />
      <InputItem label="Año" value={String(form?.anio ?? "")} onChange={(v) => setField("anio", v)} type="number" />
      <InputItem label="Duración" value={form?.duracion} onChange={(v) => setField("duracion", v)} />
      <TextareaItem label="Sinopsis" value={form?.sinopsis} onChange={(v) => setField("sinopsis", v)} />
      <TextareaItem label="Proceso anterior" value={form?.procesoAnterior} onChange={(v) => setField("procesoAnterior", v)} />
      <TextareaItem label="Pendientes" value={form?.pendientes} onChange={(v) => setField("pendientes", v)} />
      <ToggleItem label="Visto" checked={!!form?.visto} onChange={(v) => setField("visto", v)} />
      <InputItem label="Reunión (ISO)" value={form?.reunion || ""} onChange={(v) => setField("reunion", v)} placeholder="2025-10-08T12:00:00Z" />
      <InputItem label="Formato" value={form?.formato} onChange={(v) => setField("formato", v)} />
      <InputItem label="Estado" value={form?.estado} onChange={(v) => setField("estado", v)} />
      <InputItem label="Delivery Estimado" value={form?.deliveryEstimado} onChange={(v) => setField("deliveryEstimado", v)} />
      <InputItem label="Selección" value={form?.seleccion} onChange={(v) => setField("seleccion", v)} />
      <InputItem label="Link" value={form?.link} onChange={(v) => setField("link", v)} />
      <InputItem label="Foto (URL)" value={form?.foto || ""} onChange={(v) => setField("foto", v)} />
    </dl>
  );

  const card = (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow">
      {header}
      {loading ? (
        <div className="text-[12px] text-zinc-400 py-2">Cargando…</div>
      ) : !data ? (
        <div className="text-[12px] text-zinc-400 py-2">Sin ficha aún.</div>
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
      {/* Tarjeta normal o dentro de tu modal existente */}
      {!modal ? card : !modal.open ? null : (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog" onClick={modal.onClose}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className={`${(modal.side ?? "right") === "center" ? "inset-0 max-w-2xl mx-auto my-8" : "absolute inset-x-0 md:inset-x-auto md:right-8 md:max-w-xl top-8 bottom-8"} overflow-auto p-4`}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white truncate">
                  {modal.title || title}
                </h3>
                <button className="text-zinc-400 hover:text-white text-xl leading-none px-2" onClick={modal.onClose} aria-label="Cerrar">×</button>
              </div>
              <div className="p-3">{card}</div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de perfil independiente (oscuro, centrado) */}
      {overlayOpen && (
        <ProfileOverlay state={overlayState} onClose={closeOverlay} onPick={(id) => setOverlayState({ kind: "view", user_id: id })} />
      )}
    </>
  );
}

/* ===== Subcomponentes simples ===== */
function Item({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd className="text-zinc-100 text-[13px]">{value ?? "—"}</dd>
    </div>
  );
}

function ItemFull({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:col-span-2">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd className="text-zinc-300 text-[12px] whitespace-pre-wrap">{value ?? "—"}</dd>
    </div>
  );
}

function Pill({ label, value, color }:{ label:string; value:string; color:"emerald"|"sky"|"amber"}) {
  const cls = color === "emerald"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : color === "sky"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${cls}`}>
          {value}
        </span>
      </dd>
    </div>
  );
}

/* ===== Inputs de edición ===== */
function InputItem({ label, value, onChange, type="text", placeholder }:{
  label:string; value?: string | number | null;
  onChange: (v: string) => void; type?: string; placeholder?: string;
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
function TextareaItem({ label, value, onChange }:{
  label:string; value?: string | null; onChange:(v:string)=>void;
}) {
  return (
    <div className="flex flex-col sm:col-span-2">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd>
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-[13px]"
        />
      </dd>
    </div>
  );
}
function ToggleItem({ label, checked, onChange }:{
  label:string; checked:boolean; onChange:(v:boolean)=>void;
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
          <span className="text-[12px] text-zinc-200">{checked ? "Sí" : "No"}</span>
        </label>
      </dd>
    </div>
  );
}

/* ===== Botón de rol → abre overlay (se mantiene) ===== */
function RoleItem({ label, name, onOpen }:{ label:string; name?:string|null; onOpen:(name:string)=>void }) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-[11px]">{label}</dt>
      <dd className="text-zinc-100 text-[13px]">
        {name ? (
          <button
            type="button"
            onClick={() => onOpen(name)}
            className="text-orange-400 hover:text-orange-500 underline underline-offset-4 decoration-dotted"
            title={`Ver perfil de ${name}`}
          >
            {name}
          </button>
        ) : "—"}
      </dd>
    </div>
  );
}

/* ===== Overlay de Perfil (selector + vista) ===== */
function ProfileOverlay({
  state,
  onClose,
  onPick,
}: {
  state:
    | { kind:"idle" }
    | { kind:"loading"; name:string }
    | { kind:"select"; name:string; options: ProfileLite[] }
    | { kind:"view"; user_id:string };
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
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none px-2" aria-label="Cerrar">×</button>
          </div>

          {/* Contenido */}
          <div className="p-5">
            {state.kind === "loading" && (
              <div className="text-zinc-400 text-sm">Buscando “{state.name}”…</div>
            )}

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

            {state.kind === "view" && (
              <ProfileDetail user_id={state.user_id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Vista detallada del perfil (dentro del overlay) ===== */
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
    return () => { alive = false; };
  }, [user_id]);

  if (loading) return <div className="text-zinc-400 text-sm">Cargando perfil…</div>;
  if (!data)   return <div className="text-zinc-400 text-sm">No se pudo cargar el perfil.</div>;

  return (
    <div className="text-white">
      {/* Header lindo */}
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
              {data.generacion ? `Generación ${data.generacion} · ` : ""}{data.facultad || ""}
            </p>
            {data.descripcion && (
              <p className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">{data.descripcion}</p>
            )}
            <div className="mt-3 flex gap-3 text-xs">
              {data.instagram && <a className="text-orange-400 hover:text-orange-500 underline" href={data.instagram} target="_blank">Instagram</a>}
              {data.facebook  && <a className="text-orange-400 hover:text-orange-500 underline" href={data.facebook} target="_blank">Facebook</a>}
              {data.whatsapp  && <a className="text-orange-400 hover:text-orange-500 underline" href={`https://wa.me/${String(data.whatsapp).replace(/\D/g,"")}`} target="_blank">WhatsApp</a>}
            </div>
          </div>
        </div>
      </div>

      {/* Participaciones */}
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

/* ===== Hook: cerrar con Escape ===== */
function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// "use client";

// import { useEffect, useState } from "react";

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
//   reunion?: string;           // ISO string
//   formato?: string;
//   estado?: string;
//   deliveryEstimado?: string;
//   seleccion?: string;
//   link?: string;
//   foto?: string | null;
// };

// export default function FichaTecnica({
//   uploadId,              // ← pásame el id del upload
//   modal,                 // { open, onClose, title? } para render modal
//   title = "Ficha técnica"
// }: {
//   uploadId: string;
//   modal?: { open: boolean; onClose: () => void; title?: string; side?: "right" | "center" };
//   title?: string;
// }) {
//   const [data, setData] = useState<FichaTecnicaData | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       try {
//         setLoading(true);
//         const r = await fetch(`/api/fichas/${uploadId}`, { cache: "no-store" });
//         const j = await r.json();
//         if (!alive) return;
//         const f = j?.ficha;
//         if (!f) { setData(null); return; }
//         // map DB snake_case -> UI camelCase
//         setData({
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
//           foto: f.foto ?? null
//         });
//       } finally {
//         if (alive) setLoading(false);
//       }
//     })();
//     return () => { alive = false; };
//   }, [uploadId]);

//   const card = (
//     <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow">
//       <div className="flex items-center justify-between mb-2">
//         <h2 className="text-xs font-semibold text-white">{title}</h2>
//         <span className="text-[10px] text-zinc-400">Datos de producción</span>
//       </div>

//       {loading ? (
//         <div className="text-[12px] text-zinc-400 py-2">Cargando…</div>
//       ) : !data ? (
//         <div className="text-[12px] text-zinc-400 py-2">Sin ficha aún.</div>
//       ) : (
//         <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
//           <Item label="Título" value={data.titulo} />
//           <Item label="Director" value={data.director} />
//           <Item label="Productor" value={data.productor} />
//           <Item label="Jefe de Producción" value={data.jefeProduccion} />
//           <Item label="Director de Fotografía" value={data.directorFotografia} />
//           <Item label="Sonido" value={data.sonido} />
//           <Item label="Dirección de Arte" value={data.direccionArte} />
//           <Item label="Asistente de Dirección" value={data.asistenteDireccion} />
//           <Item label="Montaje" value={data.montaje} />
//           <Item label="Otro cargo" value={data.otroCargo} />
//           <Item label="Contacto Principal" value={data.contactoPrincipal} />
//           <Item label="Correo" value={data.correo} />
//           <Item label="Curso" value={data.curso} />
//           <Item label="Profesor" value={data.profesor} />
//           <Item label="Año" value={String(data.anio ?? "")} />
//           <Item label="Duración" value={data.duracion} />

//           <ItemFull label="Sinopsis" value={data.sinopsis} />
//           <ItemFull label="Proceso anterior" value={data.procesoAnterior} />
//           <ItemFull label="Pendientes" value={data.pendientes} />

//           <Pill label="Visto" value={typeof data.visto === "boolean" ? (data.visto ? "Sí" : "No") : "No"} color="emerald" />
//           <Pill label="Reunión" value={data.reunion || "—"} color="sky" />

//           <Item label="Formato" value={data.formato} />
//           <Pill label="Estado" value={data.estado || "—"} color="amber" />

//           <Item label="Delivery Estimado" value={data.deliveryEstimado} />
//           <Item label="Selección" value={data.seleccion} />

//           <div className="flex flex-col sm:col-span-2">
//             <dt className="text-zinc-500 text-[11px]">Link</dt>
//             <dd>
//               <a
//                 href={data.link || "#"}
//                 className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4 text-[12px]"
//               >
//                 {data.link || "—"}
//               </a>
//             </dd>
//           </div>

//           <div className="flex flex-col">
//             <dt className="text-zinc-500 text-[11px]">Foto</dt>
//             <dd>
//               {data.foto ? (
//                 <img
//                   src={data.foto}
//                   alt="Foto"
//                   className="h-14 w-full object-cover border border-zinc-700 rounded-md"
//                 />
//               ) : (
//                 <div className="h-14 w-full bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center text-[10px] text-zinc-500">
//                   Vista previa
//                 </div>
//               )}
//             </dd>
//           </div>
//         </dl>
//       )}
//     </section>
//   );

//   if (!modal) return card;
//   if (!modal.open) return null;

//   const side = modal.side ?? "right";
//   const pos =
//     side === "center"
//       ? "inset-0 max-w-2xl mx-auto my-8"
//       : "absolute inset-x-0 md:inset-x-auto md:right-8 md:max-w-xl top-8 bottom-8";

//   return (
//     <div
//       className="fixed inset-0 z-50"
//       aria-modal="true"
//       role="dialog"
//       onClick={modal.onClose}
//     >
//       <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
//       <div className={`${pos} overflow-auto p-4`}>
//         <div
//           className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl"
//           onClick={(e) => e.stopPropagation()}
//         >
//           <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
//             <h3 className="text-sm font-semibold text-white truncate">
//               {modal.title || title}
//             </h3>
//             <button
//               className="text-zinc-400 hover:text-white text-xl leading-none px-2"
//               onClick={modal.onClose}
//               aria-label="Cerrar"
//             >
//               ×
//             </button>
//           </div>
//           <div className="p-3">{card}</div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* Subcomponentes visuales */
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



// "use client";

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
//   foto?: string | null; // URL (opcional)
// };

// const defaultData: FichaTecnicaData = {
//   titulo: "Ciudad de Papel",
//   director: "A. Rivas",
//   productor: "L. Montoya",
//   jefeProduccion: "C. Duarte",
//   directorFotografia: "P. Medina",
//   sonido: "V. Pacheco",
//   direccionArte: "N. Campos",
//   asistenteDireccion: "S. Prieto",
//   montaje: "J. Serrano",
//   otroCargo: "Making Of: M. Vidal",
//   contactoPrincipal: "produccion@ejemplo.com",
//   correo: "contacto@film.cl",
//   curso: "Realización II",
//   profesor: "M. González",
//   anio: "2025",
//   duracion: "12 min",
//   sinopsis:
//     "En una ciudad donde todo se escribe y se borra, una mensajera descubre que su historia no está en los archivos, sino en la gente.",
//   procesoAnterior: "Edición offline al 80%, primer corte aprobado.",
//   pendientes: "Corrección de color, mezcla 5.1, gráficos finales.",
//   visto: true,
//   reunion: "27-09-2025 15:00",
//   formato: "4K DCI • 24 fps",
//   estado: "En post",
//   deliveryEstimado: "05-10-2025",
//   seleccion: "Preseleccionado",
//   link: "https://mi-link-de-visionado.com/ciudad-de-papel",
//   foto: null,
// };

// export default function FichaTecnica({ data }: { data?: FichaTecnicaData }) {
//   const d = { ...defaultData, ...(data || {}) };
//   const vistoText = typeof d.visto === "boolean" ? (d.visto ? "Sí" : "No") : (d.visto ?? "No");

//   return (
//     <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow">
//       <div className="flex items-center justify-between mb-2">
//         <h2 className="text-xs font-semibold text-white">Ficha técnica</h2>
//         <span className="text-[10px] text-zinc-400">Datos de producción</span>
//       </div>

//       <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
//         <Item label="Título" value={d.titulo} />
//         <Item label="Director" value={d.director} />
//         <Item label="Productor" value={d.productor} />
//         <Item label="Jefe de Producción" value={d.jefeProduccion} />
//         <Item label="Director de Fotografía" value={d.directorFotografia} />
//         <Item label="Sonido" value={d.sonido} />
//         <Item label="Dirección de Arte" value={d.direccionArte} />
//         <Item label="Asistente de Dirección" value={d.asistenteDireccion} />
//         <Item label="Montaje" value={d.montaje} />
//         <Item label="Otro cargo" value={d.otroCargo} />
//         <Item label="Contacto Principal" value={d.contactoPrincipal} />
//         <Item label="Correo" value={d.correo} />
//         <Item label="Curso" value={d.curso} />
//         <Item label="Profesor" value={d.profesor} />
//         <Item label="Año" value={String(d.anio ?? "")} />
//         <Item label="Duración" value={d.duracion} />

//         <ItemFull label="Sinopsis" value={d.sinopsis} />
//         <ItemFull label="Proceso anterior" value={d.procesoAnterior} />
//         <ItemFull label="Pendientes" value={d.pendientes} />

//         <div className="flex flex-col">
//           <dt className="text-zinc-500 text-[11px]">Visto</dt>
//           <dd>
//             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
//               {vistoText}
//             </span>
//           </dd>
//         </div>

//         <div className="flex flex-col">
//           <dt className="text-zinc-500 text-[11px]">Reunión</dt>
//           <dd>
//             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-sky-500/30 bg-sky-500/10 text-sky-300">
//               {d.reunion}
//             </span>
//           </dd>
//         </div>

//         <Item label="Formato" value={d.formato} />
//         <div className="flex flex-col">
//           <dt className="text-zinc-500 text-[11px]">Estado</dt>
//           <dd>
//             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-300">
//               {d.estado}
//             </span>
//           </dd>
//         </div>
//         <Item label="Delivery Estimado" value={d.deliveryEstimado} />
//         <Item label="Selección" value={d.seleccion} />

//         <div className="flex flex-col sm:col-span-2">
//           <dt className="text-zinc-500 text-[11px]">Link</dt>
//           <dd>
//             <a
//               href={d.link || "#"}
//               className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4 text-[12px]"
//             >
//               {d.link}
//             </a>
//           </dd>
//         </div>

//         <div className="flex flex-col">
//           <dt className="text-zinc-500 text-[11px]">Foto</dt>
//           <dd>
//             {d.foto ? (
//               <img
//                 src={d.foto}
//                 alt="Foto"
//                 className="h-14 w-full object-cover border border-zinc-700 rounded-md"
//               />
//             ) : (
//               <div className="h-14 w-full bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center text-[10px] text-zinc-500">
//                 Vista previa
//               </div>
//             )}
//           </dd>
//         </div>
//       </dl>
//     </section>
//   );
// }

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
//       <dd className="text-zinc-300 text-[12px]">{value ?? "—"}</dd>
//     </div>
//   );
// }
