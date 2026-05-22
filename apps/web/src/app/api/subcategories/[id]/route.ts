import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
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

    const { rows } = await pool.query(
      `
      UPDATE subcategories
      SET label = $1
      WHERE id = $2
      RETURNING id, label, is_active, sort_order
      `,
      [label, id]
    );

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Subcategoría no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ subcategory: rows[0] });
  } catch (e) {
    console.error("PATCH /api/subcategories/[id] error:", e);

    return NextResponse.json(
      { error: "No se pudo actualizar la subcategoría" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const { rows } = await pool.query(
      `
      DELETE FROM subcategories
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Subcategoría no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/subcategories/[id] error:", e);

    return NextResponse.json(
      { error: "No se pudo eliminar la subcategoría" },
      { status: 500 }
    );
  }
}
