import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RowUpload = {
  id: string;
  file_name: string | null;
  display_name: string | null;
  titulo: string | null;
  file_key: string | null;
  file_path: string | null;
  r2_path: string | null;
  size_in_bytes: number | null;
  uploaded_at: string | null;
  tipo: string | null;
  category?: string | null;
  subcategory?: string | null;
  thumbnail_url?: string | null;
  cf_stream_uid?: string | null;
  cf_stream_status?: string | null;
  cf_stream_ready?: boolean | null;
  cf_stream_playback_url?: string | null;
};

function buildReadableUrl(row: RowUpload) {
  if (row.cf_stream_ready && row.cf_stream_playback_url) {
    return row.cf_stream_playback_url;
  }

  if (row.r2_path) {
    return row.r2_path;
  }

  if (row.file_path) {
    return row.file_path;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category")?.trim().toLowerCase() || null;
  const subcategory = searchParams.get("subcategory")?.trim() || null;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 500), 1), 1000);

  try {
    const where: string[] = [`(u.is_deleted IS NOT TRUE)`];
    const params: Array<string | number> = [];
    let i = 1;

    if (category) {
      where.push(`LOWER(u.category) = $${i++}`);
      params.push(category);
    }

    if (subcategory) {
      where.push(`u.subcategory = $${i++}`);
      params.push(subcategory);
    }

    where.push(`
      (
        u.r2_path IS NOT NULL
        OR u.cf_stream_playback_url IS NOT NULL
        OR u.file_path IS NOT NULL
      )
    `);

    const sql = `
      SELECT
        u.id,
        u.file_name,
        ft.titulo,
        COALESCE(NULLIF(ft.titulo, ''), u.file_name) AS display_name,
        u.file_key,
        u.file_path,
        u.r2_path,
        u.size_in_bytes,
        u.uploaded_at,
        u.tipo,
        u.category,
        u.subcategory,
        u.thumbnail_url,
        u.cf_stream_uid,
        u.cf_stream_status,
        u.cf_stream_ready,
        u.cf_stream_playback_url
      FROM uploads u
      LEFT JOIN ficha_tecnica ft
        ON ft.upload_id::text = u.id::text
      WHERE ${where.join(" AND ")}
      ORDER BY u.uploaded_at DESC
      LIMIT $${i}
    `;

    params.push(limit);

    const { rows } = await pool.query<RowUpload>(sql, params);

    const enriched = rows.map((row) => ({
      ...row,
      url: buildReadableUrl(row),
      using_cloudflare_stream: Boolean(row.cf_stream_ready && row.cf_stream_playback_url),
      using_r2: Boolean(row.r2_path),
    }));

    return NextResponse.json(enriched);
  } catch (e) {
    console.error("GET /api/uploads error:", e);
    return NextResponse.json(
      { error: "No se pudieron cargar los archivos" },
      { status: 500 }
    );
  }
}

