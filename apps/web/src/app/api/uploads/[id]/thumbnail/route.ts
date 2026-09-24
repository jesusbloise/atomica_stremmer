import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { randomUUID } from "crypto";
import pool from "@/db";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return "jpg";
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(req);
    const role = String(session?.role || "").trim().toUpperCase();

    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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

    const ext = extFromMime(file.type);
    const objectPath = `thumbnails/${id}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const r2ThumbnailUrl = await uploadBufferToR2({
      key: objectPath,
      buffer,
      contentType: file.type,
    });

    console.log("CUSTOM_THUMBNAIL_UPLOAD_RESULT", {
      id,
      objectPath,
      r2ThumbnailUrl,
    });

    if (!r2ThumbnailUrl) {
      return NextResponse.json(
        { error: "No se pudo subir la portada a R2" },
        { status: 500 }
      );
    }

    const { rows } = await pool.query(
      `
      UPDATE uploads
      SET thumbnail_url = $1
      WHERE id = $2
      RETURNING id, thumbnail_url
      `,
      [r2ThumbnailUrl, id]
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
      storage: "r2",
    });
  } catch (err) {
    console.error("POST /api/uploads/[id]/thumbnail error:", err);

    return NextResponse.json(
      { error: "No se pudo subir la portada" },
      { status: 500 }
    );
  }
}