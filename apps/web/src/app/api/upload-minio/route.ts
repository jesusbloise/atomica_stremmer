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

// MinIO client (MV NUEVA)
const minioClient = new Client({
  endPoint: "192.168.5.12",
  port: 9100,
  useSSL: false,
  accessKey: "minio",
  secretKey: "minio123",
});

/* ====================== Categorías/Subcategorías (ATOMICA) ====================== */
type CatSlug = "publicidad" | "entretenimiento" | "vxf";

// Por ahora SIN subcategorías
const ALLOWED_CATEGORIES: CatSlug[] = ["publicidad", "entretenimiento", "vxf"];

const isValidCat = (c: string): c is CatSlug =>
  (ALLOWED_CATEGORIES as string[]).includes(c);

// No usamos subcategorías por ahora
const categoryRequiresSub = (_cat: CatSlug) => false;

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
    // --- Subcategoría (por ahora no aplica) ---
    const subcategory: string | null = null;

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
    const publicUrl = `http://192.168.5.12:9100/archivos/${fileKey}`;

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
          [
            rowId,
            filename,
            fileKey,
            publicUrl,
            file.size,
            "uploaded",
            tipo,
            category,
          ]
        );
      } else {
        throw err;
      }
    }

   // 4.1) Ficha técnica (GUARDAR CAMPOS NUEVOS)
if (ficha) {
  const normString = (v: any) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  const normTipo = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
    if (typeof v === "string")
      return v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    return [];
  };

  try {
    const payload = {
      titulo: normString(ficha.titulo),

      marca: normString(ficha.marca),
      agencia: normString(ficha.agencia),
      productora: normString(ficha.productora),
      contacto: normString(ficha.contacto),

      oficina: normString(ficha.oficina), // "Chile" | "Mexico" | null
      tipo: normTipo(ficha.tipo),         // text[]

      estudio: normString(ficha.estudio),
      director: normString(ficha.director),
      productor: normString(ficha.productor),

      produccion: normString(ficha.produccion),
      corporativo: normString(ficha.corporativo),
      nuevos_negocios: normString(ficha.nuevosNegocios ?? ficha.nuevos_negocios),
    };

    // Intento 1: columnas NUEVAS (tipo es text[])
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
          payload.tipo, // array directo
          payload.estudio,
          payload.director,
          payload.productor,
          payload.produccion,
          payload.corporativo,
          payload.nuevos_negocios,
        ]
      );
    } catch (err: any) {
      // Fallback si en tu DB la columna se llama distinto (ej: productora_ficha)
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
  } catch (e) {
    console.warn("⚠️ No se pudo upsert ficha_tecnica (campos nuevos):", e);
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
      scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
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
