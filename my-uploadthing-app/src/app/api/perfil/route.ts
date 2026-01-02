// src/app/api/perfil/route.ts
import { NextResponse } from "next/server";
import pool from "@/db";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Ajusta según tu auth. Debe devolver { id, name, email } del usuario logueado.
async function getSessionUser(req: Request) {
  const me = await fetch(new URL("/api/me", req.url), {
    cache: "no-store",
    headers: { cookie: (req as any).headers.get("cookie") || "" },
  }).then((r) => (r.ok ? r.json() : null));
  return me; // { id, name, email }
}

/** Convierte una dataURL en Buffer + mime */
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("dataUrl inválida");
  const mime = m[1];
  const b64 = m[2];
  return { buffer: Buffer.from(b64, "base64"), mime };
}

/** Dado un mime, devuelve extensión simple */
function extFromMime(mime: string) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/** Guarda el avatar y retorna la URL pública (/uploads/avatars/...) */
async function saveAvatarLocally(userId: string, file: File | null, dataUrl: string | null, req: Request) {
  if (!file && !dataUrl) return null;

  // Directorio destino dentro de /public
  const publicDir = path.join(process.cwd(), "public", "uploads", "avatars");
  await fs.mkdir(publicDir, { recursive: true });

  let buffer: Buffer;
  let mime: string;

  if (file) {
    const arr = await file.arrayBuffer();
    buffer = Buffer.from(arr);
    mime = file.type || "image/jpeg";
  } else {
    const parsed = dataUrlToBuffer(dataUrl!);
    buffer = parsed.buffer;
    mime = parsed.mime;
  }

  // Nombre estable: userId + hash corto + extensión (evita colisiones y cache)
  const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 8);
  const ext = extFromMime(mime);
  const filename = `${userId}-${hash}.${ext}`;
  const destPath = path.join(publicDir, filename);
  await fs.writeFile(destPath, buffer);

  // URL pública servida por Next desde /public
  const urlPath = `/uploads/avatars/${filename}`;
  // agrega timestamp para romper cache cuando se actualiza
  const bust = `?ts=${Date.now()}`;
  return urlPath + bust;
}

export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.id)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();

  const nombre = String(form.get("nombre") || "");
  const email = String(form.get("email") || "");
  const generacion = String(form.get("generacion") || "");
  const facultad = String(form.get("facultad") || "");
  const descripcion = String(form.get("descripcion") || "");
  const instagram = String(form.get("instagram") || "");
  const facebook = String(form.get("facebook") || "");
  const whatsapp = String(form.get("whatsapp") || "");

  // ---- Parseo robusto de participaciones ----
  const participRaw = String(form.get("participaciones") || "[]");
  let participaciones: any = [];
  try {
    let parsed: any = JSON.parse(participRaw);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!Array.isArray(parsed)) parsed = [];
    participaciones = parsed.map((p: any) => ({
      fecha: String(p?.fecha ?? ""),
      nombre: String(p?.nombre ?? ""),
      miniatura: String(p?.miniatura ?? ""),
      ruta: String(p?.ruta ?? ""),
    }));
  } catch {
    participaciones = [];
  }

  // ---- Avatar: archivo o dataURL ----
  const avatarFile = (form.get("avatar") as unknown as File) || null;
  const avatarDataUrl = String(form.get("avatarDataUrl") || "") || null;

  // Guarda localmente (en /public/uploads/avatars)
  const savedUrl = await saveAvatarLocally(user.id, avatarFile, avatarDataUrl, req);
  // Si no se envió nada, mantenemos null para no pisar lo existente
  let avatar_url: string | null = savedUrl;

  // (Si vas a usar S3/GCS en producción, reemplaza saveAvatarLocally por subida a tu bucket
  // y setea avatar_url con la URL pública firmada o pública del objeto.)

  // 1) (opcional) sincronizar name/email en users
  await pool.query(`UPDATE users SET name=$1, email=$2 WHERE id=$3`, [
    nombre || user.name,
    email || user.email,
    user.id,
  ]);

  // 2) Upsert en profiles por user_id
  //    NOTA: si avatar_url es null, no lo pisamos (COALESCE)
  const { rows } = await pool.query(
    `INSERT INTO profiles (
        user_id, generacion, facultad, descripcion,
        instagram, facebook, whatsapp, participaciones, avatar_url
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
     ON CONFLICT (user_id) DO UPDATE SET
        generacion      = EXCLUDED.generacion,
        facultad        = EXCLUDED.facultad,
        descripcion     = EXCLUDED.descripcion,
        instagram       = EXCLUDED.instagram,
        facebook        = EXCLUDED.facebook,
        whatsapp        = EXCLUDED.whatsapp,
        participaciones = EXCLUDED.participaciones,
        avatar_url      = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at      = NOW()
     RETURNING *`,
    [
      user.id,
      generacion,
      facultad,
      descripcion,
      instagram,
      facebook,
      whatsapp,
      JSON.stringify(participaciones),
      avatar_url,
    ],
  );

  const row = rows[0];

  // Si no llegó nueva imagen, pero ya había una en DB, devuelve la existente
  const finalAvatar =
    avatar_url || (row?.avatar_url ? String(row.avatar_url) : null);

  // Normaliza respuesta
  return NextResponse.json({
    ...row,
    avatar_url: finalAvatar,
  });
}
// // src/app/api/perfil/route.ts
// import { NextResponse } from "next/server";
// import pool from "@/db";

