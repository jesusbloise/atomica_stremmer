import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeTextSQL(field: string) {
  return `lower(unaccent(coalesce(${field}, '')))`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ results: [] }, { headers: { "cache-control": "no-store" } });
  }

  try {
    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          u.id::text AS id,
          u.file_name,
          u.file_path,
          u.file_key,
          u.uploaded_at,
          u.category,
          u.subcategory,
          u.thumbnail_url,
          COALESCE(
            u.tipo,
            CASE
              WHEN lower(split_part(u.file_name, '.', -1)) IN ('mp4','mov','mkv','webm','m4v','avi') THEN 'video'
              WHEN lower(split_part(u.file_name, '.', -1)) IN ('pdf','docx','doc','txt','md','csv','log','srt','vtt') THEN 'documento'
              ELSE 'desconocido'
            END
          ) AS tipo
        FROM uploads u
        WHERE u.is_deleted IS NOT TRUE
      ),

      matches AS (
        SELECT DISTINCT ON (b.id)
          b.id,
          b.file_name,
          b.tipo,
          b.file_path,
          b.file_key,
          b.uploaded_at,
          b.category,
          b.subcategory,
          b.thumbnail_url,
          'metadata' AS matched_from,
          NULL::text AS snippet
        FROM base b
        LEFT JOIN ficha_tecnica ft ON ft.upload_id::text = b.id
        WHERE
          ${normalizeTextSQL("b.file_name")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("b.category")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("b.subcategory")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.titulo")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.marca")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.agencia")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.productora")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.director")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.productor")} LIKE '%' || lower(unaccent($1)) || '%'

        UNION ALL

        SELECT DISTINCT ON (b.id)
          b.id,
          b.file_name,
          b.tipo,
          b.file_path,
          b.file_key,
          b.uploaded_at,
          b.category,
          b.subcategory,
          b.thumbnail_url,
          'subtitulos' AS matched_from,
          substring(s.text from greatest(position(lower($1) in lower(s.text)) - 40, 1) for 160) AS snippet
        FROM base b
        JOIN video_subtitulos s ON s.video_id::text = b.id
        WHERE
          b.tipo = 'video'
          AND lower(unaccent(coalesce(s.text, ''))) LIKE '%' || lower(unaccent($1)) || '%'

        UNION ALL

        SELECT DISTINCT ON (b.id)
          b.id,
          b.file_name,
          b.tipo,
          b.file_path,
          b.file_key,
          b.uploaded_at,
          b.category,
          b.subcategory,
          'documento' AS matched_from,
          substring(dt.texto_extraido from greatest(position(lower($1) in lower(dt.texto_extraido)) - 40, 1) for 160) AS snippet
        FROM base b
        JOIN documentos_texto dt ON dt.upload_id::text = b.id
        WHERE
          b.tipo = 'documento'
          AND lower(unaccent(coalesce(dt.texto_extraido, ''))) LIKE '%' || lower(unaccent($1)) || '%'
      )

      SELECT DISTINCT ON (id)
        id,
        file_name,
        tipo,
        file_path,
        file_key,
        uploaded_at,
        category,
        subcategory,
        matched_from,
        snippet
      FROM matches
      ORDER BY id, uploaded_at DESC
      LIMIT 100
      `,
      [q]
    );

    const results = rows.map((r: any) => ({
      id: r.id,
      file_name: r.file_name || "sin_nombre",
      name: r.file_name || "sin_nombre",
      file_path: r.file_path,
      file_key: r.file_key,
      url: r.file_path,
      tipo: r.tipo,
      category: r.category,
      subcategory: r.subcategory,
      thumbnail_url: r.thumbnail_url,
      matched_from: r.matched_from,
      subtituloTexto: (r.snippet || "").trim(),
      uploaded_at: r.uploaded_at,
    }));

    return NextResponse.json(
      { results },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    console.error("Error en /api/buscar:", e?.message || e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}