import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import pool from "@/db";
import { Storage } from "@google-cloud/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storage = new Storage();
const GCS_BUCKET = process.env.GCS_BUCKET;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

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
      SELECT id, file_path, streaming_path
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

    const sourcePath = upload.streaming_path || upload.file_path;
    const parsed = parseGsUrl(sourcePath);

    if (!parsed) {
      return NextResponse.json(
        { error: "El archivo no tiene ruta GCS válida" },
        { status: 400 }
      );
    }

    const tmpDir = os.tmpdir();
    const localVideo = path.join(tmpDir, `${id}-${randomUUID()}.mp4`);

    await storage.bucket(parsed.bucket).file(parsed.objectPath).download({
      destination: localVideo,
    });

    const times = [2, 5, 8, 12, 16, 20];
    const candidates: { url: string; gsUri: string; timeSec: number }[] = [];

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

      await fs.unlink(localImage).catch(() => {});

      candidates.push({
        timeSec,
        gsUri,
        url: `/api/proxy?url=${encodeURIComponent(gsUri)}`,
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