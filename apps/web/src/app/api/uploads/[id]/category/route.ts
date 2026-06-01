import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

function getRoleFromReq(req: Request) {
  const cookie = (req.headers.get("cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("auth="));

  const raw = cookie?.split("=")?.[1];
  if (!raw) return null;

  const token = decodeURIComponent(raw);
  const payload = jwt.verify(token, JWT_SECRET) as any;

  return String(payload.role || "").trim().toUpperCase();
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = getRoleFromReq(req);

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