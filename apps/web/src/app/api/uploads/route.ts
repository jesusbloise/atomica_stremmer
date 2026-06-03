import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RowUpload = {
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
  thumbnail_url?: string | null;
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

    const sql = `
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
        u.subcategory,
        u.thumbnail_url
      FROM uploads u
      LEFT JOIN ficha_tecnica ft
        ON ft.upload_id::text = u.id::text
      WHERE ${where.join(" AND ")}
      ORDER BY u.uploaded_at DESC
      LIMIT $${i}
    `;

    params.push(limit);

    const { rows } = await pool.query<RowUpload>(sql, params);

    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: await buildReadableUrl(row.file_path, row.file_key),
      }))
    );

    return NextResponse.json(enriched);
  } catch (e) {
    console.error("GET /api/uploads error:", e);
    return NextResponse.json(
      { error: "No se pudieron cargar los archivos" },
      { status: 500 }
    );
  }
}