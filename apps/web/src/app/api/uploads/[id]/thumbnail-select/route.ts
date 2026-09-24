import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import pool from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(req);
    const role = String(session?.role || "").trim().toUpperCase();

    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const thumbnailUrl = String(body?.thumbnail_url || "").trim();
console.log("THUMBNAIL_SELECT_RECEIVED", {
  id,
  thumbnailUrl,
});
   if (!thumbnailUrl || !thumbnailUrl.startsWith("r2://")) {
  return NextResponse.json(
    { error: "thumbnail_url inválida. Debe ser r2://" },
    { status: 400 }
  );
}

    const { rows } = await pool.query(
      `
      UPDATE uploads
      SET thumbnail_url = $1
      WHERE id = $2
      RETURNING id, thumbnail_url
      `,
      [thumbnailUrl, id]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, thumbnail_url: rows[0].thumbnail_url });
  } catch (err) {
    console.error("POST thumbnail-select error:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la portada" },
      { status: 500 }
    );
  }
}