import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import pool from "@/db";
import { Storage } from "@google-cloud/storage";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getR2BucketName, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    console.error("R2_THUMBNAIL_CANDIDATE_UPLOAD_ERROR", error);
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

function parseGsUrl(raw?: string | null) {
  if (!raw || !raw.startsWith("gs://")) return null;
  const clean = raw.slice(5);
  const slash = clean.indexOf("/");
  if (slash === -1) return null;

  return {
    bucket: clean.slice(0, slash),
    objectPath: clean.slice(slash + 1),
  };
}

function parseR2Url(raw?: string | null) {
  if (!raw || !raw.startsWith("r2://")) return null;

  const clean = raw.slice(5);
  const slash = clean.indexOf("/");
  if (slash === -1) return null;

  return {
    bucket: clean.slice(0, slash),
    objectPath: clean.slice(slash + 1),
  };
}

async function downloadR2ToFile(r2Uri: string, destination: string) {
  const parsed = parseR2Url(r2Uri);
  if (!parsed) throw new Error("Ruta R2 inválida");

  const r2Client = getR2Client();

  const result = await r2Client.send(
    new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.objectPath,
    })
  );

  if (!result.Body) {
    throw new Error("R2 no devolvió contenido");
  }

  const chunks: Buffer[] = [];

  for await (const chunk of result.Body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  await fs.writeFile(destination, Buffer.concat(chunks));
}
function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { shell: false });

    child.stderr.on("data", (d) => console.log("[ffmpeg]", d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg terminó con código ${code}`));
    });
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = getRoleFromReq(req);

    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (!GCS_BUCKET) {
      return NextResponse.json({ error: "Falta GCS_BUCKET" }, { status: 500 });
    }

    const { id } = await context.params;

    const { rows } = await pool.query(
      `
      SELECT id, file_path, r2_path, streaming_path
      FROM uploads
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const upload = rows[0];

    if (!upload) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

  const tmpDir = os.tmpdir();
const localVideo = path.join(tmpDir, `${id}-${randomUUID()}.mp4`);

let thumbnailSource: "r2" | "gcs" | null = null;

if (upload.r2_path) {
  try {
    await downloadR2ToFile(upload.r2_path, localVideo);
    thumbnailSource = "r2";
  } catch (r2Err) {
    console.error("THUMBNAIL_SOURCE_R2_FAILED", r2Err);
  }
}

if (!thumbnailSource) {
  const sourcePath = upload.streaming_path || upload.file_path;
  const parsed = parseGsUrl(sourcePath);

  if (!parsed) {
    return NextResponse.json(
      { error: "El archivo no tiene ruta GCS/R2 válida" },
      { status: 400 }
    );
  }

  await storage.bucket(parsed.bucket).file(parsed.objectPath).download({
    destination: localVideo,
  });

  thumbnailSource = "gcs";
}

console.log("THUMBNAIL_SOURCE_SELECTED", {
  id,
  thumbnailSource,
});

    const times = [2, 5, 8, 12, 16, 20];
    const candidates: {
  url: string;
  gsUri: string;
  r2Uri: string | null;
  timeSec: number;
}[] = [];

    for (const timeSec of times) {
      const fileName = `${id}-${timeSec}-${randomUUID()}.jpg`;
      const localImage = path.join(tmpDir, fileName);
      const objectPath = `thumbnail-candidates/${id}/${fileName}`;
      const gsUri = `gs://${GCS_BUCKET}/${objectPath}`;

      await runFfmpeg([
        "-y",
        "-ss",
        String(timeSec),
        "-i",
        localVideo,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        localImage,
      ]);

    await storage.bucket(GCS_BUCKET).upload(localImage, {
  destination: objectPath,
  metadata: {
    contentType: "image/jpeg",
    cacheControl: "public, max-age=86400",
  },
});

const imageBuffer = await fs.readFile(localImage);

const r2Uri = await uploadBufferToR2({
  key: objectPath,
  buffer: imageBuffer,
  contentType: "image/jpeg",
});

await fs.unlink(localImage).catch(() => {});

candidates.push({
  timeSec,
  gsUri,
  r2Uri,
  url: r2Uri
    ? `/api/r2/proxy?url=${encodeURIComponent(r2Uri)}`
    : `/api/proxy?url=${encodeURIComponent(gsUri)}`,
});
    }

    await fs.unlink(localVideo).catch(() => {});

    return NextResponse.json({ candidates });
  } catch (err: any) {
    console.error("GET thumbnail-candidates error:", err);
    return NextResponse.json(
      { error: err?.message || "No se pudieron generar las portadas" },
      { status: 500 }
    );
  }
}