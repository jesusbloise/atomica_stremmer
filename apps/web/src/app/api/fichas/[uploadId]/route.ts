import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Payload = {
  titulo?: string | null;

  marca?: string | null;
  agencia?: string | null;
  productora?: string | null;
  contacto?: string | null;

  oficina?: "Chile" | "Mexico" | null;
  tipo?: string[] | string | null;

  estudio?: string | null;
  director?: string | null;
  productor?: string | null;

  produccion?: string | null;
  corporativo?: string | null;
  nuevosNegocios?: string | null;
  otros?: string | null;

  duracion?: string | null;
  formato?: string | null;
  version?: string | null;
  fecha?: string | null;
};

function normString(v: any) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normTipo(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  return [];
}

/* ====================== GET ficha ====================== */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await ctx.params;
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  const currentUser = {
    id: String(session.id ?? session.sub),
    role: String(session.role ?? "").trim().toUpperCase(),
  };

  try {
    const accessQuery = await pool.query(
      `
      SELECT
        COALESCE(u.visibility, 'PUBLIC') AS visibility,
        u.created_by_id,
        CASE
          WHEN $2::text IS NULL THEN FALSE
          ELSE (
            EXISTS (
              SELECT 1
              FROM upload_permissions permission
              WHERE
                permission.upload_id = u.id::text
                AND permission.target_type = 'USER'
                AND permission.target_id = $2::text
            )

            OR EXISTS (
              SELECT 1
              FROM upload_permissions permission
              INNER JOIN user_group_members gm
                ON gm.group_id::text = permission.target_id
              WHERE
                permission.upload_id = u.id::text
                AND permission.target_type = 'GROUP'
                AND gm.user_id::text = $2::text
            )

            OR EXISTS (
              SELECT 1
              FROM access_rules rule
              INNER JOIN user_group_members gm
                ON gm.group_id::text = rule.target_id::text
              WHERE
                rule.target_type = 'GROUP'
                AND gm.user_id::text = $2::text
                AND (
                  (
                    rule.resource_type = 'UPLOAD'
                    AND rule.resource_id::text = u.id::text
                  )

                  OR (
                    rule.resource_type = 'CATEGORY'
                    AND EXISTS (
                      SELECT 1
                      FROM categories category_rule
                      WHERE
                        category_rule.id::text = rule.resource_id::text
                        AND LOWER(category_rule.slug) =
                          LOWER(COALESCE(u.category, ''))
                    )
                  )

                  OR (
                    rule.resource_type = 'SUBCATEGORY'
                    AND EXISTS (
                      SELECT 1
                      FROM subcategories subcategory_rule
                      WHERE
                        subcategory_rule.id::text = rule.resource_id::text
                        AND LOWER(BTRIM(subcategory_rule.label)) =
                          LOWER(BTRIM(COALESCE(u.subcategory, '')))
                    )
                  )
                )
            )
          )
        END AS is_assigned
      FROM uploads u
      WHERE
        u.id::text = $1::text
        AND u.is_deleted IS NOT TRUE
      LIMIT 1
      `,
      [uploadId, currentUser.id]
    );

    const access = accessQuery.rows[0];

    if (!access) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const isOwner =
      access.created_by_id?.toString() === currentUser.id;

    const isSuperAdmin =
      currentUser.role === "SUPER_ADMIN";

    const canView =
      access.visibility === "PUBLIC" ||
      isOwner ||
      isSuperAdmin ||
      access.is_assigned;

    if (!canView) {
      return NextResponse.json(
        { error: "No tienes permiso para ver este archivo" },
        { status: 403 }
      );
    }

    const q = await pool.query(
      `
      SELECT
        upload_id,
        titulo,
        marca, agencia, productora, contacto,
        oficina,
        tipo,
        estudio, director, productor,
        produccion, corporativo,
        nuevos_negocios,
        otros,
duracion,
formato,
version,
fecha
      FROM ficha_tecnica
      WHERE upload_id = $1
      LIMIT 1
      `,
      [uploadId]
    );

    if (q.rowCount === 0) {
      return NextResponse.json({ ficha: null }, { status: 200 });
    }

    const row = q.rows[0];

    return NextResponse.json(
      {
        ficha: {
          upload_id: row.upload_id,
          titulo: row.titulo ?? null,

          marca: row.marca ?? null,
          agencia: row.agencia ?? null,
          productora: row.productora ?? null,
          contacto: row.contacto ?? null,

          oficina: row.oficina ?? null,
          tipo: Array.isArray(row.tipo) ? row.tipo : [],

          estudio: row.estudio ?? null,
          director: row.director ?? null,
          productor: row.productor ?? null,

          produccion: row.produccion ?? null,
          corporativo: row.corporativo ?? null,
          nuevosNegocios: row.nuevos_negocios ?? null,
          otros: row.otros ?? null,
          duracion: row.duracion ?? null,
          formato: row.formato ?? null,
          version: row.version ?? null,
          fecha: row.fecha ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("GET /api/fichas/[uploadId] error:", e);
    return NextResponse.json({ error: "Error al obtener ficha" }, { status: 500 });
  }
}

/* ====================== PUT (upsert) ficha ====================== */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await ctx.params;
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  const role = String(session.role ?? "").trim().toUpperCase();

  const canEdit =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "PROFESOR";

  if (!canEdit) {
    return NextResponse.json(
      { error: "No tienes permiso para editar esta ficha" },
      { status: 403 }
    );
  }

  try {
    let body: Payload;

try {
  body = (await req.json()) as Payload;
} catch {
  return NextResponse.json(
    { error: "JSON inválido. No se guardó la ficha." },
    { status: 400 }
  );
}

    const payload = {
      titulo: normString(body.titulo),

      marca: normString(body.marca),
      agencia: normString(body.agencia),
      productora: normString(body.productora),
      contacto: normString(body.contacto),

      oficina: normString(body.oficina),
      tipo: normTipo(body.tipo), // SIEMPRE array

      estudio: normString(body.estudio),
      director: normString(body.director),
      productor: normString(body.productor),

      produccion: normString(body.produccion),
      corporativo: normString(body.corporativo),
      nuevos_negocios: normString(body.nuevosNegocios),
      otros: normString(body.otros),
      duracion: normString(body.duracion),
formato: normString(body.formato),
version: normString(body.version),
fecha: normString(body.fecha),
    };

    // tipo es text[] en tu DB -> usamos $8::text[]
    await pool.query(
      `
      INSERT INTO ficha_tecnica (
        upload_id,
        titulo,
        marca, agencia, productora, contacto,
        oficina,
        tipo,
        estudio, director, productor,
        produccion, corporativo,
        nuevos_negocios,
otros,
duracion,
formato,
version,
fecha
      )
      VALUES (
        $1,
        $2,
        $3, $4, $5, $6,
        $7,
        $8::text[],
        $9, $10, $11,
        $12, $13,
        $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (upload_id) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        marca = EXCLUDED.marca,
        agencia = EXCLUDED.agencia,
        productora = EXCLUDED.productora,
        contacto = EXCLUDED.contacto,
        oficina = EXCLUDED.oficina,
        tipo = EXCLUDED.tipo,
        estudio = EXCLUDED.estudio,
        director = EXCLUDED.director,
        productor = EXCLUDED.productor,
        produccion = EXCLUDED.produccion,
        corporativo = EXCLUDED.corporativo,
        nuevos_negocios = EXCLUDED.nuevos_negocios,
        otros = EXCLUDED.otros,
        duracion = EXCLUDED.duracion,
formato = EXCLUDED.formato,
version = EXCLUDED.version,
fecha = EXCLUDED.fecha
      `,
      [
        uploadId,
        payload.titulo,
        payload.marca,
        payload.agencia,
        payload.productora,
        payload.contacto,
        payload.oficina,
        payload.tipo, // <- ARRAY directo
        payload.estudio,
        payload.director,
        payload.productor,
        payload.produccion,
        payload.corporativo,
        payload.nuevos_negocios,
        payload.otros,
        payload.duracion,
        payload.formato,
        payload.version,
        payload.fecha
      ]
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("PUT /api/fichas/[uploadId] error:", e);
    return NextResponse.json(
      { error: e?.message || "Error al guardar ficha" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

