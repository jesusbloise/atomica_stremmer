// src/app/api/buscar/route.ts
import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildUrl(row: any) {
  const base = process.env.MINIO_PUBLIC_BASE ?? "http://192.168.229.25:9100/archivos";
  const file_path = row.file_path || "";
  const file_key = row.file_key || "";
  return file_path.startsWith("http") ? file_path : `${base}/${file_key}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json({ results: [] });

  try {
    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          u.id::text AS id,   -- normalizamos a text
          u.file_name,
          COALESCE(
            u.tipo,
            CASE
              WHEN lower(split_part(u.file_name, '.', -1)) IN ('mp4','mov','mkv','webm','avi') THEN 'video'
              WHEN lower(split_part(u.file_name, '.', -1)) IN ('pdf','docx','txt','md','csv','log','srt','vtt') THEN 'documento'
              ELSE 'desconocido'
            END
          ) AS tipo,
          u.file_path,
          u.file_key,
          u.uploaded_at
        FROM uploads u
        WHERE (u.is_deleted IS NOT TRUE)           -- 👈 ignora soft-deletes (también cubre NULL)
      )

      -- VIDEOS: buscar en subtítulos
      SELECT
        b.id,
        b.file_name,
        b.tipo,
        b.file_path,
        b.file_key,
        b.uploaded_at,
        'video' AS matched_from,
        substring(s.text from greatest(position(lower($1) in lower(s.text)) - 40, 1) for 160) AS snippet
      FROM base b
      JOIN video_subtitulos s
        ON s.video_id::text = b.id
      WHERE b.tipo = 'video'
        AND lower(s.text) LIKE '%' || lower($1) || '%'

      UNION ALL

      -- DOCUMENTOS: buscar en texto extraído y/o nombre
      SELECT
        b.id,
        b.file_name,
        b.tipo,
        b.file_path,
        b.file_key,
        b.uploaded_at,
        'documento' AS matched_from,
        substring(dt.texto_extraido from greatest(position(lower($1) in lower(dt.texto_extraido)) - 40, 1) for 160) AS snippet
      FROM base b
      JOIN documentos_texto dt
        ON dt.upload_id::text = b.id
      WHERE b.tipo = 'documento'
        AND (
          lower(dt.texto_extraido) LIKE '%' || lower($1) || '%'
          OR lower(b.file_name)     LIKE '%' || lower($1) || '%'
        )

      ORDER BY uploaded_at DESC
      LIMIT 100
      `,
      [q]
    );

    const results = rows.map((r: any) => ({
      id: r.id as string,
      name: (r.file_name as string) || "sin_nombre",
      url: buildUrl(r),
      tipo: r.tipo as "video" | "documento" | "desconocido",
      subtituloTexto: (r.snippet || "").trim(),
      uploaded_at: r.uploaded_at,
    }));

    return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    console.error("❌ /api/buscar error:", e?.message || e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
