// src/app/api/upload-minio/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Client } from "minio";
import pool from "@/db";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import path from "path";
import { Readable } from "stream";

/* ====================== Utils ====================== */
// WebStream -> Node Readable
function webStreamToNodeReadable(
  webStream: ReadableStream<Uint8Array>
): Readable {
  const reader = webStream.getReader();
  return new Readable({
    highWaterMark: 1024 * 64,
    async read() {
      const { done, value } = await reader.read();
      this.push(done ? null : value);
    },
  });
}

// MinIO client
const minioClient = new Client({
  endPoint: "192.168.229.25",
  port: 9100,
  useSSL: false,
  accessKey: "admin",
  secretKey: "admin123",
});

/* ====================== Categorías/Subcategorías (FALABELLA) ====================== */
type CatSlug = "retail" | "moda" | "marca" | "comunicacion-interna";

const SUBCATS: Record<CatSlug, string[]> = {
  retail: [
    "Calendario Comercial",
    "Eventos Precio",
    "Liquidación",
  ],
  moda: [
    "Americanino",
    "Basement",
    "Invierno",
    "University Club",
    "Verano",
  ],
  marca: [
    "Campaña Marca",
    "Dia Madre",
    "Escolares",
    "Navidad",
  ],
  // Comunicación Interna NO tiene subcategorías
  "comunicacion-interna": [],
};

const ALLOWED_CATEGORIES = Object.keys(SUBCATS) as CatSlug[];

const isValidCat = (c: string): c is CatSlug =>
  (ALLOWED_CATEGORIES as string[]).includes(c);

const isValidSub = (cat: CatSlug, s: string) =>
  SUBCATS[cat]?.includes(s) ?? false;

const categoryRequiresSub = (cat: CatSlug) => SUBCATS[cat].length > 0;

