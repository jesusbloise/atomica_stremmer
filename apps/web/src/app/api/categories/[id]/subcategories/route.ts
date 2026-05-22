import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await req.json();
    const label = String(body.label || "").trim();

    if (!label) {
      return NextResponse.json(
        { error: "El nombre de la subcategoría es obligatorio" },
        { status: 400 }
      );
    }

    const { rows: orderRows } = await pool.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
      FROM subcategories
      WHERE category_id = $1
      `,
      [id]
    );

    const sortOrder = orderRows[0]?.next_order || 1;

    const { rows } = await pool.query(
      `
      INSERT INTO subcategories (
        category_id,
        label,
        is_active,
        sort_order
      )
      VALUES ($1, $2, true, $3)
      RETURNING id, label, is_active, sort_order
      `,
      [id, label, sortOrder]
    );

    return NextResponse.json({ subcategory: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/categories/[id]/subcategories error:", e);

    return NextResponse.json(
      { error: "No se pudo crear la subcategoría" },
      { status: 500 }
    );
  }
}