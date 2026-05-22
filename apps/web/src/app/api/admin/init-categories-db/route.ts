import { NextResponse } from "next/server";
import pool from "@/db";

export async function GET() {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL UNIQUE,
        label text NOT NULL,
        description text,
        cover text,
        is_active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        label text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await pool.query(`
      INSERT INTO categories (slug, label, description, cover, is_active, sort_order)
      VALUES
        ('publicidad', 'Publicidad', 'Piezas y campañas publicitarias.', '/Publicidad.avif', true, 1),
        ('entretenimiento', 'Entretenimiento', 'Contenido y piezas de entretenimiento.', '/babybandito2.jpg', true, 2),
        ('vxf', 'Corporativo', 'Contenido corporativo, institucional y nuevos negocios.', '/Garage.jpg', true, 3),
        ('ia', 'IA', 'Contenido generado, asistido o procesado con inteligencia artificial.', '/service-7.jpg', true, 4)
      ON CONFLICT (slug) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        cover = EXCLUDED.cover,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order
    `);

    await pool.query(`
      INSERT INTO subcategories (category_id, label, is_active, sort_order)
      SELECT c.id, x.label, true, x.sort_order
      FROM categories c
      JOIN (
        VALUES
          ('publicidad', 'Marca', 1),
          ('publicidad', 'Agencia', 2),
          ('publicidad', 'Productora', 3),
          ('publicidad', 'Contacto', 4),
          ('publicidad', 'Oficina', 5),
          ('publicidad', 'Tipo', 6),

          ('entretenimiento', 'Estudio', 1),
          ('entretenimiento', 'Productora', 2),
          ('entretenimiento', 'Director', 3),
          ('entretenimiento', 'Productor', 4),
          ('entretenimiento', 'Oficina', 5),
          ('entretenimiento', 'Tipo', 6),

          ('vxf', 'Producción', 1),
          ('vxf', 'Corporativo', 2),
          ('vxf', 'Nuevos Negocios', 3),

          ('ia', 'Generativo', 1),
          ('ia', 'Edición IA', 2),
          ('ia', 'Video IA', 3),
          ('ia', 'Imagen IA', 4),
          ('ia', 'Audio IA', 5)
      ) AS x(slug, label, sort_order)
        ON x.slug = c.slug
      WHERE NOT EXISTS (
        SELECT 1
        FROM subcategories s
        WHERE s.category_id = c.id
          AND LOWER(s.label) = LOWER(x.label)
      )
    `);

    return NextResponse.json({
      ok: true,
      message: "Tablas y categorías base creadas",
    });
  } catch (err) {
    console.error("init categories db error:", err);
    return NextResponse.json({ ok: false, error: "Error creando categorías" }, { status: 500 });
  }
}