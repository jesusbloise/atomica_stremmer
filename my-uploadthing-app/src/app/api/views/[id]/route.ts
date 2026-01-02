// src/app/api/views/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ usar await

  try {
    const result = await pool.query(
      "UPDATE uploads SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING views",
      [id]
    );

    return NextResponse.json({ views: result.rows[0]?.views ?? 0 });
  } catch (error) {
    console.error("Error al actualizar views:", error);
    return NextResponse.json(
      { error: "Error al actualizar las visualizaciones" },
      { status: 500 }
    );
  }
}
