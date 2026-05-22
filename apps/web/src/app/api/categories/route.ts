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

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.slug,
        c.label,
        c.description,
        c.cover,
        c.is_active,
        c.sort_order,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', s.id,
              'label', s.label,
              'is_active', s.is_active,
              'sort_order', s.sort_order
            )
            ORDER BY s.sort_order ASC, s.label ASC
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS subcategories
      FROM categories c
      LEFT JOIN subcategories s
        ON s.category_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.label ASC;
    `);

    return NextResponse.json({ categories: rows });
  } catch (e) {
    console.error("GET /api/categories error:", e);
    return NextResponse.json(
      { error: "No se pudieron cargar las categorías" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const label = String(body.label || "").trim();
    const description = String(body.description || "").trim();
    const cover = String(body.cover || "").trim();

    if (!label) {
      return NextResponse.json(
        { error: "El nombre de la categoría es obligatorio" },
        { status: 400 }
      );
    }

    const slug = slugify(String(body.slug || label));

    if (!slug) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const { rows: orderRows } = await pool.query(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
      FROM categories
    `);

    const sortOrder = orderRows[0]?.next_order || 1;

    const { rows } = await pool.query(
      `
      INSERT INTO categories (
        slug,
        label,
        description,
        cover,
        is_active,
        sort_order
      )
      VALUES ($1, $2, $3, $4, true, $5)
      RETURNING id, slug, label, description, cover, is_active, sort_order
      `,
      [slug, label, description, cover || null, sortOrder]
    );

    return NextResponse.json({ category: rows[0] }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/categories error:", e);

    if (e?.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese slug" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo crear la categoría" },
      { status: 500 }
    );
  }
}