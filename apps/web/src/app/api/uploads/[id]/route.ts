import { NextResponse } from "next/server";
import pool from "@/db";
import { Storage } from "@google-cloud/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const storage = new Storage();
const GCS_BUCKET = process.env.GCS_BUCKET;

type RowUploadBase = {
  id: string;
  tipo: string | null;
  file_path: string | null;
  file_name: string | null;
  file_key: string | null;
  uploaded_at: string | null;
  views?: number | null;
  category?: string | null;
  subcategory?: string | null;
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

function parseGsUrl(raw?: string | null) {
  if (!raw || !raw.startsWith("gs://")) return null;

  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

async function buildDirectSignedUrl(params: {
  filePath?: string | null;
  fileKey?: string | null;
  contentType?: string | null;
  fileName?: string | null;
}) {
  const { filePath, fileKey, contentType, fileName } = params;

  if (filePath && /^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  const parsed = parseGsUrl(filePath);
  const bucket = parsed?.bucket || GCS_BUCKET;
  const objectPath = parsed?.objectPath || fileKey;

  if (!bucket || !objectPath) return null;

  const file = storage.bucket(bucket).file(objectPath);

  await file.getMetadata();

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 6,
    responseType: contentType || undefined,
    responseDisposition: fileName ? `inline; filename="${fileName.replace(/"/g, "")}"` : "inline",
  });

  return signedUrl;
}

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
        `SELECT id, tipo, file_path, file_name, file_key, uploaded_at,
                content_type, streaming_path, views, category, subcategory,
                vimeo_id, duration_sec, thumbnail_url
         FROM uploads
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      row = q1.rows[0] || null;
    } catch {
      const q2 = await pool.query<RowUploadBase>(
        `SELECT id, tipo, file_path, file_name, file_key, uploaded_at, views,
                category, subcategory
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

    const playbackPath =
      tipo === "video" && row.streaming_path ? row.streaming_path : row.file_path;

    const playbackContentType =
      tipo === "video" && row.streaming_path ? "video/mp4" : contentType;

    const url = await buildDirectSignedUrl({
      filePath: playbackPath,
      fileKey: row.file_key,
      contentType: playbackContentType,
      fileName: row.file_name,
    });

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
          streaming_path: row.streaming_path ?? null,
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

// import { NextResponse } from "next/server";
// import pool from "@/db";
// import { Storage } from "@google-cloud/storage";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";
// export const revalidate = 0;

// const storage = new Storage();
// const GCS_BUCKET = process.env.GCS_BUCKET;

// type RowUploadBase = {
//   id: string;
//   tipo: string | null;
//   file_path: string | null;
//   file_name: string | null;
//   file_key: string | null;
//   uploaded_at: string | null;
//   views?: number | null;
//   category?: string | null;
//   subcategory?: string | null;
// };

// type RowUploadWithMore = RowUploadBase & {
//   content_type: string | null;
//   vimeo_id?: string | null;
//   duration_sec?: number | null;
//   thumbnail_url?: string | null;
// };

// type RowFicha = {
//   upload_id: string;
//   titulo: string | null;
//   director: string | null;
//   productor: string | null;
//   jefe_produccion: string | null;
//   director_fotografia: string | null;
//   sonido: string | null;
//   direccion_arte: string | null;
//   asistente_direccion: string | null;
//   montaje: string | null;
//   otro_cargo: string | null;
//   contacto_principal: string | null;
//   correo: string | null;
//   curso: string | null;
//   profesor: string | null;
//   anio: number | null;
//   duracion: string | null;
//   sinopsis: string | null;
//   proceso_anterior: string | null;
//   pendientes: string | null;
//   visto: boolean | null;
//   reunion: string | null;
//   formato: string | null;
//   estado: string | null;
//   delivery_estimado: string | null;
//   seleccion: string | null;
//   link: string | null;
//   foto: string | null;
// };

// function inferExt(name?: string | null) {
//   const n = (name || "").split("?")[0].split("#")[0];
//   return n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
// }

// function extToMime(ext: string): string | null {
//   const map: Record<string, string> = {
//     pdf: "application/pdf",
//     docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     txt: "text/plain",
//     md: "text/markdown",
//     csv: "text/csv",
//     log: "text/plain",
//     srt: "text/plain",
//     vtt: "text/vtt",
//     mp4: "video/mp4",
//     mov: "video/quicktime",
//     mkv: "video/x-matroska",
//     webm: "video/webm",
//     m4v: "video/mp4",
//   };

//   return map[ext] || null;
// }

// function inferTipo(
//   ext: string,
//   contentType?: string | null
// ): "video" | "documento" | null {
//   const ct = (contentType || "").toLowerCase();

//   if (ct.startsWith("video/")) return "video";
//   if (ct.startsWith("application/pdf")) return "documento";
//   if (ct.includes("wordprocessingml.document")) return "documento";
//   if (ct.startsWith("text/")) return "documento";

//   if (["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)) return "video";
//   if (["pdf", "docx", "txt", "md", "csv", "log", "srt", "vtt"].includes(ext)) {
//     return "documento";
//   }

//   return null;
// }

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

// async function buildDirectSignedUrl(
//   filePath?: string | null,
//   fileKey?: string | null,
//   contentType?: string | null
// ): Promise<string | null> {
//   if (filePath && /^https?:\/\//i.test(filePath)) {
//     return filePath;
//   }

//   const parsed = parseGsUrl(filePath);

//   const bucket = parsed?.bucket || GCS_BUCKET;
//   const objectPath = parsed?.objectPath || fileKey;

//   if (!bucket || !objectPath) return null;

//   const file = storage.bucket(bucket).file(objectPath);

//   const [signedUrl] = await file.getSignedUrl({
//     version: "v4",
//     action: "read",
//     expires: Date.now() + 1000 * 60 * 60 * 6,
//     responseType: contentType || undefined,
//   });

//   return signedUrl;
// }

// function mapFichaToCamel(row?: RowFicha | null) {
//   if (!row) return null;

//   return {
//     titulo: row.titulo ?? undefined,
//     director: row.director ?? undefined,
//     productor: row.productor ?? undefined,
//     jefeProduccion: row.jefe_produccion ?? undefined,
//     directorFotografia: row.director_fotografia ?? undefined,
//     sonido: row.sonido ?? undefined,
//     direccionArte: row.direccion_arte ?? undefined,
//     asistenteDireccion: row.asistente_direccion ?? undefined,
//     montaje: row.montaje ?? undefined,
//     otroCargo: row.otro_cargo ?? undefined,
//     contactoPrincipal: row.contacto_principal ?? undefined,
//     correo: row.correo ?? undefined,
//     curso: row.curso ?? undefined,
//     profesor: row.profesor ?? undefined,
//     anio: row.anio ?? undefined,
//     duracion: row.duracion ?? undefined,
//     sinopsis: row.sinopsis ?? undefined,
//     procesoAnterior: row.proceso_anterior ?? undefined,
//     pendientes: row.pendientes ?? undefined,
//     visto: row.visto ?? undefined,
//     reunion: row.reunion ?? undefined,
//     formato: row.formato ?? undefined,
//     estado: row.estado ?? undefined,
//     deliveryEstimado: row.delivery_estimado ?? undefined,
//     seleccion: row.seleccion ?? undefined,
//     link: row.link ?? undefined,
//     foto: row.foto ?? undefined,
//   };
// }

// export async function GET(
//   _req: Request,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const { id } = await context.params;

//   try {
//     let row: RowUploadWithMore | null = null;

//     try {
//       const q1 = await pool.query<RowUploadWithMore>(
//         `SELECT id, tipo, file_path, file_name, file_key, uploaded_at,
//                 content_type, views, category, subcategory,
//                 vimeo_id, duration_sec, thumbnail_url
//            FROM uploads
//           WHERE id = $1
//           LIMIT 1`,
//         [id]
//       );

//       row = q1.rows[0] || null;
//     } catch {
//       const q2 = await pool.query<RowUploadBase>(
//         `SELECT id, tipo, file_path, file_name, file_key, uploaded_at, views,
//                 category, subcategory
//            FROM uploads
//           WHERE id = $1
//           LIMIT 1`,
//         [id]
//       );

//       const r = q2.rows[0] || null;

//       if (r) {
//         row = {
//           ...r,
//           content_type: null,
//           vimeo_id: null,
//           duration_sec: null,
//           thumbnail_url: null,
//         };
//       }
//     }

//     if (!row) {
//       return NextResponse.json(
//         { error: "Archivo no encontrado" },
//         { status: 404 }
//       );
//     }

//     let fichaRow: RowFicha | null = null;

//     try {
//       const qf = await pool.query<RowFicha>(
//         `SELECT upload_id, titulo, director, productor, jefe_produccion,
//                 director_fotografia, sonido, direccion_arte, asistente_direccion,
//                 montaje, otro_cargo, contacto_principal, correo, curso, profesor,
//                 anio, duracion, sinopsis, proceso_anterior, pendientes, visto, reunion,
//                 formato, estado, delivery_estimado, seleccion, link, foto
//            FROM ficha_tecnica
//           WHERE upload_id = $1
//           LIMIT 1`,
//         [id]
//       );

//       fichaRow = qf.rows[0] || null;
//     } catch (e: any) {
//       if (e?.code !== "42P01") throw e;
//     }

//     const ext = inferExt(row.file_name || row.file_key);
//     const contentType = row.content_type || extToMime(ext);
//     const inferredTipo = inferTipo(ext, contentType);
//     const tipo = row.tipo ?? inferredTipo;

//     if (row.tipo == null && tipo) {
//       try {
//         await pool.query(`UPDATE uploads SET tipo = $1 WHERE id = $2`, [
//           tipo,
//           id,
//         ]);
//       } catch (e) {
//         console.warn("No se pudo actualizar tipo inferido:", e);
//       }
//     }

//     const url = await buildDirectSignedUrl(
//       row.file_path,
//       row.file_key,
//       contentType
//     );

//     return NextResponse.json(
//       {
//         upload: {
//           id: row.id,
//           tipo,
//           file_name: row.file_name,
//           ext,
//           content_type: contentType,
//           url,
//           uploaded_at: row.uploaded_at,
//           views: row.views ?? 0,
//           category: row.category ?? null,
//           subcategory: row.subcategory ?? null,
//           ficha: mapFichaToCamel(fichaRow),
//           vimeo_id: row.vimeo_id ?? null,
//           duration_sec: row.duration_sec ?? null,
//           thumbnail_url: row.thumbnail_url ?? null,
//         },
//       },
//       {
//         status: 200,
//         headers: {
//           "Cache-Control": "no-store",
//         },
//       }
//     );
//   } catch (e: any) {
//     console.error("❌ Error en /api/uploads/[id]:", e);
//     return NextResponse.json({ error: "Error interno" }, { status: 500 });
//   }
// }
