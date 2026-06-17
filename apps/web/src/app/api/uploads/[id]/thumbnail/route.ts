import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import pool from "@/db";
import { Storage } from "@google-cloud/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const storage = new Storage();
const GCS_BUCKET = process.env.GCS_BUCKET;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

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
    console.error("R2_THUMBNAIL_UPLOAD_ERROR", error);
    return null;
  }
}

function getRoleFromReq(req: Request) {
  const cookie = (req.headers.get("cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("auth="));

  const raw = cookie?.split("=")?.[1];
  if (!raw) return null;

  try {
    const token = decodeURIComponent(raw);
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return String(payload.role || "").trim().toUpperCase();
  } catch {
    return null;
  }
}

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return "";
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = getRoleFromReq(req);

    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (!GCS_BUCKET) {
      return NextResponse.json(
        { error: "Falta configurar GCS_BUCKET" },
        { status: 500 }
      );
    }

    const { id } = await context.params;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Debes enviar una imagen" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen" },
        { status: 400 }
      );
    }

    const ext = extFromMime(file.type) || "jpg";
    const objectPath = `thumbnails/${id}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await storage.bucket(GCS_BUCKET).file(objectPath).save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000",
      },
      resumable: false,
    });

    const gsThumbnailUrl = `gs://${GCS_BUCKET}/${objectPath}`;

const r2ThumbnailUrl = await uploadBufferToR2({
  key: objectPath,
  buffer,
  contentType: file.type,
});
console.log("CUSTOM_THUMBNAIL_UPLOAD_RESULT", {
  id,
  objectPath,
  gsThumbnailUrl,
  r2ThumbnailUrl,
});

const thumbnailUrl = r2ThumbnailUrl || gsThumbnailUrl;

    const { rows } = await pool.query(
      `
      UPDATE uploads
      SET thumbnail_url = $1
      WHERE id = $2
      RETURNING id, thumbnail_url
      `,
      [thumbnailUrl, id]
    );

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      thumbnail_url: rows[0].thumbnail_url,
    });
  } catch (err) {
    console.error("POST /api/uploads/[id]/thumbnail error:", err);

    return NextResponse.json(
      { error: "No se pudo subir la portada" },
      { status: 500 }
    );
  }
}