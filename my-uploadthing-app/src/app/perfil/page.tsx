"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";

/* ===== Tipos ===== */
type Participacion = {
  fecha: string;     // YYYY-MM-DD
  nombre: string;    // nombre del proyecto/actividad
  miniatura: string; // URL imagen miniatura
  ruta: string;      // ruta/URL al proyecto
};

interface PerfilData {
  nombre: string;
  email: string;
  generacion: string;
  facultad: string;
  descripcion: string;
  avatarUrl: string; // puede ser "", dataURL o URL remota
  instagram: string;
  facebook: string;
  whatsapp: string;
  participaciones: Participacion[];
}

/* ===== Utils ===== */
const emptyPerfil: PerfilData = {
  nombre: "",
  email: "",
  generacion: "",
  facultad: "",
  descripcion: "",
  avatarUrl: "",
  instagram: "",
  facebook: "",
  whatsapp: "",
  participaciones: [],
};

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
function isEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ===== Componente principal ===== */
export default function PerfilPage() {
  const [perfil, setPerfil] = useState<PerfilData>(deepClone(emptyPerfil));
  const [initialPerfil, setInitialPerfil] = useState<PerfilData>(deepClone(emptyPerfil)); // snapshot para detectar cambios
  const [loading, setLoading] = useState(true);    // cargando desde API
  const [saving, setSaving] = useState(false);     // guardando
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campos passwords (los conservamos, pero no los enviamos a menos que quieras)
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const dirty = useMemo(() => !isEqual(perfil, initialPerfil), [perfil, initialPerfil]);

  /* ==== Cargar perfil al montar ==== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const meRes = await fetch("/api/me", { cache: "no-store" });
        if (!meRes.ok) return;
        const me = await meRes.json();
        if (!me?.id) return;

        const detRes = await fetch(`/api/perfiles/${me.id}`, { cache: "no-store" });
        if (!detRes.ok) return;
        const det = await detRes.json();

        // normaliza participaciones a array
        const participaciones: Participacion[] = Array.isArray(det.participaciones) ? det.participaciones : [];

        const loaded: PerfilData = {
          nombre: det.name || "",
          email: det.email || "",
          generacion: det.generacion || "",
          facultad: det.facultad || "",
          descripcion: det.descripcion || "",
          avatarUrl: det.avatar_url || "",
          instagram: det.instagram || "",
          facebook: det.facebook || "",
          whatsapp: det.whatsapp || "",
          participaciones,
        };

        if (!alive) return;
        setPerfil(loaded);
        setInitialPerfil(deepClone(loaded));
      } catch (e) {
        console.error("Error cargando perfil:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ==== Protección: advertir al salir con cambios sin guardar ==== */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = ""; // requerido por algunos navegadores
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* ==== Handlers ==== */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setPerfil((prev) => ({ ...prev, [name]: value }));
  };

  // Previsualización inmediata de avatar
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPerfil((prev) => ({ ...prev, avatarUrl: (reader.result as string) || "" }));
    };
    reader.readAsDataURL(file);
  };

  // Participaciones
  const addParticipacion = () => {
    setPerfil((prev) => ({
      ...prev,
      participaciones: [
        ...prev.participaciones,
        { fecha: "", nombre: "", miniatura: "", ruta: "" },
      ],
    }));
  };
  const removeParticipacion = (idx: number) => {
    setPerfil((prev) => ({
      ...prev,
      participaciones: prev.participaciones.filter((_, i) => i !== idx),
    }));
  };
  const updateParticipacion = (idx: number, field: keyof Participacion, value: string) => {
    setPerfil((prev) => {
      const next = [...prev.participaciones];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, participaciones: next };
    });
  };

  // Guardar
  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("nombre", perfil.nombre || "");
      formData.append("email", perfil.email || "");
      formData.append("generacion", perfil.generacion || "");
      formData.append("facultad", perfil.facultad || "");
      formData.append("descripcion", perfil.descripcion || "");
      formData.append("instagram", perfil.instagram || "");
      formData.append("facebook", perfil.facebook || "");
      formData.append("whatsapp", perfil.whatsapp || "");
      formData.append("participaciones", JSON.stringify(perfil.participaciones || []));

      if (fileInputRef.current?.files?.[0]) {
        formData.append("avatar", fileInputRef.current.files[0]);
      } else if (perfil.avatarUrl && perfil.avatarUrl.startsWith("data:")) {
        formData.append("avatarDataUrl", perfil.avatarUrl);
      }

      // Opcional: si decides guardar password aquí:
      // formData.append("password", password);
      // formData.append("passwordConfirm", passwordConfirm);

      const res = await fetch("/api/perfil", { method: "PUT", body: formData });
      if (!res.ok) throw new Error("Error al guardar");

      // Tras guardar, refrescamos desde el backend para “ver lo que quedó”
      // ya hiciste el PUT /api/perfil arriba y validaste res.ok