// // Ajusta según tu auth. Debe devolver { id, name, email } del usuario logueado.
// async function getSessionUser(req: Request) {
//   const me = await fetch(new URL("/api/me", req.url), {
//     cache: "no-store",
//     headers: { cookie: (req as any).headers.get("cookie") || "" },
//   }).then((r) => (r.ok ? r.json() : null));
//   return me; // { id, name, email }
// }

// export async function PUT(req: Request) {
//   const user = await getSessionUser(req);
//   if (!user?.id)
//     return NextResponse.json({ error: "unauthorized" }, { status: 401 });

//   const form = await req.formData();

//   const nombre = String(form.get("nombre") || "");
//   const email = String(form.get("email") || "");
//   const generacion = String(form.get("generacion") || "");
//   const facultad = String(form.get("facultad") || "");
//   const descripcion = String(form.get("descripcion") || "");
//   const instagram = String(form.get("instagram") || "");
//   const facebook = String(form.get("facebook") || "");
//   const whatsapp = String(form.get("whatsapp") || "");

//   // ---- Parseo robusto de participaciones ----
//   const participRaw = String(form.get("participaciones") || "[]");
//   let participaciones: any = [];
//   try {
//     let parsed: any = JSON.parse(participRaw);
//     // a veces viene doble-stringificado: '"[ ... ]"'
//     if (typeof parsed === "string") parsed = JSON.parse(parsed);
//     if (!Array.isArray(parsed)) parsed = [];
//     participaciones = parsed.map((p: any) => ({
//       fecha: String(p?.fecha ?? ""),
//       nombre: String(p?.nombre ?? ""),
//       miniatura: String(p?.miniatura ?? ""),
//       ruta: String(p?.ruta ?? ""),
//     }));
//   } catch {
//     participaciones = [];
//   }

//   // ---- Avatar (opcional; deja en null si no subieron nada) ----
//   let avatar_url: string | null = null;
//   // const avatarFile = form.get("avatar") as File | null;
//   // const avatarDataUrl = String(form.get("avatarDataUrl") || "");
//   // ... sube y setea avatar_url si corresponde ...

//   // 1) (opcional) sincroniza name/email en users si llegaron vacíos usa los existentes
//   await pool.query(`UPDATE users SET name=$1, email=$2 WHERE id=$3`, [
//     nombre || user.name,
//     email || user.email,
//     user.id,
//   ]);

//   // 2) Upsert en profiles por user_id
//   //    Nota: casteamos el parámetro 8 a ::jsonb y enviamos JSON.stringify(...)
//   const { rows } = await pool.query(
//     `INSERT INTO profiles (
//         user_id, generacion, facultad, descripcion,
//         instagram, facebook, whatsapp, participaciones, avatar_url
//      )
//      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
//      ON CONFLICT (user_id) DO UPDATE SET
//         generacion      = EXCLUDED.generacion,
//         facultad        = EXCLUDED.facultad,
//         descripcion     = EXCLUDED.descripcion,
//         instagram       = EXCLUDED.instagram,
//         facebook        = EXCLUDED.facebook,
//         whatsapp        = EXCLUDED.whatsapp,
//         participaciones = EXCLUDED.participaciones,
//         avatar_url      = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
//         updated_at      = NOW()
//      RETURNING *`,
//     [
//       user.id,
//       generacion,
//       facultad,
//       descripcion,
//       instagram,
//       facebook,
//       whatsapp,
//       JSON.stringify(participaciones), // 👈 importante
//       avatar_url,
//     ],
//   );

//   return NextResponse.json(rows[0]);
// }
