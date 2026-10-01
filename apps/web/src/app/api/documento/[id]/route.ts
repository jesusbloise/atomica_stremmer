import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type UploadAccessRow = {
  visibility: "PUBLIC" | "RESTRICTED";
  created_by_id: string | null;
  is_assigned: boolean;
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const session = getSessionFromRequest(req);

  const currentUser = session
    ? {
        id: String(session.id ?? session.sub),
        role: String(session.role ?? "").trim().toUpperCase(),
      }
    : null;

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  try {
    const accessQuery = await pool.query<UploadAccessRow>(
      `
      SELECT
        COALESCE(u.visibility, 'PUBLIC') AS visibility,
        u.created_by_id,
        (
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
        ) AS is_assigned
      FROM uploads u
      WHERE
        u.id::text = $1::text
        AND u.is_deleted IS NOT TRUE
      LIMIT 1
      `,
      [id, currentUser.id]
    );

    const access = accessQuery.rows[0];

    if (!access) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const isOwner =
      access.created_by_id?.toString() === currentUser.id.toString();

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

    const result = await pool.query(
      `
      SELECT *
      FROM documentos_texto
      WHERE upload_id::text = $1::text
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { documento: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      documento: result.rows[0],
    });
  } catch (error) {
    console.error("Error al obtener documento:", error);

    return NextResponse.json(
      { error: "Error al obtener documento" },
      { status: 500 }
    );
  }
}