/* ====================== Handler ====================== */
export async function POST(req: NextRequest) {
  try {
    // 0) Chequeo de tamaño (rápido)
    const fileSize = Number(req.headers.get("x-filesize") || 0);
    if (fileSize > 500 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "Archivo demasiado grande para este endpoint. Use multipart upload.",
        },
        { status: 413 }
      );
    }

    // 1) FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Categoría y subcategoría
    const rawCat =
      (formData.get("category") as string | null)?.toLowerCase() || "";
    const rawSub = (formData.get("subcategory") as string | null) || "";

    // --- Validar categoría ---
    if (!isValidCat(rawCat)) {
      return NextResponse.json(
        { error: "Categoría inválida" },
        { status: 400 }
      );
    }
    const category: CatSlug = rawCat;

    // --- Validar subcategoría según la categoría ---
    let subcategory: string | null = null;

    if (categoryRequiresSub(category)) {
      // Retail / Moda / Marca -> subcategoría OBLIGATORIA
      if (!rawSub || !isValidSub(category, rawSub)) {
        return NextResponse.json(
          { error: "Subcategoría inválida para esa categoría" },
          { status: 400 }
        );
      }
      subcategory = rawSub;
    } else {
      // Comunicación interna -> sin subcategoría
      subcategory = null;
    }

    // Ficha (JSON opcional, parcial)
    let ficha: any = null;
    const fichaStr = (formData.get("ficha") as string | null) || "";
    if (fichaStr) {
      try {
        ficha = JSON.parse(fichaStr);
      } catch {
        ficha = null;
      }
    }

    // 2) Preparativos de archivo
    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const fileKey = `${randomUUID()}_${filename}`;
    const publicUrl = `http://192.168.229.25:9100/archivos/${fileKey}`;
    const rowId = randomUUID(); // id del upload (TEXT en tu tabla)

    const tipo =
      ["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)
        ? "video"
        : ["pdf", "doc", "docx", "txt"].includes(ext)
        ? "documento"
        : "desconocido";

    // 3) Subir a MinIO (stream sin cargar todo en RAM)
    const webStream = file.stream();
    const stream = webStreamToNodeReadable(webStream);
    await minioClient.putObject("archivos", fileKey, stream, file.size, {
      "Content-Type": file.type || "application/octet-stream",
    });

    // 4) Guardar en Postgres (uploads)
    try {
      await pool.query(
        `INSERT INTO uploads
          (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at,
           tipo, category, subcategory)
         VALUES
          ($1, $2, $3, $4, $5, $6, NOW(),
           $7,   $8,       $9)`,
        [
          rowId,
          filename,
          fileKey,
          publicUrl,
          file.size,
          "uploaded",
          tipo,
          category,
          subcategory,
        ]
      );
    } catch (err: any) {
      // Fallback si en algún entorno faltara subcategory (no debería)
      if (err?.code === "42703") {
        await pool.query(
          `INSERT INTO uploads
            (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at, tipo, category)
           VALUES
            ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
          [rowId, filename, fileKey, publicUrl, file.size, "uploaded", tipo, category]
        );
      } else {
        throw err;
      }
    }

    // 4.1) Ficha técnica (igual que ya tenías)
    if (ficha) {
      try {
        const payload = {
          titulo: ficha.titulo ?? null,
          director: ficha.director ?? null,
          productor: ficha.productor ?? null,
          jefe_produccion:
            ficha.jefeProduccion ?? ficha.jefe_produccion ?? null,
          director_fotografia:
            ficha.directorFotografia ?? ficha.director_fotografia ?? null,
          sonido: ficha.sonido ?? null,
          direccion_arte: ficha.direccionArte ?? ficha.direccion_arte ?? null,
          asistente_direccion:
            ficha.asistenteDireccion ?? ficha.asistente_direccion ?? null,
          montaje: ficha.montaje ?? null,
          otro_cargo: ficha.otroCargo ?? ficha.otro_cargo ?? null,
          contacto_principal:
            ficha.contactoPrincipal ?? ficha.contacto_principal ?? null,
          correo: ficha.correo ?? null,
          curso: ficha.curso ?? null,
          profesor: ficha.profesor ?? null,
          anio:
            typeof ficha.anio === "number"
              ? ficha.anio
              : Number(ficha.anio) || null,
          duracion: ficha.duracion ?? null,
          sinopsis: ficha.sinopsis ?? null,
          proceso_anterior:
            ficha.procesoAnterior ?? ficha.proceso_anterior ?? null,
          pendientes: ficha.pendientes ?? null,
          visto:
            typeof ficha.visto === "boolean"
              ? ficha.visto
              : ["si", "sí", "true", "1"].includes(
                  String(ficha.visto || "").toLowerCase()
                )
              ? true
              : ["no", "false", "0"].includes(
                  String(ficha.visto || "").toLowerCase()
                )
              ? false
              : null,
          reunion: ficha.reunion ?? null,
          formato: ficha.formato ?? null,
          estado: ficha.estado ?? null,
          delivery_estimado:
            ficha.deliveryEstimado ?? ficha.delivery_estimado ?? null,
          seleccion: ficha.seleccion ?? null,
          link: ficha.link ?? null,
          foto: ficha.foto ?? null,
        };

        await pool.query(
          `INSERT INTO ficha_tecnica (
             upload_id, titulo, director, productor, jefe_produccion,
             director_fotografia, sonido, direccion_arte, asistente_direccion,
             montaje, otro_cargo, contacto_principal, correo, curso, profesor,
             anio, duracion, sinopsis, proceso_anterior, pendientes, visto, reunion,
             formato, estado, delivery_estimado, seleccion, link, foto
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
             $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
           )
           ON CONFLICT (upload_id) DO UPDATE SET
             titulo = EXCLUDED.titulo,
             director = EXCLUDED.director,
             productor = EXCLUDED.productor,
             jefe_produccion = EXCLUDED.jefe_produccion,
             director_fotografia = EXCLUDED.director_fotografia,
             sonido = EXCLUDED.sonido,
             direccion_arte = EXCLUDED.direccion_arte,
             asistente_direccion = EXCLUDED.asistente_direccion,
             montaje = EXCLUDED.montaje,
             otro_cargo = EXCLUDED.otro_cargo,
             contacto_principal = EXCLUDED.contacto_principal,
             correo = EXCLUDED.correo,
             curso = EXCLUDED.curso,
             profesor = EXCLUDED.profesor,
             anio = EXCLUDED.anio,
             duracion = EXCLUDED.duracion,
             sinopsis = EXCLUDED.sinopsis,
             proceso_anterior = EXCLUDED.proceso_anterior,
             pendientes = EXCLUDED.pendientes,
             visto = EXCLUDED.visto,
             reunion = EXCLUDED.reunion,
             formato = EXCLUDED.formato,
             estado = EXCLUDED.estado,
             delivery_estimado = EXCLUDED.delivery_estimado,
             seleccion = EXCLUDED.seleccion,
             link = EXCLUDED.link,
             foto = EXCLUDED.foto`,
          [
            rowId,
            payload.titulo,
            payload.director,
            payload.productor,
            payload.jefe_produccion,
            payload.director_fotografia,
            payload.sonido,
            payload.direccion_arte,
            payload.asistente_direccion,
            payload.montaje,
            payload.otro_cargo,
            payload.contacto_principal,
            payload.correo,
            payload.curso,
            payload.profesor,
            payload.anio,
            payload.duracion,
            payload.sinopsis,
            payload.proceso_anterior,
            payload.pendientes,
            payload.visto,
            payload.reunion,
            payload.formato,
            payload.estado,
            payload.delivery_estimado,
            payload.seleccion,
            payload.link,
            payload.foto,
          ]
        );
      } catch (e) {
        console.warn("⚠️ No se pudo upsert ficha_tecnica:", e);
        // No abortamos la subida por esto
      }
    }

    // 5) Procesamiento posterior (igual que tenías)
    const python =
      process.platform === "win32"
        ? "C:\\Users\\ALLINONE06\\AppData\\Local\\Programs\\Python\\Python310\\python.exe"
        : "python3";

    let scriptPath = "";
    if (["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)) {
      scriptPath = path.join(
        process.cwd(),
        "processor",
        "procesar_subtitulos.py"
      );
    } else if (["pdf", "docx", "txt", "doc"].includes(ext)) {
      scriptPath = path.join(process.cwd(), "processor", "procesar_texto.py");
    }

    if (scriptPath) {
      const proceso = spawn(python, [scriptPath, rowId, publicUrl], {
        cwd: process.cwd(),
        shell: true,
      });
      proceso.stdout.on("data", (d) =>
        console.log(`[STDOUT ${ext}]:`, d.toString())
      );
      proceso.stderr.on("data", (d) =>
        console.error(`[STDERR ${ext}]:`, d.toString())
      );
    }

    // 6) Respuesta
    return NextResponse.json({
      id: rowId,
      message: `✅ ${ext.toUpperCase()} subido y procesándose`,
      url: publicUrl,
      key: fileKey,
      tipo,
      category,
      subcategory,
    });
  } catch (error) {
    console.error("❌ Error general:", error);
    return NextResponse.json(
      { error: "Error al subir archivo o procesar automáticamente" },
      { status: 500 }
    );
  }
}


// // src/app/api/upload-minio/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { Client } from "minio";
// import pool from "@/db";
// import { randomUUID } from "crypto";
// import { spawn } from "child_process";
// import path from "path";
// import { Readable } from "stream";

// /* ====================== Utils ====================== */
// // WebStream -> Node Readable
// function webStreamToNodeReadable(webStream: ReadableStream<Uint8Array>): Readable {
//   const reader = webStream.getReader();
//   return new Readable({
//     highWaterMark: 1024 * 64,
//     async read() {
//       const { done, value } = await reader.read();
//       this.push(done ? null : value);
//     },
//   });
// }

// // MinIO client
// const minioClient = new Client({
//   endPoint: "192.168.229.25",
//   port: 9100,
//   useSSL: false,
//   accessKey: "admin",
//   secretKey: "admin123",
// });

// /* ====================== Categorías/Subcategorías ====================== */
// type CatSlug =
//   | "periodismo-comunicacion"
//   | "publicidad-marketing"
//   | "cine-comunicacion-audiovisual";

// const SUBCATS: Record<CatSlug, string[]> = {
//   "periodismo-comunicacion": [
//     "Reportajes de información periodística",
//     "multimedios",
//     "podcast",
//     "audiovisuales",
//     "Revista Kiltra",
//     "Paper - artículos",
//     "poster de investigación notas informativas 2° año",
//     "noticiero radial 2° año",
//     "noticiero radial 3° año",
//   ],
//   "publicidad-marketing": [
//     "Proyectos de título: video casos",
//     "Exámenes de 1° año",
//     "Exámenes de 2° año",
//     "Exámenes de 3° año",
//     "Exámenes de 4° año",
//   ],
//   "cine-comunicacion-audiovisual": [
//     "Cortometrajes Ficción: 1° año",
//     "Cortometrajes Ficción: 2° año",
//     "Cortometrajes Ficción: 3° año",
//     "Cortometrajes Ficción: 4° año",
//     "Cortometrajes documentales: 1° año",
//     "Cortometrajes documentales: 2° año",
//     "Cortometrajes documentales: 3° año",
//     "Largometrajes",
//     "Tesinas",
//     "Artículos de investigación",
//   ],
// };
// const ALLOWED_CATEGORIES = Object.keys(SUBCATS) as CatSlug[];
// const isValidCat = (c: string): c is CatSlug =>
//   (ALLOWED_CATEGORIES as string[]).includes(c);
// const isValidSub = (cat: CatSlug, s: string) =>
//   SUBCATS[cat]?.includes(s) ?? false;

// /* ====================== Handler ====================== */
// export async function POST(req: NextRequest) {
//   try {
//     // 0) Chequeo de tamaño (rápido)
//     const fileSize = Number(req.headers.get("x-filesize") || 0);
//     if (fileSize > 500 * 1024 * 1024) {
//       return NextResponse.json(
//         { error: "Archivo demasiado grande para este endpoint. Use multipart upload." },
//         { status: 413 }
//       );
//     }

//     // 1) FormData
//     const formData = await req.formData();
//     const file = formData.get("file") as File | null;
//     if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

//     // Categoría y subcategoría (obligatorias desde tu front)
//     const rawCat = (formData.get("category") as string | null)?.toLowerCase() || "";
//     const rawSub = (formData.get("subcategory") as string | null) || "";
//     if (!isValidCat(rawCat)) {
//       return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
//     }
//     if (!isValidSub(rawCat, rawSub)) {
//       return NextResponse.json({ error: "Subcategoría inválida para esa categoría" }, { status: 400 });
//     }
//     const category: CatSlug = rawCat;
//     const subcategory: string = rawSub;

//     // Ficha (JSON opcional, parcial)
//     let ficha: any = null;
//     const fichaStr = (formData.get("ficha") as string | null) || "";
//     if (fichaStr) {
//       try { ficha = JSON.parse(fichaStr); } catch { ficha = null; }
//     }

//     // 2) Preparativos de archivo
//     const filename = file.name;
//     const ext = filename.split(".").pop()?.toLowerCase() || "";
//     const fileKey = `${randomUUID()}_${filename}`;
//     const publicUrl = `http://192.168.229.25:9100/archivos/${fileKey}`;
//     const rowId = randomUUID(); // id del upload (TEXT en tu tabla)

//     const tipo =
//       ["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)
//         ? "video"
//         : ["pdf", "doc", "docx", "txt"].includes(ext)
//         ? "documento"
//         : "desconocido";

//     // 3) Subir a MinIO (stream sin cargar todo en RAM)
//     const webStream = file.stream();
//     const stream = webStreamToNodeReadable(webStream);
//     await minioClient.putObject("archivos", fileKey, stream, file.size, {
//       "Content-Type": file.type || "application/octet-stream",
//     });

//     // 4) Guardar en Postgres (uploads) — ¡sin columna 'ficha'!
//     try {
//       await pool.query(
//         `INSERT INTO uploads
//           (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at,
//            tipo, category, subcategory)
//          VALUES
//           ($1, $2, $3, $4, $5, $6, NOW(),
//            $7,   $8,       $9)`,
//         [
//           rowId,
//           filename,
//           fileKey,
//           publicUrl,
//           file.size,
//           "uploaded",
//           tipo,
//           category,
//           subcategory,
//         ]
//       );
//     } catch (err: any) {
//       // Fallback si en algún entorno faltara subcategory (no debería)
//       if (err?.code === "42703") {
//         await pool.query(
//           `INSERT INTO uploads
//             (id, file_name, file_key, file_path, size_in_bytes, status, uploaded_at, tipo, category)
//            VALUES
//             ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
//           [rowId, filename, fileKey, publicUrl, file.size, "uploaded", tipo, category]
//         );
//       } else {
//         throw err;
//       }
//     }

//     // 4.1) Si vino ficha -> upsert en ficha_tecnica (relación 1–1 por upload_id TEXT)
//     if (ficha) {
//       try {
//         const payload = {
//           titulo: ficha.titulo ?? null,
//           director: ficha.director ?? null,
//           productor: ficha.productor ?? null,
//           jefe_produccion: ficha.jefeProduccion ?? ficha.jefe_produccion ?? null,
//           director_fotografia: ficha.directorFotografia ?? ficha.director_fotografia ?? null,
//           sonido: ficha.sonido ?? null,
//           direccion_arte: ficha.direccionArte ?? ficha.direccion_arte ?? null,
//           asistente_direccion: ficha.asistenteDireccion ?? ficha.asistente_direccion ?? null,
//           montaje: ficha.montaje ?? null,
//           otro_cargo: ficha.otroCargo ?? ficha.otro_cargo ?? null,
//           contacto_principal: ficha.contactoPrincipal ?? ficha.contacto_principal ?? null,
//           correo: ficha.correo ?? null,
//           curso: ficha.curso ?? null,
//           profesor: ficha.profesor ?? null,
//           anio: typeof ficha.anio === "number" ? ficha.anio : Number(ficha.anio) || null,
//           duracion: ficha.duracion ?? null,
//           sinopsis: ficha.sinopsis ?? null,
//           proceso_anterior: ficha.procesoAnterior ?? ficha.proceso_anterior ?? null,
//           pendientes: ficha.pendientes ?? null,
//           visto: typeof ficha.visto === "boolean"
//             ? ficha.visto
//             : ["si","sí","true","1"].includes(String(ficha.visto||"").toLowerCase()) ? true
//               : (["no","false","0"].includes(String(ficha.visto||"").toLowerCase()) ? false : null),
//           reunion: ficha.reunion ?? null, // ISO; Postgres castea a timestamptz
//           formato: ficha.formato ?? null,
//           estado: ficha.estado ?? null,
//           delivery_estimado: ficha.deliveryEstimado ?? ficha.delivery_estimado ?? null,
//           seleccion: ficha.seleccion ?? null,
//           link: ficha.link ?? null,
//           foto: ficha.foto ?? null,
//         };

//         await pool.query(
//           `INSERT INTO ficha_tecnica (
//              upload_id, titulo, director, productor, jefe_produccion,
//              director_fotografia, sonido, direccion_arte, asistente_direccion,
//              montaje, otro_cargo, contacto_principal, correo, curso, profesor,
//              anio, duracion, sinopsis, proceso_anterior, pendientes, visto, reunion,
//              formato, estado, delivery_estimado, seleccion, link, foto
//            ) VALUES (
//              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
//              $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
//            )
//            ON CONFLICT (upload_id) DO UPDATE SET
//              titulo = EXCLUDED.titulo,
//              director = EXCLUDED.director,
//              productor = EXCLUDED.productor,
//              jefe_produccion = EXCLUDED.jefe_produccion,
//              director_fotografia = EXCLUDED.director_fotografia,
//              sonido = EXCLUDED.sonido,
//              direccion_arte = EXCLUDED.direccion_arte,
//              asistente_direccion = EXCLUDED.asistente_direccion,
//              montaje = EXCLUDED.montaje,
//              otro_cargo = EXCLUDED.otro_cargo,
//              contacto_principal = EXCLUDED.contacto_principal,
//              correo = EXCLUDED.correo,
//              curso = EXCLUDED.curso,
//              profesor = EXCLUDED.profesor,
//              anio = EXCLUDED.anio,
//              duracion = EXCLUDED.duracion,
//              sinopsis = EXCLUDED.sinopsis,
//              proceso_anterior = EXCLUDED.proceso_anterior,
//              pendientes = EXCLUDED.pendientes,
//              visto = EXCLUDED.visto,
//              reunion = EXCLUDED.reunion,
//              formato = EXCLUDED.formato,
//              estado = EXCLUDED.estado,
//              delivery_estimado = EXCLUDED.delivery_estimado,
//              seleccion = EXCLUDED.seleccion,
//              link = EXCLUDED.link,
//              foto = EXCLUDED.foto`,
//           [
//             rowId,
//             payload.titulo, payload.director, payload.productor, payload.jefe_produccion,
//             payload.director_fotografia, payload.sonido, payload.direccion_arte, payload.asistente_direccion,
//             payload.montaje, payload.otro_cargo, payload.contacto_principal, payload.correo, payload.curso, payload.profesor,
//             payload.anio, payload.duracion, payload.sinopsis, payload.proceso_anterior, payload.pendientes, payload.visto, payload.reunion,
//             payload.formato, payload.estado, payload.delivery_estimado, payload.seleccion, payload.link, payload.foto
//           ]
//         );
//       } catch (e) {
//         console.warn("⚠️ No se pudo upsert ficha_tecnica:", e);
//         // No abortamos la subida por esto
//       }
//     }

//     // 5) Procesamiento posterior (igual que tenías)
//     const python = process.platform === "win32"
//       ? "C:\\Users\\ALLINONE06\\AppData\\Local\\Programs\\Python\\Python310\\python.exe"
//       : "python3";

//     let scriptPath = "";
//     if (["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)) {
//       scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
//     } else if (["pdf", "docx", "txt", "doc"].includes(ext)) {
//       scriptPath = path.join(process.cwd(), "processor", "procesar_texto.py");
//     }

//     if (scriptPath) {
//       const proceso = spawn(python, [scriptPath, rowId, publicUrl], {
//         cwd: process.cwd(),
//         shell: true,
//       });
//       proceso.stdout.on("data", (d) => console.log(`[STDOUT ${ext}]:`, d.toString()));
//       proceso.stderr.on("data", (d) => console.error(`[STDERR ${ext}]:`, d.toString()));
//     }

//     // 6) Respuesta
//     return NextResponse.json({
//       id: rowId,
//       message: `✅ ${ext.toUpperCase()} subido y procesándose`,
//       url: publicUrl,
//       key: fileKey,
//       tipo,
//       category,
//       subcategory,
//     });
//   } catch (error) {
//     console.error("❌ Error general:", error);
//     return NextResponse.json(
//       { error: "Error al subir archivo o procesar automáticamente" },
//       { status: 500 }
//     );
//   }
// }

