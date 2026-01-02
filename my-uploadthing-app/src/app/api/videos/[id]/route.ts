// src/app/api/videos/[id]/route.ts
import { NextResponse } from "next/server";
import db from "@/db";

type Ctx<T extends Record<string, string>> = { params: Promise<T> };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, context: Ctx<{ id: string }>) {
  const { id } = await context.params;
  const { rows } = await db.query(
    `SELECT id, file_name, file_key
     FROM uploads
     WHERE id = $1 AND (is_deleted IS NOT TRUE)
     LIMIT 1`, [id]
  );
  if (!rows.length) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  const base = process.env.MINIO_PUBLIC_BASE ?? "http://192.168.229.25:9100/archivos";
  const row = rows[0];
  return NextResponse.json({ id: row.id, name: row.file_name, key: row.file_key, url: `${base}/${row.file_key}` });
}

export async function DELETE(_req: Request, context: Ctx<{ id: string }>) {
  const { id } = await context.params;
  const { rowCount } = await db.query(
    `UPDATE uploads
     SET is_deleted = TRUE, deleted_at = NOW()
     WHERE id = $1 AND (is_deleted IS NOT TRUE)`, [id]
  );
  if (rowCount === 0) {
    return NextResponse.json({ ok: false, message: "No encontrado o ya eliminado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
