import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await req.json();

    const label = String(body.label || "").trim();
    const description = String(body.description || "").trim();
    const cover = String(body.cover || "").trim();
    const slug = slugify(String(body.slug || label));

    if (!label) {
      return NextResponse.json(
        { error: "El nombre de la categoría es obligatorio" },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Slug inválido" },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `
      UPDATE categories
      SET
        label = $1,
        slug = $2,
        description = $3,
        cover = $4
      WHERE id = $5
      RETURNING id, slug, label, description, cover, is_active, sort_order
      `,
      [label, slug, description, cover || null, id]
    );

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ category: rows[0] });
  } catch (e: any) {
    console.error("PATCH /api/categories/[id] error:", e);

    if (e?.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese slug" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo actualizar la categoría" },
      { status: 500 }
    );
  }
  
}
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM subcategories
      WHERE category_id = $1
      `,
      [id]
    );

    const { rows } = await client.query(
      `
      DELETE FROM categories
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!rows[0]) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");

    console.error("DELETE /api/categories/[id] error:", e);

    return NextResponse.json(
      { error: "No se pudo eliminar la categoría" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}