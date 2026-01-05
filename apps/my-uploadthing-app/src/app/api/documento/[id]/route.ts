import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";


export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const result = await pool.query(
      `SELECT * FROM documentos_texto WHERE upload_id = $1 LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ documento: null }, { status: 404 });
    }

    return NextResponse.json({ documento: result.rows[0] });
  } catch (error) {
    console.error("❌ Error al obtener documento:", error);
    return NextResponse.json({ error: "Error al obtener documento" }, { status: 500 });
  }
}
