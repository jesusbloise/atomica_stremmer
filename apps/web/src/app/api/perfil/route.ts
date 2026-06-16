import { NextResponse } from "next/server";
import pool from "@/db";
import crypto from "crypto";
import { Storage } from "@google-cloud/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";
import { cookies } from "next/headers";

const storage = new Storage();
const GCS_BUCKET = process.env.GCS_BUCKET;
async function uploadBufferToR2(params: {
  key: string;
  buffer: Buffer;
  contentType?: string | null;
}) {
  try {
    const r2Client = getR2Client();
    const bucket = getR2BucketName();

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType || "application/octet-stream",
      })
    );

    return `r2://${bucket}/${params.key}`;
  } catch (error) {
    console.error("R2_AVATAR_UPLOAD_ERROR", error);
    return null;
  }
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function getSubFromJwt(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const json = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(json);

    return typeof data?.sub === "string" ? data.sub : null;
  } catch {
    return null;
  }
}

async function getSessionUser() {
  try {
    const cookieStore = await cookies();

    const rawAuth =
      cookieStore.get("auth")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;

    if (!rawAuth) return null;

    const userId = isUuid(rawAuth) ? rawAuth : getSubFromJwt(rawAuth);

    if (!userId || !isUuid(userId)) return null;

    const { rows } = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    return rows[0] || null;
  } catch (e) {
    console.error("SESSION ERROR:", e);
    return null;
  }
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
async function saveAvatarToGCS(
  userId: string,
  file: File | null,
  dataUrl: string | null
) {
  if (!file && !dataUrl) return null;
  if (!GCS_BUCKET) throw new Error("GCS_BUCKET no configurado");

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

  const hash = crypto.createHash("md5").update(buffer).digest("hex").slice(0, 8);
  const ext = extFromMime(mime);
  const objectPath = `avatars/${userId}-${hash}.${ext}`;

  await storage.bucket(GCS_BUCKET).file(objectPath).save(buffer, {
    metadata: {
      contentType: mime,
      cacheControl: "public, max-age=31536000",
    },
    resumable: false,
  });
const gsPath = `gs://${GCS_BUCKET}/${objectPath}`;

const r2Path = await uploadBufferToR2({
  key: objectPath,
  buffer,
  contentType: mime,
});

const finalPath = r2Path || gsPath;

if (r2Path) {
  return `/api/r2/proxy?url=${encodeURIComponent(r2Path)}&ts=${Date.now()}`;
}

return `/api/proxy?url=${encodeURIComponent(gsPath)}&ts=${Date.now()}`;
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
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
  const savedUrl = await saveAvatarToGCS(user.id, avatarFile, avatarDataUrl);
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
