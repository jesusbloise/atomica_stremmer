// src/app/api/uploads/ultimos/route.ts
import { NextResponse } from "next/server";
import pool from "@/db";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, file_name, file_key, file_path, tipo, views, uploaded_at
      FROM uploads
      ORDER BY uploaded_at DESC
      LIMIT 12
      `
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ Error en /api/uploads/ultimos:", err);
    return NextResponse.json({ error: "Error cargando videos" }, { status: 500 });
  }
}
