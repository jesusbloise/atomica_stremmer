import { NextResponse } from "next/server";
import db from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RowVideo = {
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

function buildReadableUrl(row: RowVideo) {
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 500)
    : 200;

  const only = (url.searchParams.get("only") || "video").toLowerCase();

  const isExt = (exts: string) =>
    `(u.file_key ~* '\\.(${exts})$' OR u.file_name ~* '\\.(${exts})$')`;

  let whereKind = "TRUE";

  if (only === "video") {
    whereKind = `(u.tipo = 'video' OR ${isExt("mp4|mov|mkv|webm|avi|m4v")})`;
  } else if (only === "documento") {
    whereKind = `(u.tipo = 'documento' OR ${isExt("pdf|docx|doc|txt|md|csv|log|srt|vtt")})`;
  } else if (only === "image") {
    whereKind = `(u.tipo = 'image' OR ${isExt("jpg|jpeg|png|gif|webp|avif")})`;
  } else if (only === "audio") {
    whereKind = `(u.tipo = 'audio' OR ${isExt("mp3|wav|ogg|m4a")})`;
  }

  try {
    const { rows } = await db.query<RowVideo>(
      `
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
      WHERE
        ${whereKind}
        AND (u.is_deleted IS NOT TRUE)
        AND (
          u.r2_path IS NOT NULL
          OR u.cf_stream_playback_url IS NOT NULL
          OR u.file_path IS NOT NULL
        )
      ORDER BY u.uploaded_at DESC NULLS LAST
      LIMIT $1
      `,
      [limit]
    );

    const enriched = rows.map((row) => ({
      ...row,
      url: buildReadableUrl(row),
      using_cloudflare_stream: Boolean(row.cf_stream_ready && row.cf_stream_playback_url),
      using_r2: Boolean(row.r2_path),
    }));

    return new NextResponse(JSON.stringify(enriched), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("API_VIDEOS_ERROR", e);

    return NextResponse.json(
      { error: "No se pudieron cargar los videos" },
      { status: 500 }
    );
  }
}

