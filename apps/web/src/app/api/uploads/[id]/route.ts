import { NextResponse } from "next/server";
import pool from "@/db";
// import { Storage } from "@google-cloud/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getR2SignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2BucketName, getR2Client } from "@/lib/r2";
import { getCloudflareStreamVideoStatus } from "@/lib/cloudflareStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// const storage = new Storage();
// const GCS_BUCKET = process.env.GCS_BUCKET;

type RowUploadBase = {
  id: string;
  tipo: string | null;
  file_path: string | null;
  r2_path?: string | null;
  file_name: string | null;
  file_key: string | null;
  uploaded_at: string | null;
  views?: number | null;
  category?: string | null;
  subcategory?: string | null;
  cf_stream_uid?: string | null;
cf_stream_status?: string | null;
cf_stream_ready?: boolean | null;
cf_stream_playback_url?: string | null;
};

type RowUploadWithMore = RowUploadBase & {
  content_type: string | null;
  streaming_path?: string | null;
  vimeo_id?: string | null;
  duration_sec?: number | null;
  thumbnail_url?: string | null;
};

type RowFicha = {
  upload_id: string;
  titulo: string | null;
  director: string | null;
  productor: string | null;
  jefe_produccion: string | null;
  director_fotografia: string | null;
  sonido: string | null;
  direccion_arte: string | null;
  asistente_direccion: string | null;
  montaje: string | null;
  otro_cargo: string | null;
  contacto_principal: string | null;
  correo: string | null;
  curso: string | null;
  profesor: string | null;
  anio: number | null;
  duracion: string | null;
  sinopsis: string | null;
  proceso_anterior: string | null;
  pendientes: string | null;
  visto: boolean | null;
  reunion: string | null;
  formato: string | null;
  estado: string | null;
  delivery_estimado: string | null;
  seleccion: string | null;
  link: string | null;
  foto: string | null;
};

function inferExt(name?: string | null) {
  const n = (name || "").split("?")[0].split("#")[0];
  return n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
}

function extToMime(ext: string): string | null {
  const map: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    webm: "video/webm",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    log: "text/plain",
    srt: "text/plain",
    vtt: "text/vtt",
  };

  return map[ext] || null;
}

