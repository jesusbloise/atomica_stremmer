import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getR2BucketName, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
    }

    const safeName = cleanName(file.name || "cover.jpg");
    const filename = `${randomUUID()}_${safeName}`;
    const fileKey = `category-covers/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const r2Client = getR2Client();
    const bucket = getR2BucketName();

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: buffer,
        ContentType: file.type || "image/jpeg",
        CacheControl: "public, max-age=31536000",
      })
    );

    const r2Uri = `r2://${bucket}/${fileKey}`;

    return NextResponse.json({
      ok: true,
      cover: `/api/r2/proxy?url=${encodeURIComponent(r2Uri)}`,
      r2Uri,
      storage: "r2",
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