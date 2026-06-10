import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { randomUUID, createHash } from "crypto";
import { spawn } from "child_process";
import path from "path";
import { Readable } from "stream";
import { Storage } from "@google-cloud/storage";
import fs from "fs/promises";
import os from "os";

console.log("UPLOAD_ROUTE_HIT (GCS direct upload + web optimized version)");

function webStreamToNodeReadable(webStream: ReadableStream<Uint8Array>): Readable {
  const reader = webStream.getReader();
  return new Readable({
    highWaterMark: 1024 * 64,
    async read() {
      const { done, value } = await reader.read();
      this.push(done ? null : value);
    },
  });
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

const storage = new Storage();
const BUCKET = process.env.GCS_BUCKET;

type CatSlug = string;

async function isValidCat(c: string) {
  const { rows } = await pool.query(
    `
    SELECT slug
    FROM categories
    WHERE slug = $1
      AND is_active = true
    LIMIT 1
    `,
    [c]
  );

  return rows.length > 0;
}

type FichaInput = {
  titulo?: string;
  marca?: string;
  agencia?: string;
  productora?: string;
  contacto?: string;
  oficina?: string;
  tipo?: string[] | string;
  estudio?: string;
  director?: string;
  productor?: string;
  produccion?: string;
  corporativo?: string;
  nuevosNegocios?: string;
  nuevos_negocios?: string;
};

type PendingDirectUpload = {
  rowId: string;
  fileName: string;
  fileKey: string;
  gcsUri: string;
  size: number;
  contentType: string;
  category: CatSlug;
  subcategory: string | null;
  ficha: FichaInput | null;
};

const pendingUploads = new Map<string, PendingDirectUpload>();

function createFinalizeToken(payload: PendingDirectUpload) {
  const raw = JSON.stringify(payload) + "|" + Date.now() + "|" + randomUUID();
  return createHash("sha256").update(raw).digest("hex");
}

function getTipoFromExt(ext: string) {
  return ["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)
    ? "video"
    : ["pdf", "doc", "docx", "txt"].includes(ext)
      ? "documento"
      : "desconocido";
}

function isVideoExt(ext: string) {
  return ["mp4", "mov", "mkv", "webm", "m4v"].includes(ext);
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
    });

    child.stdout.on("data", (d) => console.log(`[${command} stdout]`, d.toString()));
    child.stderr.on("data", (d) => console.log(`[${command} stderr]`, d.toString()));

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function uploadCustomThumbnail(rowId: string, thumbnail: File | null) {
  if (!BUCKET || !thumbnail) return null;

  if (!thumbnail.type.startsWith("image/")) {
    return null;
  }

  const originalName = sanitizeFileName(thumbnail.name || "thumbnail.jpg");
  const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
  const thumbnailKey = `thumbnails/${rowId}-${randomUUID()}.${ext}`;
  const thumbnailUri = `gs://${BUCKET}/${thumbnailKey}`;

  const buffer = Buffer.from(await thumbnail.arrayBuffer());

  await storage.bucket(BUCKET).file(thumbnailKey).save(buffer, {
    metadata: {
      contentType: thumbnail.type || "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable",
    },
    resumable: false,
  });

  await pool.query(
    `
    UPDATE uploads
    SET thumbnail_url = $1
    WHERE id = $2
    `,
    [thumbnailUri, rowId]
  );

  return thumbnailUri;
}

async function createOptimizedStreamingVersion(rowId: string, fileKey: string, ext: string) {
  if (!BUCKET) return null;
  if (!isVideoExt(ext)) return null;

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${rowId}_original.${ext}`);
  const outputPath = path.join(tmpDir, `${rowId}_web.mp4`);
  const streamingKey = `streaming/${rowId}_web.mp4`;
  const streamingUri = `gs://${BUCKET}/${streamingKey}`;

  try {
    console.log("Starting video optimization:", { rowId, fileKey });

    await storage.bucket(BUCKET).file(fileKey).download({
      destination: inputPath,
    });

    await runCommand("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-maxrate",
      "3500k",
      "-bufsize",
      "7000k",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    await storage.bucket(BUCKET).upload(outputPath, {
      destination: streamingKey,
      metadata: {
        contentType: "video/mp4",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    try {
      await pool.query(
        `UPDATE uploads
         SET streaming_path = $1
         WHERE id = $2`,
        [streamingUri, rowId]
      );
    } catch (err: any) {
      if (err?.code === "42703") {
        console.warn("Column streaming_path does not exist yet.");
      } else {
        throw err;
      }
    }

    console.log("Video optimization completed:", { rowId, streamingUri });
    return streamingUri;
  } catch (err) {
    console.error("Video optimization failed:", err);
    return null;
  } finally {
    await fs.unlink(inputPath).catch(() => { });
    await fs.unlink(outputPath).catch(() => { });
  }
}

async function upsertFichaTecnica(rowId: string, ficha: FichaInput | null) {
  if (!ficha) return;

  const normString = (v: any) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  const normTipo = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
    if (typeof v === "string") {
      return v.split(",").map((x) => x.trim()).filter(Boolean);
    }
    return [];
  };

  const payload = {
    titulo: normString(ficha.titulo),
    marca: normString(ficha.marca),
    agencia: normString(ficha.agencia),
    productora: normString(ficha.productora),
    contacto: normString(ficha.contacto),
    oficina: normString(ficha.oficina),
    tipo: normTipo(ficha.tipo),
    estudio: normString(ficha.estudio),
    director: normString(ficha.director),
    productor: normString(ficha.productor),
    produccion: normString(ficha.produccion),
    corporativo: normString(ficha.corporativo),
    nuevos_negocios: normString(ficha.nuevosNegocios ?? ficha.nuevos_negocios),
  };

  try {
    await pool.query(
      `
      INSERT INTO ficha_tecnica (
        upload_id,
        titulo,
        marca, agencia, productora, contacto,
        oficina,
        tipo,
        estudio, director, productor,
        produccion, corporativo,
        nuevos_negocios
      )
      VALUES (
        $1,
        $2,
        $3, $4, $5, $6,
        $7,
        $8::text[],
        $9, $10, $11,
        $12, $13,
        $14
      )
      ON CONFLICT (upload_id) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        marca = EXCLUDED.marca,
        agencia = EXCLUDED.agencia,
        productora = EXCLUDED.productora,
        contacto = EXCLUDED.contacto,
        oficina = EXCLUDED.oficina,
        tipo = EXCLUDED.tipo,
        estudio = EXCLUDED.estudio,
        director = EXCLUDED.director,
        productor = EXCLUDED.productor,
        produccion = EXCLUDED.produccion,
        corporativo = EXCLUDED.corporativo,
        nuevos_negocios = EXCLUDED.nuevos_negocios
      `,
      [
        rowId,
        payload.titulo,
        payload.marca,
        payload.agencia,
        payload.productora,
        payload.contacto,
        payload.oficina,
        payload.tipo,
        payload.estudio,
        payload.director,
        payload.productor,
        payload.produccion,
        payload.corporativo,
        payload.nuevos_negocios,
      ]
    );
  } catch (err: any) {
    if (err?.code === "42703") {
      await pool.query(
        `
        INSERT INTO ficha_tecnica (
          upload_id,
          titulo,
          marca, agencia, productora_ficha, contacto,
          oficina,
          tipo,
          estudio, director, productor,
          produccion, corporativo,
          nuevos_negocios
        )
        VALUES (
          $1,
          $2,
          $3, $4, $5, $6,
          $7,
          $8::text[],
          $9, $10, $11,
          $12, $13,
          $14
        )
        ON CONFLICT (upload_id) DO UPDATE SET
          titulo = EXCLUDED.titulo,
          marca = EXCLUDED.marca,
          agencia = EXCLUDED.agencia,
          productora_ficha = EXCLUDED.productora_ficha,
          contacto = EXCLUDED.contacto,
          oficina = EXCLUDED.oficina,
          tipo = EXCLUDED.tipo,
          estudio = EXCLUDED.estudio,
          director = EXCLUDED.director,
          productor = EXCLUDED.productor,
          produccion = EXCLUDED.produccion,
          corporativo = EXCLUDED.corporativo,
          nuevos_negocios = EXCLUDED.nuevos_negocios
        `,
        [
          rowId,
          payload.titulo,
          payload.marca,
          payload.agencia,
          payload.productora,
          payload.contacto,
          payload.oficina,
          payload.tipo,
          payload.estudio,
          payload.director,
          payload.productor,
          payload.produccion,
          payload.corporativo,
          payload.nuevos_negocios,
        ]
      );
    } else {
      throw err;
    }
  }
}

async function triggerPostProcess(
  rowId: string,
  ext: string,
  _gcsUri: string,
  fileKey: string
) {
  const python =
    process.env.PYTHON_BIN ||
    (process.platform === "win32"
      ? "C:\\Users\\ALLINONE06\\AppData\\Local\\Programs\\Python\\Python310\\python.exe"
      : "python3");

  let scriptPath = "";
  if (isVideoExt(ext)) {
    scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
  } else if (["pdf", "docx", "txt", "doc"].includes(ext)) {
    scriptPath = path.join(process.cwd(), "processor", "procesar_texto.py");
  }

  if (!scriptPath) return;

  if (!BUCKET) {
    console.error("No existe GCS_BUCKET para generar signed URL");
    return;
  }

  try {
    const [signedUrl] = await storage.bucket(BUCKET).file(fileKey).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 1000 * 60 * 60,
    });

   const proceso = spawn(
  python,
  [
    scriptPath,
    rowId,
    signedUrl
  ],
  {
    cwd: process.cwd(),
    shell: false,
  }
);

    proceso.stdout.on("data", (d) => console.log(`[STDOUT ${ext}]:`, d.toString()));
    proceso.stderr.on("data", (d) => console.error(`[STDERR ${ext}]:`, d.toString()));
    proceso.on("error", (e) => console.error("Spawn error:", e));
  } catch (e) {
    console.error("Error generando signed URL para postprocess:", e);
  }
}

async function handleDirectGcsInit(req: NextRequest) {
  if (!BUCKET) {
    return NextResponse.json(
      { error: "Falta GCS_BUCKET en variables de entorno" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

 const rawCat = String(body.category || "").trim().toLowerCase();

if (!(await isValidCat(rawCat))) {
  return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
}

  const fileName = String(body.fileName || "").trim();
  if (!fileName) {
    return NextResponse.json({ error: "Falta fileName" }, { status: 400 });
  }

  const size = Number(body.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Tamaño inválido" }, { status: 400 });
  }

  const contentType = String(body.contentType || "application/octet-stream");
  const category: CatSlug = rawCat;

  const subcategory =
    body.subcategory && String(body.subcategory).trim()
      ? String(body.subcategory).trim()
      : null;

  const ficha = (body.ficha as FichaInput | null) || null;

  console.log("UPLOAD_DIRECT_METADATA", {
    category,
    subcategory,
    rawSubcategory: body.subcategory,
    ficha,
  });


  const safeFileName = sanitizeFileName(fileName);
  const fileKey = `${randomUUID()}_${safeFileName}`;
  const rowId = randomUUID();
  const gcsUri = `gs://${BUCKET}/${fileKey}`;

  const [uploadUrl] = await storage.bucket(BUCKET).file(fileKey).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 1000 * 60 * 30,
    contentType,
  });

  const pending: PendingDirectUpload = {
    rowId,
    fileName,
    fileKey,
    gcsUri,
    size,
    contentType,
    category,
    subcategory,
    ficha,
  };

  const finalizeToken = createFinalizeToken(pending);
  pendingUploads.set(finalizeToken, pending);

  return NextResponse.json({
    ok: true,
    uploadUrl,
    finalizeToken,
    rowId,
    key: fileKey,
    url: gcsUri,
  });
}

async function handleDirectGcsFinalize(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const finalizeToken = String(body.finalizeToken || "");
  const pending = pendingUploads.get(finalizeToken);

  if (!pending) {
    return NextResponse.json(
      { error: "Token de finalización inválido o expirado" },
      { status: 400 }
    );
  }

  const {
    rowId,
    fileName,
    fileKey,
    gcsUri,
    size,
    category,
    subcategory,
    ficha,
    contentType,
  } = pending;

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const tipo = getTipoFromExt(ext);

  try {
    try {
      await pool.query(
        `INSERT INTO uploads
          (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at,
           tipo, category, subcategory)
         VALUES
          ($1, $2, $3, $4, $5, $6, NOW(),
           $7, $8, $9)`,
        [rowId, fileName, fileKey, gcsUri, size, "uploaded", tipo, category, subcategory]
      );
    } catch (err: any) {
      if (err?.code === "42703") {
        await pool.query(
          `INSERT INTO uploads
            (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at, tipo, category)
           VALUES
            ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
          [rowId, fileName, fileKey, gcsUri, size, "uploaded", tipo, category]
        );
      } else {
        throw err;
      }
    }

   await upsertFichaTecnica(rowId, ficha);

const streamingPath = await createOptimizedStreamingVersion(rowId, fileKey, ext);

    await triggerPostProcess(rowId, ext, gcsUri, fileKey);

    pendingUploads.delete(finalizeToken);

    return NextResponse.json({
      id: rowId,
      message: `Archivo ${ext.toUpperCase()} subido correctamente`,
      url: gcsUri,
      streaming_path: streamingPath,
      key: fileKey,
      tipo,
      category,
      subcategory,
      contentType,
    });
  } catch (error) {
    console.error("Error finalize direct GCS:", error);
    return NextResponse.json(
      { error: "Error al finalizar subida directa" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  console.log("UPLOAD_POST", new Date().toISOString());

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const clone = req.clone();
      const body = await clone.json().catch(() => null);
      const mode = body?.mode;

      if (mode === "direct-gcs") {
        return handleDirectGcsInit(req);
      }

      if (mode === "finalize-direct-gcs") {
        return handleDirectGcsFinalize(req);
      }

      return NextResponse.json({ error: "Modo no soportado" }, { status: 400 });
    }

    if (!BUCKET) {
      return NextResponse.json(
        { error: "Falta GCS_BUCKET en variables de entorno" },
        { status: 500 }
      );
    }

    const fileSize = Number(req.headers.get("x-filesize") || 0);
    if (fileSize > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Archivo demasiado grande para este endpoint. Use direct upload." },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
const thumbnail = formData.get("thumbnail") as File | null;
  const rawCat = ((formData.get("category") as string | null)?.trim().toLowerCase() || "");

if (!(await isValidCat(rawCat))) {
  return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
}

    const category: CatSlug = rawCat;

    const subcategory =
      formData.get("subcategory") && String(formData.get("subcategory")).trim()
        ? String(formData.get("subcategory")).trim()
        : null;

    let ficha: FichaInput | null = null;
    const fichaStr = (formData.get("ficha") as string | null) || "";
    if (fichaStr) {
      try {
        ficha = JSON.parse(fichaStr);
      } catch {
        ficha = null;
      }
    }
    console.log("UPLOAD_FORMDATA_METADATA", {
      category,
      subcategory,
      rawSubcategory: formData.get("subcategory"),
      ficha,
    });

    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const safeFileName = sanitizeFileName(filename);
    const fileKey = `${randomUUID()}_${safeFileName}`;
    const rowId = randomUUID();
    const tipo = getTipoFromExt(ext);
    const gcsUri = `gs://${BUCKET}/${fileKey}`;

    const nodeStream = webStreamToNodeReadable(file.stream());
    const gcsFile = storage.bucket(BUCKET).file(fileKey);

    await new Promise<void>((resolve, reject) => {
      const writeStream = gcsFile.createWriteStream({
        resumable: false,
        metadata: { contentType: file.type || "application/octet-stream" },
      });

      nodeStream
        .on("error", reject)
        .pipe(writeStream)
        .on("error", reject)
        .on("finish", () => resolve());
    });

    try {
      await pool.query(
        `INSERT INTO uploads
          (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at,
           tipo, category, subcategory)
         VALUES
          ($1, $2, $3, $4, $5, $6, NOW(),
           $7, $8, $9)`,
        [rowId, filename, fileKey, gcsUri, file.size, "uploaded", tipo, category, subcategory]
      );
    } catch (err: any) {
      if (err?.code === "42703") {
        await pool.query(
          `INSERT INTO uploads
            (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at, tipo, category)
           VALUES
            ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
          [rowId, filename, fileKey, gcsUri, file.size, "uploaded", tipo, category]
        );
      } else {
        throw err;
      }
    }
await upsertFichaTecnica(rowId, ficha);

const thumbnailUrl =
  await uploadCustomThumbnail(
    rowId,
    thumbnail
  );

const streamingPath =
  await createOptimizedStreamingVersion(
    rowId,
    fileKey,
    ext
  );

    await triggerPostProcess(rowId, ext, gcsUri, fileKey);

   return NextResponse.json({
  id: rowId,
  message: `Archivo ${ext.toUpperCase()} subido correctamente`,
  url: gcsUri,
  streaming_path: streamingPath,
  thumbnail_url: thumbnailUrl,
  key: fileKey,
  tipo,
  category,
  subcategory,
});
  } catch (error) {
    console.error("Error general:", error);
    return NextResponse.json(
      { error: "Error al subir archivo o procesar automáticamente" },
      { status: 500 }
    );
  }
}
