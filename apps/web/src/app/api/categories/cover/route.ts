import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storage = new Storage();
const BUCKET = process.env.GCS_BUCKET;

function cleanName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió imagen" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen" },
        { status: 400 }
      );
    }

    const safeName = cleanName(file.name || "cover.jpg");
    const filename = `${randomUUID()}_${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // PRODUCCIÓN / CLOUD RUN: guarda en Google Cloud Storage
    if (BUCKET) {
      const fileKey = `category-covers/${filename}`;
      const gcsUri = `gs://${BUCKET}/${fileKey}`;

      await storage.bucket(BUCKET).file(fileKey).save(buffer, {
        metadata: {
          contentType: file.type || "image/jpeg",
          cacheControl: "public, max-age=31536000",
        },
      });

      return NextResponse.json({
        ok: true,
        cover: `/api/proxy?url=${encodeURIComponent(gcsUri)}`,
        gcsUri,
        storage: "gcs",
      });
    }

    // LOCAL: guarda en public/uploads/category-covers
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "category-covers"
    );

    await fs.mkdir(dir, { recursive: true });

    const finalPath = path.join(dir, filename);
    await fs.writeFile(finalPath, buffer);

    return NextResponse.json({
      ok: true,
      cover: `/uploads/category-covers/${filename}`,
      storage: "local",
    });
  } catch (e: any) {
    console.error("POST /api/categories/cover error:", {
      message: e?.message,
      code: e?.code,
    });

    return NextResponse.json(
      { error: e?.message || "No se pudo subir la imagen" },
      { status: 500 }
    );
  }
}