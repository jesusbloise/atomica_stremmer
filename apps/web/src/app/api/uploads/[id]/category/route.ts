import { NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;



export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(req);
    const role = String(session?.role || "").trim().toUpperCase();

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const category = String(body.category || "").trim();
    const subcategory = String(body.subcategory || "").trim();

    if (!category) {
      return NextResponse.json(
        { error: "La categoría es obligatoria" },
        { status: 400 }
      );
    }

    const catRes = await pool.query(
      `
      SELECT id, slug
      FROM categories
      WHERE slug = $1
        AND is_active = true
      LIMIT 1
      `,
      [category]
    );

    const cat = catRes.rows[0];

    if (!cat) {
      return NextResponse.json(
        { error: "Categoría inválida" },
        { status: 400 }
      );
    }

    if (subcategory) {
      const subRes = await pool.query(
        `
        SELECT id
        FROM subcategories
        WHERE category_id = $1
          AND label = $2
          AND is_active = true
        LIMIT 1
        `,
        [cat.id, subcategory]
      );

      if (!subRes.rows[0]) {
        return NextResponse.json(
          { error: "Subcategoría inválida para esta categoría" },
          { status: 400 }
        );
      }
    }

    const updateRes = await pool.query(
      `
      UPDATE uploads
      SET category = $1,
          subcategory = $2
      WHERE id = $3
      RETURNING id, file_name, category, subcategory
      `,
      [category, subcategory || null, id]
    );

    if (!updateRes.rows[0]) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      upload: updateRes.rows[0],
    });
  } catch (err) {
    console.error("PATCH /api/uploads/[id]/category error:", err);

    return NextResponse.json(
      { error: "No se pudo mover el archivo" },
      { status: 500 }
    );
  }
}