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
    return NextResponse.json(
      { results: [] },
      { headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          u.id::text AS id,
          u.file_name,
          ft.titulo,
          COALESCE(NULLIF(ft.titulo, ''), u.file_name) AS display_name,
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
        LEFT JOIN ficha_tecnica ft ON ft.upload_id::text = u.id::text
        WHERE u.is_deleted IS NOT TRUE
      ),

      matches AS (
        SELECT DISTINCT ON (b.id)
          b.id,
          b.file_name,
          b.titulo,
          b.display_name,
          b.tipo,
          b.file_path,
          b.file_key,
          b.uploaded_at,
          b.category,
          b.subcategory,
          b.thumbnail_url,
          'ficha' AS matched_from,
          COALESCE(
            NULLIF(ft.titulo, ''),
            NULLIF(ft.marca, ''),
            NULLIF(ft.agencia, ''),
            NULLIF(ft.productora, ''),
            NULLIF(ft.productora_ficha, ''),
            NULLIF(ft.contacto, ''),
            NULLIF(ft.oficina, ''),
            NULLIF(ft.estudio, ''),
            NULLIF(ft.director, ''),
            NULLIF(ft.productor, ''),
            NULLIF(ft.produccion, ''),
            NULLIF(ft.corporativo, ''),
            NULLIF(ft.nuevos_negocios, ''),
            NULL
          ) AS snippet
        FROM base b
        LEFT JOIN ficha_tecnica ft ON ft.upload_id::text = b.id
        WHERE
          ${normalizeTextSQL("b.file_name")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("b.display_name")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("b.category")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("b.subcategory")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.titulo")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.marca")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.agencia")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.productora")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.productora_ficha")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.contacto")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.oficina")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.estudio")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.director")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.productor")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.produccion")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.corporativo")} LIKE '%' || lower(unaccent($1)) || '%'
          OR ${normalizeTextSQL("ft.nuevos_negocios")} LIKE '%' || lower(unaccent($1)) || '%'
          OR lower(unaccent(coalesce(array_to_string(ft.tipo, ' '), ''))) LIKE '%' || lower(unaccent($1)) || '%'

        UNION ALL

        SELECT DISTINCT ON (b.id)
          b.id,
          b.file_name,
          b.titulo,
          b.display_name,
          b.tipo,
          b.file_path,
          b.file_key,
          b.uploaded_at,
          b.category,
          b.subcategory,
          b.thumbnail_url,
          'subtitulos' AS matched_from,
          substring(
            s.text
            from greatest(position(lower($1) in lower(s.text)) - 40, 1)
            for 160
          ) AS snippet
        FROM base b
        JOIN video_subtitulos s ON s.video_id::text = b.id
        WHERE
          b.tipo = 'video'
          AND lower(unaccent(coalesce(s.text, ''))) LIKE '%' || lower(unaccent($1)) || '%'

        UNION ALL

        SELECT DISTINCT ON (b.id)
          b.id,
          b.file_name,
          b.titulo,
          b.display_name,
          b.tipo,
          b.file_path,
          b.file_key,
          b.uploaded_at,
          b.category,
          b.subcategory,
          b.thumbnail_url,
          'documento' AS matched_from,
          substring(
            dt.texto_extraido
            from greatest(position(lower($1) in lower(dt.texto_extraido)) - 40, 1)
            for 160
          ) AS snippet
        FROM base b
        JOIN documentos_texto dt ON dt.upload_id::text = b.id
        WHERE
          b.tipo = 'documento'
          AND lower(unaccent(coalesce(dt.texto_extraido, ''))) LIKE '%' || lower(unaccent($1)) || '%'
      )

      SELECT DISTINCT ON (id)
        id,
        file_name,
        titulo,
        display_name,
        tipo,
        file_path,
        file_key,
        uploaded_at,
        category,
        subcategory,
        thumbnail_url,
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
      display_name: r.display_name || r.titulo || r.file_name || "sin_nombre",
      titulo: r.titulo || null,
      name: r.display_name || r.titulo || r.file_name || "sin_nombre",
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