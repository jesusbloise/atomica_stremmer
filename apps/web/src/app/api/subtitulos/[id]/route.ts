export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import pool from "@/db";

type Ctx<T extends Record<string, string>> = {
  params: Promise<T>;
};

type SubtitleRow = {
  id: number;
  video_id: string | null;
  time_start: number | null;
  time_end: number | null;
  text: string | null;
};

type AuthUser = {
  id: string;
  role: string;
};

type UploadAccessRow = {
  visibility: "PUBLIC" | "RESTRICTED";
  created_by_id: string | null;
  is_assigned: boolean;
};

async function getUploadAccess(
  uploadId: string,
  currentUser: AuthUser
): Promise<UploadAccessRow | null> {
  const result = await pool.query<UploadAccessRow>(
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

  return result.rows[0] ?? null;
}

function canViewUpload(
  upload: UploadAccessRow,
  currentUser: AuthUser
) {
  const isOwner =
    upload.created_by_id?.toString() ===
    currentUser.id.toString();

  const isSuperAdmin =
    currentUser.role === "SUPER_ADMIN";

  return (
    upload.visibility === "PUBLIC" ||
    isOwner ||
    isSuperAdmin ||
    upload.is_assigned
  );
}

export async function GET(
  req: Request,
  context: Ctx<{ id: string }>
) {
  const session = getSessionFromRequest(req);

  const currentUser = session
    ? {
        id: String(session.id ?? session.sub),
        role: String(session.role ?? "").trim().toUpperCase(),
      }
    : null;

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const upload = await getUploadAccess(id, currentUser);

    if (!upload) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    if (!canViewUpload(upload, currentUser)) {
      return NextResponse.json(
        { error: "No tienes permiso para ver este archivo" },
        { status: 403 }
      );
    }

    const result = await pool.query<SubtitleRow>(
      `
      SELECT
        id,
        video_id,
        time_start,
        time_end,
        text
      FROM video_subtitulos
      WHERE video_id = $1
      ORDER BY time_start ASC, id ASC
      `,
      [id]
    );

    return NextResponse.json(
      result.rows,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/subtitulos/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los subtítulos",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: Ctx<{ id: string }>
) {
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

  if (
    currentUser.role !== "SUPER_ADMIN" &&
    currentUser.role !== "ADMIN"
  ) {
    return NextResponse.json(
      {
        error:
          "No tienes permiso para editar la transcripción",
      },
      { status: 403 }
    );
  }

  const { id: videoId } = await context.params;

  try {
    const body = await req.json();

    const subtitleId = Number(body?.subtitleId);
    const text = String(body?.text ?? "").trim();

    if (
      !Number.isInteger(subtitleId) ||
      subtitleId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "El identificador del subtítulo es inválido",
        },
        { status: 400 }
      );
    }

    if (!text) {
      return NextResponse.json(
        {
          error:
            "El texto del subtítulo no puede quedar vacío",
        },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        {
          error:
            "El texto del subtítulo es demasiado largo",
        },
        { status: 400 }
      );
    }

    const result = await pool.query<SubtitleRow>(
      `
      UPDATE video_subtitulos
      SET text = $1
      WHERE
        id = $2
        AND video_id = $3
      RETURNING
        id,
        video_id,
        time_start,
        time_end,
        text
      `,
      [
        text,
        subtitleId,
        videoId,
      ]
    );

    const updatedSubtitle = result.rows[0];

    if (!updatedSubtitle) {
      return NextResponse.json(
        {
          error:
            "La línea no existe o no pertenece a este video",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        subtitle: updatedSubtitle,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "PATCH /api/subtitulos/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo actualizar la línea de transcripción",
      },
      { status: 500 }
    );
  }
}