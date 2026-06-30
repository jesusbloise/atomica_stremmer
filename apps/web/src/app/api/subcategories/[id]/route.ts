import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const client = await pool.connect();

  try {
    const body = await req.json();
    const label = String(body.label || "").trim();

    if (!label) {
      return NextResponse.json(
        { error: "El nombre de la subcategoría es obligatorio" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const currentRes = await client.query(
      `
      SELECT 
        s.id,
        s.label AS old_label,
        s.category_id,
        c.slug AS category_slug
      FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      WHERE s.id = $1
      FOR UPDATE
      `,
      [id]
    );

    const current = currentRes.rows[0];

    if (!current) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "Subcategoría no encontrada" },
        { status: 404 }
      );
    }

    const updatedRes = await client.query(
      `
      UPDATE subcategories
      SET label = $1
      WHERE id = $2
      RETURNING id, label, is_active, sort_order
      `,
      [label, id]
    );

    await client.query(
      `
      UPDATE uploads
      SET subcategory = $1
      WHERE subcategory = $2
        AND category = $3
      `,
      [label, current.old_label, current.category_slug]
    );

    await client.query("COMMIT");

    return NextResponse.json({ subcategory: updatedRes.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PATCH /api/subcategories/[id] error:", e);

    return NextResponse.json(
      { error: "No se pudo actualizar la subcategoría" },
      { status: 500 }
    );
  } finally {
    client.release();
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