function inferTipo(ext: string, contentType?: string | null): "video" | "documento" | null {
  const ct = (contentType || "").toLowerCase();

  if (ct.startsWith("video/")) return "video";
  if (ct.startsWith("application/pdf")) return "documento";
  if (ct.includes("wordprocessingml.document")) return "documento";
  if (ct.startsWith("text/")) return "documento";

  if (["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)) return "video";
  if (["pdf", "docx", "doc", "txt", "md", "csv", "log", "srt", "vtt"].includes(ext)) {
    return "documento";
  }

  return null;
}

// function parseGsUrl(raw?: string | null) {
//   if (!raw || !raw.startsWith("gs://")) return null;

//   const withoutScheme = raw.slice(5);
//   const firstSlash = withoutScheme.indexOf("/");
//   if (firstSlash === -1) return null;

//   const bucket = withoutScheme.slice(0, firstSlash);
//   const objectPath = withoutScheme.slice(firstSlash + 1);

//   if (!bucket || !objectPath) return null;

//   return { bucket, objectPath };
// }

function parseR2Url(raw?: string | null) {
  if (!raw || !raw.startsWith("r2://")) return null;

  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

// async function buildDirectSignedUrl(params: {
//   filePath?: string | null;
//   fileKey?: string | null;
//   contentType?: string | null;
//   fileName?: string | null;
// }) {
//   const { filePath, fileKey, contentType, fileName } = params;

//   if (filePath && /^https?:\/\//i.test(filePath)) {
//     return filePath;
//   }

//   const parsed = parseGsUrl(filePath);
//   const bucket = parsed?.bucket || GCS_BUCKET;
//   const objectPath = parsed?.objectPath || fileKey;

//   if (!bucket || !objectPath) return null;

//   const file = storage.bucket(bucket).file(objectPath);

//   await file.getMetadata();

//   const [signedUrl] = await file.getSignedUrl({
//     version: "v4",
//     action: "read",
//     expires: Date.now() + 1000 * 60 * 60 * 6,
//     responseType: contentType || undefined,
//     responseDisposition: fileName ? `inline; filename="${fileName.replace(/"/g, "")}"` : "inline",
//   });

//   return signedUrl;
// }

async function buildR2SignedUrl(params: {
  r2Path?: string | null;
  contentType?: string | null;
  fileName?: string | null;
}) {
  const parsed = parseR2Url(params.r2Path);
  if (!parsed) return null;

  const bucket = parsed.bucket || getR2BucketName();
  const r2Client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: parsed.objectPath,
    ResponseContentType: params.contentType || undefined,
    ResponseContentDisposition: params.fileName
      ? `inline; filename="${params.fileName.replace(/"/g, "")}"`
      : "inline",
  });

  const signedUrl = await getR2SignedUrl(r2Client, command, {
    expiresIn: 60 * 60 * 6,
  });

  return signedUrl;
}

// async function recoverStreamingPathIfExists(rowId: string) {
//   if (!GCS_BUCKET) return null;

//   const streamingKey = `streaming/${rowId}_web.mp4`;
//   const streamingUri = `gs://${GCS_BUCKET}/${streamingKey}`;
//   const file = storage.bucket(GCS_BUCKET).file(streamingKey);

//   const [exists] = await file.exists();
//   if (!exists) return null;

//   try {
//     await pool.query(
//       `UPDATE uploads SET streaming_path = $1 WHERE id = $2`,
//       [streamingUri, rowId]
//     );
//   } catch (e) {
//     console.warn("No se pudo recuperar streaming_path en DB:", e);
//   }

//   return streamingUri;
// }

function mapFichaToCamel(row?: RowFicha | null) {
  if (!row) return null;

  return {
    titulo: row.titulo ?? undefined,
    director: row.director ?? undefined,
    productor: row.productor ?? undefined,
    jefeProduccion: row.jefe_produccion ?? undefined,
    directorFotografia: row.director_fotografia ?? undefined,
    sonido: row.sonido ?? undefined,
    direccionArte: row.direccion_arte ?? undefined,
    asistenteDireccion: row.asistente_direccion ?? undefined,
    montaje: row.montaje ?? undefined,
    otroCargo: row.otro_cargo ?? undefined,
    contactoPrincipal: row.contacto_principal ?? undefined,
    correo: row.correo ?? undefined,
    curso: row.curso ?? undefined,
    profesor: row.profesor ?? undefined,
    anio: row.anio ?? undefined,
    duracion: row.duracion ?? undefined,
    sinopsis: row.sinopsis ?? undefined,
    procesoAnterior: row.proceso_anterior ?? undefined,
    pendientes: row.pendientes ?? undefined,
    visto: row.visto ?? undefined,
    reunion: row.reunion ?? undefined,
    formato: row.formato ?? undefined,
    estado: row.estado ?? undefined,
    deliveryEstimado: row.delivery_estimado ?? undefined,
    seleccion: row.seleccion ?? undefined,
    link: row.link ?? undefined,
    foto: row.foto ?? undefined,
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    let row: RowUploadWithMore | null = null;

    try {
      const q1 = await pool.query<RowUploadWithMore>(
        `SELECT id, tipo, file_path, r2_path, file_name, file_key, uploaded_at,
    content_type, streaming_path, views, category, subcategory,
    vimeo_id, duration_sec, thumbnail_url,
    cf_stream_uid, cf_stream_status, cf_stream_ready, cf_stream_playback_url
 FROM uploads
 WHERE id = $1
 LIMIT 1`,
        [id]
      );

      row = q1.rows[0] || null;
    } catch {
      const q2 = await pool.query<RowUploadBase>(
        `SELECT id, tipo, file_path, r2_path, file_name, file_key, uploaded_at, views,
    category, subcategory,
    cf_stream_uid, cf_stream_status, cf_stream_ready, cf_stream_playback_url
FROM uploads
 WHERE id = $1
 LIMIT 1`,
        [id]
      );

      const r = q2.rows[0] || null;

      if (r) {
  row = {
    ...r,
    content_type: null,
    streaming_path: null,
    vimeo_id: null,
    duration_sec: null,
    thumbnail_url: null,
    cf_stream_uid: r.cf_stream_uid ?? null,
    cf_stream_status: r.cf_stream_status ?? null,
    cf_stream_ready: r.cf_stream_ready ?? null,
    cf_stream_playback_url: r.cf_stream_playback_url ?? null,
  };
}
    }

    if (!row) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    let fichaRow: RowFicha | null = null;

    try {
      const qf = await pool.query<RowFicha>(
        `SELECT upload_id, titulo, director, productor, jefe_produccion,
                director_fotografia, sonido, direccion_arte, asistente_direccion,
                montaje, otro_cargo, contacto_principal, correo, curso, profesor,
                anio, duracion, sinopsis, proceso_anterior, pendientes, visto, reunion,
                formato, estado, delivery_estimado, seleccion, link, foto
         FROM ficha_tecnica
         WHERE upload_id = $1
         LIMIT 1`,
        [id]
      );

      fichaRow = qf.rows[0] || null;
    } catch (e: any) {
      if (e?.code !== "42P01") throw e;
    }

    const ext = inferExt(row.file_name || row.file_key);
    const contentType = row.content_type || extToMime(ext);
    const inferredTipo = inferTipo(ext, contentType);
    const tipo = row.tipo ?? inferredTipo;

    if (row.tipo == null && tipo) {
      try {
        await pool.query(`UPDATE uploads SET tipo = $1 WHERE id = $2`, [tipo, id]);
      } catch (e) {
        console.warn("No se pudo actualizar tipo inferido:", e);
      }
    }

    const finalStreamingPath = row.streaming_path || null;

const preferR2 = Boolean(row.r2_path);

const usingStreaming =
  tipo === "video" &&
  Boolean(finalStreamingPath) &&
  Boolean(finalStreamingPath?.startsWith("r2://")) &&
  !preferR2;

const playbackPath = preferR2
  ? row.r2_path
  : usingStreaming
    ? finalStreamingPath
    : row.file_path;

    const playbackContentType = usingStreaming ? "video/mp4" : contentType;

    let url: string | null = null;

    let cfStreamUid = row.cf_stream_uid ?? null;
let cfStreamStatus = row.cf_stream_status ?? null;
let cfStreamReady = Boolean(row.cf_stream_ready);
let cfStreamPlaybackUrl = row.cf_stream_playback_url ?? null;

if (tipo === "video" && cfStreamUid && !cfStreamReady) {
  try {
    const cf = await getCloudflareStreamVideoStatus(cfStreamUid);

    cfStreamStatus = cf.status;
    cfStreamReady = cf.ready;
    cfStreamPlaybackUrl = cf.playbackUrl;

    await pool.query(
      `
      UPDATE uploads
      SET cf_stream_status = $1,
          cf_stream_ready = $2,
          cf_stream_playback_url = $3
      WHERE id = $4
      `,
      [cfStreamStatus, cfStreamReady, cfStreamPlaybackUrl, row.id]
    );
  } catch (e) {
    console.warn("No se pudo sincronizar estado Cloudflare Stream:", e);
  }
}
if (tipo === "video" && cfStreamReady && cfStreamPlaybackUrl) {
  url = cfStreamPlaybackUrl;
}
if (!url && preferR2 && row.r2_path) {
  if (tipo === "video") {
    url = await buildR2SignedUrl({
      r2Path: row.r2_path,
      contentType: playbackContentType,
      fileName: row.file_name,
    });
  } else {
    url = `/api/r2/proxy?url=${encodeURIComponent(row.r2_path)}`;
  }
}
console.log("PLAYBACK_URL_SELECTED", {
  id: row.id,
  tipo,
  cfStreamReady,
  cfStreamPlaybackUrl,
  finalUrl: url,
});
  if (!url) {
  return NextResponse.json(
    {
      error: "Archivo no disponible en R2 ni Cloudflare Stream",
      details: {
        id: row.id,
        file_path: row.file_path,
        r2_path: row.r2_path,
        cf_stream_ready: cfStreamReady,
        cf_stream_playback_url: cfStreamPlaybackUrl,
      },
    },
    { status: 404 }
  );
}

    return NextResponse.json(
      {
        upload: {
          id: row.id,
          tipo,
          file_name: row.file_name,
          ext,
          content_type: playbackContentType,
          url,
          uploaded_at: row.uploaded_at,
          views: row.views ?? 0,
          category: row.category ?? null,
          subcategory: row.subcategory ?? null,
          ficha: mapFichaToCamel(fichaRow),
          vimeo_id: row.vimeo_id ?? null,
          duration_sec: row.duration_sec ?? null,
          thumbnail_url: row.thumbnail_url ?? null,

          file_path: row.file_path ?? null,
          r2_path: row.r2_path ?? null,
          streaming_path: finalStreamingPath ?? null,
          playback_path: playbackPath ?? null,
          using_streaming: usingStreaming,
          using_r2: preferR2,
          
          cf_stream_uid: cfStreamUid,
cf_stream_status: cfStreamStatus,
cf_stream_ready: cfStreamReady,
cf_stream_playback_url: cfStreamPlaybackUrl,
using_cloudflare_stream:
  tipo === "video" && cfStreamReady && Boolean(cfStreamPlaybackUrl),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (e: any) {
    console.error("❌ Error en /api/uploads/[id]:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}