const saved = await res.json(); // ← devuelve avatar_url si se subió

// 1) refresca quién soy
const me = await fetch("/api/me", { cache: "no-store" }).then(r => r.ok ? r.json() : null);

// 2) trae el detalle combinado (users + profiles)
let det: any = null;
if (me?.id) {
  det = await fetch(`/api/perfiles/${me.id}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
}

// 3) decide avatar final (preferimos el del PUT; si no, el del GET; si no, el que ya tenía el estado)
const rawAvatar =
  (saved?.avatar_url && String(saved.avatar_url)) ||
  (det?.avatar_url && String(det.avatar_url)) ||
  (perfil.avatarUrl || "");

// 4) cache-bust (por si el CDN/navegador retiene la versión anterior)
const avatarUrl = rawAvatar
  ? `${rawAvatar}${rawAvatar.includes("?") ? "&" : "?"}v=${Date.now()}`
  : "";

// 5) arma el estado actualizado
const updated: PerfilData = {
  nombre: det?.name || perfil.nombre || "",
  email: det?.email || perfil.email || "",
  generacion: det?.generacion || "",
  facultad: det?.facultad || "",
  descripcion: det?.descripcion || "",
  avatarUrl, // 👈 ya con cache-bust
  instagram: det?.instagram || "",
  facebook: det?.facebook || "",
  whatsapp: det?.whatsapp || "",
  participaciones: Array.isArray(det?.participaciones) ? det.participaciones : (perfil.participaciones || []),
};

setPerfil(updated);
setInitialPerfil(deepClone(updated));

alert("Datos guardados ✅");

      // const me = await fetch("/api/me", { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      // if (me?.id) {
      //   const det = await fetch(`/api/perfiles/${me.id}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      //   if (det) {
      //     const updated: PerfilData = {
      //       nombre: det.name || "",
      //       email: det.email || "",
      //       generacion: det.generacion || "",
      //       facultad: det.facultad || "",
      //       descripcion: det.descripcion || "",
      //       avatarUrl: det.avatar_url || "",
      //       instagram: det.instagram || "",
      //       facebook: det.facebook || "",
      //       whatsapp: det.whatsapp || "",
      //       participaciones: Array.isArray(det.participaciones) ? det.participaciones : [],
      //     };
      //     setPerfil(updated);
      //     setInitialPerfil(deepClone(updated));
      //   }
      // }

      // alert("Datos guardados ✅");
    } catch (e) {
      console.error(e);
      alert("Hubo un problema ❌");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // limpia file input
    }
  };

  // Cancelar cambios
  const handleCancel = () => {
    setPerfil(deepClone(initialPerfil));
    setPassword("");
    setPasswordConfirm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <div className="w-full py-8 px-6">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">Mi Perfil</h1>

        {loading ? (
          <div className="text-zinc-400 text-center py-10">Cargando…</div>
        ) : (
          <div className="flex flex-col md:flex-row items-start gap-10">
            {/* Columna izquierda (avatar + redes) */}
            <div className="flex flex-col items-center w-full md:w-1/3">
              {/* Avatar: solo si hay valor; si no, slot */}
              <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-orange-500">
                {perfil.avatarUrl ? (
                  <Image
                    src={perfil.avatarUrl}
                    alt="Avatar"
                    fill
                    className="object-cover"
                    unoptimized={perfil.avatarUrl.startsWith("data:") || undefined}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 grid place-items-center text-xs text-zinc-400">
                    Sin foto
                  </div>
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-white"
              >
                Cambiar foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Redes sociales */}
              <div className="mt-6 w-full space-y-3">
                <input
                  type="text"
                  name="instagram"
                  value={perfil.instagram}
                  onChange={handleChange}
                  placeholder="Instagram (URL o usuario)"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
                <input
                  type="text"
                  name="facebook"
                  value={perfil.facebook}
                  onChange={handleChange}
                  placeholder="Facebook (URL o usuario)"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
                <input
                  type="text"
                  name="whatsapp"
                  value={perfil.whatsapp}
                  onChange={handleChange}
                  placeholder="WhatsApp (+569...)"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
              </div>
            </div>

            {/* Columna derecha (formulario) */}
            <div className="flex-1 bg-zinc-900 p-6 rounded-lg shadow-md border border-zinc-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold mb-4">Datos del Estudiante</h3>
                {/* Indicador de cambios */}
                {dirty ? (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    Cambios sin guardar
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Sin cambios
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  name="nombre"
                  value={perfil.nombre}
                  onChange={handleChange}
                  placeholder="Nombre"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
                <input
                  type="email"
                  name="email"
                  value={perfil.email}
                  onChange={handleChange}
                  placeholder="correo@dominio.com"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
                <input
                  type="text"
                  name="generacion"
                  value={perfil.generacion}
                  onChange={handleChange}
                  placeholder="Generación (ej: 2025)"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
                <input
                  type="text"
                  name="facultad"
                  value={perfil.facultad}
                  onChange={handleChange}
                  placeholder="Facultad"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />

                {/* Passwords (se mantienen, por si luego decides guardarlos) */}
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 md:col-span-1"
                />
                <input
                  type="password"
                  name="passwordConfirm"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Confirmación de Contraseña"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600 md:col-span-1"
                />
              </div>

              <div className="mt-3">
                <textarea
                  name="descripcion"
                  value={perfil.descripcion}
                  onChange={handleChange}
                  placeholder="Descripción"
                  rows={4}
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                />
              </div>

              {/* Participaciones */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Participaciones</h3>
                  <button
                    onClick={addParticipacion}
                    className="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-sm font-semibold text-white"
                  >
                    Añadir
                  </button>
                </div>

                {perfil.participaciones.length === 0 ? (
                  <p className="text-sm text-zinc-400 mt-3">
                    Aún no hay participaciones registradas.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {perfil.participaciones.map((p, idx) => (
                      <div key={idx} className="rounded-lg border border-zinc-700 p-4 bg-zinc-900/80">
                        <div className="grid gap-3 md:grid-cols-4">
                          <input
                            type="date"
                            value={p.fecha}
                            onChange={(e) => updateParticipacion(idx, "fecha", e.target.value)}
                            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                          />
                          <input
                            type="text"
                            value={p.nombre}
                            onChange={(e) => updateParticipacion(idx, "nombre", e.target.value)}
                            placeholder="Nombre del proyecto/actividad"
                            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                          />
                          <input
                            type="url"
                            value={p.miniatura}
                            onChange={(e) => updateParticipacion(idx, "miniatura", e.target.value)}
                            placeholder="URL miniatura"
                            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                          />
                          <input
                            type="text"
                            value={p.ruta}
                            onChange={(e) => updateParticipacion(idx, "ruta", e.target.value)}
                            placeholder="Ruta/URL al proyecto"
                            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
                          />
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="relative w-20 h-12 overflow-hidden rounded border border-zinc-700 bg-zinc-800">
                            {p.miniatura ? (
                              <Image
                                src={p.miniatura}
                                alt="Miniatura"
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full grid place-items-center text-xs text-zinc-400">
                                Sin imagen
                              </div>
                            )}
                          </div>
                          {p.ruta ? (
                            <a
                              href={p.ruta}
                              className="text-sm text-orange-400 hover:text-orange-500 underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir proyecto
                            </a>
                          ) : (
                            <span className="text-sm text-zinc-400">Sin ruta vinculada</span>
                          )}
                          <div className="ml-auto">
                            <button
                              onClick={() => removeParticipacion(idx)}
                              className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-white"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="mt-6 flex items-center gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  disabled={!dirty || saving}
                  className="px-4 py-2 rounded border border-zinc-600 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 rounded-md font-semibold disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar datos"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}


// "use client";

// import { useEffect, useRef, useState } from "react";
// import Image from "next/image";
// import AppShell from "@/components/layout/AppShell";
// import Navbar from "@/components/layout/Navbar";
// import Sidebar from "@/components/layout/Sidebar";
// import Footer from "@/components/layout/Footer";

// interface PerfilData {
//   nombre: string;
//   email: string;
//   direccion?: string;
//   profesion?: string;
//   trabajo?: string;
//   descripcion?: string;
//   avatarUrl?: string;
//   instagram?: string;
//   facebook?: string;
//   whatsapp?: string;
// }

// export default function PerfilPage() {
//   const [perfil, setPerfil] = useState<PerfilData>({
//     nombre: "",
//     email: "",
//     direccion: "",
//     profesion: "",
//     trabajo: "",
//     descripcion: "",
//     avatarUrl: "/default-avatar.png",
//     instagram: "",
//     facebook: "",
//     whatsapp: "",
//   });

//   const [loading, setLoading] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // 🔹 Cargar datos del usuario
//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch("/api/me", { cache: "no-store" });
//         if (res.ok) {
//           const user = await res.json();
//           setPerfil((prev) => ({
//             ...prev,
//             nombre: user.name || "",
//             email: user.email || "",
//             direccion: user.direccion || "",
//             profesion: user.profesion || "",
//             trabajo: user.trabajo || "",
//             descripcion: user.descripcion || "",
//             avatarUrl: user.avatarUrl || "/default-avatar.png",
//             instagram: user.instagram || "",
//             facebook: user.facebook || "",
//             whatsapp: user.whatsapp || "",
//           }));
//         }
//       } catch (e) {
//         console.error("Error cargando perfil:", e);
//       }
//     })();
//   }, []);

//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
//   ) => {
//     const { name, value } = e.target;
//     setPerfil((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     // Previsualización inmediata
//     const reader = new FileReader();
//     reader.onloadend = () => {
//       setPerfil((prev) => ({ ...prev, avatarUrl: reader.result as string }));
//     };
//     reader.readAsDataURL(file);
//   };

//   const handleSave = async () => {
//     setLoading(true);
//     try {
//       const formData = new FormData();
//       Object.entries(perfil).forEach(([key, value]) => {
//         if (value) formData.append(key, value as string);
//       });

//       if (fileInputRef.current?.files?.[0]) {
//         formData.append("avatar", fileInputRef.current.files[0]);
//       }

//       const res = await fetch("/api/perfil", {
//         method: "PUT",
//         body: formData,
//       });

//       if (!res.ok) throw new Error("Error al guardar");
//       alert("Datos guardados ✅");
//     } catch {
//       alert("Hubo un problema ❌");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
//       <div className="w-full py-8 px-6">
//         {/* Título centrado */}
//         <h1 className="text-3xl font-bold text-white mb-8 text-center">
//           Mi Perfil
//         </h1>

//         <div className="flex flex-col md:flex-row items-start gap-10">
//           {/* Columna izquierda (foto + redes) */}
//           <div className="flex flex-col items-center w-full md:w-1/3">
//             {/* Avatar circular editable */}
//             <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-orange-500">
//               <Image
//                 src={perfil.avatarUrl || "/default-avatar.png"}
//                 alt="Avatar"
//                 fill
//                 className="object-cover"
//               />
//             </div>

//             {/* Botón para abrir file picker */}
//             <button
//               onClick={() => fileInputRef.current?.click()}
//               className="mt-3 px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-white"
//             >
//               Cambiar foto
//             </button>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept="image/*"
//               className="hidden"
//               onChange={handleFileChange}
//             />

//             {/* Redes sociales */}
//             <div className="mt-6 w-full space-y-3">
//               <input
//                 type="text"
//                 name="instagram"
//                 value={perfil.instagram}
//                 onChange={handleChange}
//                 placeholder="Instagram"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="text"
//                 name="facebook"
//                 value={perfil.facebook}
//                 onChange={handleChange}
//                 placeholder="Facebook"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="text"
//                 name="whatsapp"
//                 value={perfil.whatsapp}
//                 onChange={handleChange}
//                 placeholder="WhatsApp"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//             </div>
//           </div>

//           {/* Columna derecha (formulario de datos) */}
//           <div className="flex-1 bg-zinc-900 p-6 rounded-lg shadow-md border border-zinc-700">
//             <h3 className="text-xl font-bold mb-4">Datos Personales</h3>

//             <div className="grid gap-3">
//               <input
//                 type="text"
//                 name="nombre"
//                 value={perfil.nombre}
//                 onChange={handleChange}
//                 placeholder="Nombre..."
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="email"
//                 name="email"
//                 value={perfil.email}
//                 onChange={handleChange}
//                 placeholder="correo@dominio.com"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="password"
//                 name="password"
//                 placeholder="Contraseña"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="password"
//                 name="passwordConfirm"
//                 placeholder="Confirmación de Contraseña"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="text"
//                 name="direccion"
//                 value={perfil.direccion}
//                 onChange={handleChange}
//                 placeholder="Dirección"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="text"
//                 name="profesion"
//                 value={perfil.profesion}
//                 onChange={handleChange}
//                 placeholder="Profesión"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <input
//                 type="text"
//                 name="trabajo"
//                 value={perfil.trabajo}
//                 onChange={handleChange}
//                 placeholder="Dónde trabaja"
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//               <textarea
//                 name="descripcion"
//                 value={perfil.descripcion}
//                 onChange={handleChange}
//                 placeholder="Descripción"
//                 rows={4}
//                 className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-600"
//               />
//             </div>

//             <div className="mt-5 flex justify-end">
//               <button
//                 onClick={handleSave}
//                 disabled={loading}
//                 className="px-5 py-2 bg-orange-600 hover:bg-orange-700 rounded-md font-semibold disabled:opacity-50"
//               >
//                 {loading ? "Guardando..." : "Guardar datos"}
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </AppShell>
//   );
// }
