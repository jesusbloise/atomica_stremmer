// /app/api/uploads/[id]/route.ts
import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  reunion: string | null; // pg suele entregar timestamptz como string
  formato: string | null;
  estado: string | null;
  delivery_estimado: string | null;
  seleccion: string | null;
  link: string | null;
  foto: string | null;
};

const BASE_URL =
  process.env.FILES_BASE_URL?.replace(/\/+$/, "") ||
  "http://192.168.229.25:9100/archivos";

function inferExt(name?: string | null) {
  const n = (name || "").split("?")[0].split("#")[0];
  const ext = n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
  return ext;
}

function extToMime(ext: string): string | null {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    log: "text/plain",
    srt: "text/plain",
    vtt: "text/vtt",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    webm: "video/webm",
  };
  return map[ext] || null;
}

function inferTipo(
  ext: string,
  contentType?: string | null
): "video" | "documento" | null {
  const ct = (contentType || "").toLowerCase();

  if (/^video\//.test(ct)) return "video";
  if (ct.startsWith("application/pdf")) return "documento";
  if (ct.includes("wordprocessingml.document")) return "documento";
  if (/^text\//.test(ct)) return "documento";

  if (["mp4", "mov", "mkv", "webm"].includes(ext)) return "video";
  if (["pdf", "docx", "txt", "md", "csv", "log", "srt", "vtt"].includes(ext)) return "documento";

  return null;
}

function buildPublicUrl(file_path?: string | null, file_key?: string | null): string | null {
  if (file_path && /^https?:\/\//i.test(file_path)) return file_path;
  if (file_key) return `${BASE_URL}/${file_key}`;
  return null;
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
    reunion: row.reunion ?? undefined, // ya string ISO/ts
    formato: row.formato ?? undefined,
    estado: row.estado ?? undefined,
    deliveryEstimado: row.delivery_estimado ?? undefined,
    seleccion: row.seleccion ?? undefined,
    link: row.link ?? undefined,
    foto: row.foto ?? undefined,
  };
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    // 1) Traer upload (con columnas modernas si existen)
    let row: RowUploadWithMore | null = null;

    try {
      const q1 = await pool.query<RowUploadWithMore>(
        `SELECT id, tipo, file_path, file_name, file_key, uploaded_at,
                content_type, views, category, subcategory,
                vimeo_id, duration_sec, thumbnail_url
           FROM uploads
          WHERE id = $1`,
        [id]
      );
      row = q1.rows[0] || null;
    } catch {
      // Fallback si faltan columnas nuevas
      const q2 = await pool.query<RowUploadBase>(
        `SELECT id, tipo, file_path, file_name, file_key, uploaded_at, views,
                category, subcategory
           FROM uploads
          WHERE id = $1`,
        [id]
      );
      const r = q2.rows[0] || null;
      if (r) {
        row = { ...r, content_type: null, vimeo_id: null, duration_sec: null, thumbnail_url: null };
      }
    }

    if (!row) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    // 2) Traer ficha_tecnica (si existe la tabla)
    let fichaRow: RowFicha | null = null;
    try {
      const qf = await pool.query<RowFicha>(
        `SELECT upload_id, titulo, director, productor, jefe_produccion,
                director_fotografia, sonido, direccion_arte, asistente_direccion,
                montaje, otro_cargo, contacto_principal, correo, curso, profesor,
                anio, duracion, sinopsis, proceso_anterior, pendientes, visto, reunion,
                formato, estado, delivery_estimado, seleccion, link, foto
           FROM ficha_tecnica
          WHERE upload_id = $1`,
        [id]
      );
      fichaRow = qf.rows[0] || null;
    } catch (e: any) {
      // Si la tabla no existe (42P01), simplemente no adjuntamos ficha
      if (e?.code !== "42P01") {
        throw e;
      }
    }

    const ext = inferExt(row.file_name);
    const url = buildPublicUrl(row.file_path, row.file_key);
    const content_type = row.content_type || extToMime(ext);
    const inferredTipo = inferTipo(ext, content_type);
    const tipo = row.tipo ?? inferredTipo;

    // Persistir tipo inferido si estaba NULL
    if (row.tipo == null && tipo) {
      try {
        await pool.query(`UPDATE uploads SET tipo = $1 WHERE id = $2`, [tipo, id]);
      } catch (e) {
        console.warn("No se pudo actualizar tipo inferido:", e);
      }
    }

    return NextResponse.json(
      {
        upload: {
          id: row.id,
          tipo,
          file_name: row.file_name,
          ext,
          content_type,
          url,
          uploaded_at: row.uploaded_at,
          views: row.views ?? 0,
          category: row.category ?? null,
          subcategory: row.subcategory ?? null,
          // ahora viene desde ficha_tecnica (camelCase):
          ficha: mapFichaToCamel(fichaRow),
          vimeo_id: row.vimeo_id ?? null,
          duration_sec: row.duration_sec ?? null,
          thumbnail_url: row.thumbnail_url ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("❌ Error en /api/uploads/[id]:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}



// // /app/api/uploads/[id]/route.ts
// import { NextResponse } from "next/server";
// import pool from "@/db";

// export const dynamic = "force-dynamic";
// export const revalidate = 0;

// type RowBase = {
//   id: string;
//   tipo: string | null;
//   file_path: string | null;
//   file_name: string | null;
//   file_key: string | null;
//   uploaded_at: string | null;
// };

// type RowWithCT = RowBase & { content_type: string | null };

// const BASE_URL =
//   process.env.FILES_BASE_URL?.replace(/\/+$/, "") ||
//   "http://192.168.229.25:9100/archivos";

// function inferExt(name?: string | null) {
//   const n = (name || "").split("?")[0].split("#")[0];
//   const ext = n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
//   return ext;
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
//   };
//   return map[ext] || null;
// }

// function inferTipo(ext: string, contentType?: string | null): "video" | "documento" | null {
//   const ct = (contentType || "").toLowerCase();

//   if (/^video\//.test(ct)) return "video";
//   if (ct.startsWith("application/pdf")) return "documento";
//   if (ct.includes("wordprocessingml.document")) return "documento";
//   if (/^text\//.test(ct)) return "documento";

//   if (["mp4", "mov", "mkv", "webm"].includes(ext)) return "video";
//   if (["pdf", "docx", "txt", "md", "csv", "log", "srt", "vtt"].includes(ext)) return "documento";

//   return null;
// }

// function buildPublicUrl(file_path?: string | null, file_key?: string | null): string | null {
//   if (file_path && /^https?:\/\//i.test(file_path)) return file_path;
//   if (file_key) return `${BASE_URL}/${file_key}`;
//   return null;
// }

// export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
//   const { id } = await context.params; // <- importante: await

//   try {
//     // 1) Intentar con content_type si existe la columna
//     let row: RowWithCT | null = null;

//     try {
//       const q1 = await pool.query<RowWithCT>(
//         `SELECT id, tipo, file_path, file_name, file_key, uploaded_at, content_type, views
//            FROM uploads
//           WHERE id = $1`,
//         [id]
//       );
//       row = q1.rows[0] || null;
//     } catch {
//       // 2) Fallback: esquema sin content_type
//       const q2 = await pool.query<RowBase>(
//         `SELECT id, tipo, file_path, file_name, file_key, uploaded_at, views
//            FROM uploads
//           WHERE id = $1`,
//         [id]
//       );
//       const r = q2.rows[0] || null;
//       if (r) {
//         row = { ...r, content_type: null };
//       }
//     }

//     if (!row) {
//       return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
//     }

//     const ext = inferExt(row.file_name);
//     const url = buildPublicUrl(row.file_path, row.file_key);
//     const content_type = row.content_type || extToMime(ext);
//     const inferredTipo = inferTipo(ext, content_type);
//     const tipo = row.tipo ?? inferredTipo;

//     // Si tipo en DB está NULL y pudimos inferir, lo persistimos
//     if (row.tipo == null && tipo) {
//       try {
//         await pool.query(`UPDATE uploads SET tipo = $1 WHERE id = $2`, [tipo, id]);
//       } catch (e) {
//         // no interrumpimos la respuesta por un fallo de update
//         console.warn("No se pudo actualizar tipo inferido:", e);
//       }
//     }

//     return NextResponse.json(
//   {
//     upload: {
//       id: row.id,
//       tipo,
//       file_name: row.file_name,
//       ext,
//       content_type,
//       url,
//       uploaded_at: row.uploaded_at,
//       views: (row as any).views ?? 0, // <- agrega esta línea
//     },
//   },
//   { status: 200 }
// );

//   } catch (e: any) {
//     console.error("❌ Error en /api/uploads/[id]:", e);
//     return NextResponse.json({ error: "Error interno" }, { status: 500 });
//   }
// }


