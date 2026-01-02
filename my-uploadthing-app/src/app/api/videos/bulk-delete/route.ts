// src/app/api/videos/bulk-delete/route.ts
import { NextResponse } from "next/server";
import db from "@/db";

// Body aceptado: { ids: string[] } o { ids: "a,b,c" }
type BulkDeleteBody = { ids: string[] | string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<BulkDeleteBody>;

    let ids: string[] = [];

    if (Array.isArray(body.ids)) {
      // Aseguramos strings
      ids = (body.ids as unknown[])
        .map((x: unknown) => String(x))
        .filter((x: string) => Boolean(x));
    } else if (typeof body.ids === "string") {
      ids = (body.ids as string)
        .split(",")
        .map((s: string) => s.trim())      // 👈 tipado explícito (evita ts(7006))
        .filter((s: string) => s.length > 0);
    } else {
      return NextResponse.json({ ok: false, error: "ids vacíos" }, { status: 400 });
    }

    // Quitar duplicados
    ids = Array.from(new Set(ids));
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids vacíos" }, { status: 400 });
    }

    // id es TEXT -> castear a text[]
    const { rowCount } = await db.query(
      `UPDATE uploads
         SET is_deleted = true, deleted_at = NOW()
       WHERE id = ANY($1::text[]) AND is_deleted = false`,
      [ids]
    );

    return NextResponse.json({ ok: true, count: rowCount ?? 0 });
  } catch (e: any) {
    console.error("❌ bulk-delete error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }
}
