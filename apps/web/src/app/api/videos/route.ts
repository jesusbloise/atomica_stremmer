import { NextResponse } from "next/server";
import db from "@/db";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RowVideo = {
  id: string;
  file_name: string | null;
  display_name: string | null;
  titulo: string | null;
  file_key: string | null;
  file_path: string | null;
  size_in_bytes: number | null;
  uploaded_at: string | null;
  tipo: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function parseGsUrl(raw?: string | null) {
  if (!raw || !raw.startsWith("gs://")) return null;
  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) return null;

  return {
    bucket: withoutScheme.slice(0, firstSlash),
    objectPath: withoutScheme.slice(firstSlash + 1),
  };
}

async function buildReadableUrl(filePath?: string | null, fileKey?: string | null) {
  if (filePath && /^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  const parsed = parseGsUrl(filePath);
  if (parsed) {
    const [signedUrl] = await storage
      .bucket(parsed.bucket)
      .file(parsed.objectPath)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 6,
      });

    return signedUrl;
  }

  if (fileKey && process.env.GCS_BUCKET) {
    const [signedUrl] = await storage
      .bucket(process.env.GCS_BUCKET)
      .file(fileKey)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 6,
      });

    return signedUrl;
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
        u.size_in_bytes,
        u.uploaded_at,
        u.tipo,
        u.category,
        u.subcategory
      FROM uploads u
      LEFT JOIN ficha_tecnica ft
        ON ft.upload_id::text = u.id::text
      WHERE
        ${whereKind}
        AND (u.is_deleted IS NOT TRUE)
        AND u.file_path IS NOT NULL
      ORDER BY u.uploaded_at DESC NULLS LAST
      LIMIT $1
      `,
      [limit]
    );

    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: await buildReadableUrl(row.file_path, row.file_key),
      }))
    );

    return new NextResponse(JSON.stringify(enriched), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("❌ list videos error:", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}