import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

type AuthUser = {
  id: string;
  role: string;
};

type JwtPayload = {
  id?: string;
  sub?: string;
  userId?: string;
  role?: string;
};

type ResourceType =
  | "CATEGORY"
  | "SUBCATEGORY"
  | "UPLOAD";

type AccessLevel =
  | "VIEWER"
  | "APPROVER"
  | "EDITOR";

function getAuthenticatedUser(
  req: Request
): AuthUser | null {
  try {
    const cookie =
      (req.headers.get("cookie") || "")
        .split(";")
        .map((value) => value.trim())
        .find((value) =>
          value.startsWith("auth=")
        );

    const rawToken =
      cookie?.slice("auth=".length);

    if (!rawToken) {
      return null;
    }

    const token =
      decodeURIComponent(rawToken);

    const payload = jwt.verify(
      token,
      JWT_SECRET
    ) as JwtPayload;

    const id =
      payload.id ??
      payload.sub ??
      payload.userId ??
      null;

    if (!id) {
      return null;
    }

    return {
      id: String(id),

      role: String(
        payload.role ?? ""
      )
        .trim()
        .toUpperCase(),
    };
  } catch {
    return null;
  }
}

function requireSuperAdmin(
  req: Request
) {
  const currentUser =
    getAuthenticatedUser(req);

  if (!currentUser) {
    return {
      currentUser: null,
      error: NextResponse.json(
        {
          error: "No autorizado",
        },
        {
          status: 401,
        }
      ),
    };
  }

  if (
    currentUser.role !==
    "SUPER_ADMIN"
  ) {
    return {
      currentUser: null,
      error: NextResponse.json(
        {
          error: "No autorizado",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    currentUser,
    error: null,
  };
}

function normalizeResourceType(
  value: unknown
): ResourceType | null {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    normalized === "CATEGORY" ||
    normalized === "SUBCATEGORY" ||
    normalized === "UPLOAD"
  ) {
    return normalized;
  }

  return null;
}

function normalizeAccessLevel(
  value: unknown
): AccessLevel {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    normalized === "APPROVER" ||
    normalized === "EDITOR" ||
    normalized === "VIEWER"
  ) {
    return normalized;
  }

  return "VIEWER";
}

async function groupExists(
  groupId: string
) {
  const result =
    await pool.query(
      `
      SELECT id
      FROM user_groups
      WHERE id::text = $1::text
      LIMIT 1
      `,
      [groupId]
    );

  return Boolean(
    result.rowCount
  );
}

async function resourceExists(
  resourceType: ResourceType,
  resourceId: string
) {
  if (
    resourceType === "CATEGORY"
  ) {
    const result =
      await pool.query(
        `
        SELECT id
        FROM categories
        WHERE id::text = $1::text
        LIMIT 1
        `,
        [resourceId]
      );

    return Boolean(
      result.rowCount
    );
  }

  if (
    resourceType ===
    "SUBCATEGORY"
  ) {
    const result =
      await pool.query(
        `
        SELECT id
        FROM subcategories
        WHERE id::text = $1::text
        LIMIT 1
        `,
        [resourceId]
      );

    return Boolean(
      result.rowCount
    );
  }

  const result =
    await pool.query(
      `
      SELECT id
      FROM uploads
      WHERE
        id::text = $1::text
        AND is_deleted IS NOT TRUE
      LIMIT 1
      `,
      [resourceId]
    );

  return Boolean(
    result.rowCount
  );
}

/* =========================================================
   LISTAR PERMISOS DEL GRUPO
========================================================= */

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const auth =
    requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  const { id: groupId } =
    await context.params;

  try {
    if (
      !(await groupExists(groupId))
    ) {
      return NextResponse.json(
        {
          error:
            "Grupo no encontrado",
        },
        {
          status: 404,
        }
      );
    }

    const rules =
      await pool.query(
        `
        SELECT
          rule.id::text AS id,
          rule.resource_type,
          rule.resource_id,
          rule.access_level,
          rule.created_at,
          rule.updated_at,

          CASE
            WHEN
              rule.resource_type =
                'CATEGORY'
            THEN category_target.label

            WHEN
              rule.resource_type =
                'SUBCATEGORY'
            THEN subcategory_target.label

            WHEN
              rule.resource_type =
                'UPLOAD'
            THEN COALESCE(
              NULLIF(
                ficha_target.titulo,
                ''
              ),
              upload_target.file_name,
              rule.resource_id
            )

            ELSE
              rule.resource_id
          END AS resource_name,

          category_target.slug
            AS category_slug,

          parent_category.id::text
            AS parent_category_id,

          parent_category.label
            AS parent_category_label

        FROM access_rules rule

        LEFT JOIN categories
          category_target
          ON
            rule.resource_type =
              'CATEGORY'
            AND
            category_target.id::text =
              rule.resource_id

        LEFT JOIN subcategories
          subcategory_target
          ON
            rule.resource_type =
              'SUBCATEGORY'
            AND
            subcategory_target.id::text =
              rule.resource_id

        LEFT JOIN categories
          parent_category
          ON
            subcategory_target.category_id =
              parent_category.id

        LEFT JOIN uploads
          upload_target
          ON
            rule.resource_type =
              'UPLOAD'
            AND
            upload_target.id::text =
              rule.resource_id

        LEFT JOIN ficha_tecnica
          ficha_target
          ON
            upload_target.id::text =
              ficha_target.upload_id::text

        WHERE
          rule.target_type =
            'GROUP'

          AND
          rule.target_id =
            $1::text

        ORDER BY
          CASE
            WHEN
              rule.resource_type =
                'CATEGORY'
              THEN 1

            WHEN
              rule.resource_type =
                'SUBCATEGORY'
              THEN 2

            ELSE 3
          END,

          resource_name ASC
        `,
        [groupId]
      );

    const categories =
      rules.rows.filter(
        (rule) =>
          rule.resource_type ===
          "CATEGORY"
      );

    const subcategories =
      rules.rows.filter(
        (rule) =>
          rule.resource_type ===
          "SUBCATEGORY"
      );

    const uploads =
      rules.rows.filter(
        (rule) =>
          rule.resource_type ===
          "UPLOAD"
      );

    return NextResponse.json(
      {
        groupId,
        rows: rules.rows,
        categories,
        subcategories,
        uploads,
        total:
          rules.rows.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/user-groups/[id]/permissions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los permisos del grupo",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   AGREGAR / ACTUALIZAR PERMISO
========================================================= */

export async function POST(
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const auth =
    requireSuperAdmin(req);

  if (
    auth.error ||
    !auth.currentUser
  ) {
    return auth.error;
  }

  const { id: groupId } =
    await context.params;

  try {
    if (
      !(await groupExists(groupId))
    ) {
      return NextResponse.json(
        {
          error:
            "Grupo no encontrado",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await req
        .json()
        .catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          error:
            "Body inválido",
        },
        {
          status: 400,
        }
      );
    }

    const resourceType =
      normalizeResourceType(
        body.resourceType
      );

    const resourceId =
      String(
        body.resourceId || ""
      ).trim();

    const accessLevel =
      normalizeAccessLevel(
        body.accessLevel
      );

    if (!resourceType) {
      return NextResponse.json(
        {
          error:
            "Tipo de recurso inválido",
        },
        {
          status: 400,
        }
      );
    }

    if (!resourceId) {
      return NextResponse.json(
        {
          error:
            "Debes indicar el recurso",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !(
        await resourceExists(
          resourceType,
          resourceId
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "El recurso seleccionado no existe",
        },
        {
          status: 404,
        }
      );
    }

    const result =
      await pool.query(
        `
        INSERT INTO access_rules
          (
            target_type,
            target_id,
            resource_type,
            resource_id,
            access_level,
            assigned_by_id,
            created_at,
            updated_at
          )

        VALUES
          (
            'GROUP',
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW(),
            NOW()
          )

        ON CONFLICT
          (
            target_type,
            target_id,
            resource_type,
            resource_id
          )

        DO UPDATE SET
          access_level =
            EXCLUDED.access_level,

          assigned_by_id =
            EXCLUDED.assigned_by_id,

          updated_at =
            NOW()

        RETURNING
          id::text,
          target_type,
          target_id,
          resource_type,
          resource_id,
          access_level,
          created_at,
          updated_at
        `,
        [
          groupId,
          resourceType,
          resourceId,
          accessLevel,
          auth.currentUser.id,
        ]
      );

    return NextResponse.json(
      {
        ok: true,
        rule:
          result.rows[0],
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "POST /api/user-groups/[id]/permissions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo guardar el permiso",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   ELIMINAR PERMISO
========================================================= */

export async function DELETE(
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const auth =
    requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  const { id: groupId } =
    await context.params;

  try {
    const body =
      await req
        .json()
        .catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          error:
            "Body inválido",
        },
        {
          status: 400,
        }
      );
    }

    const resourceType =
      normalizeResourceType(
        body.resourceType
      );

    const resourceId =
      String(
        body.resourceId || ""
      ).trim();

    if (
      !resourceType ||
      !resourceId
    ) {
      return NextResponse.json(
        {
          error:
            "Debes indicar el permiso que deseas eliminar",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await pool.query(
        `
        DELETE FROM access_rules

        WHERE
          target_type =
            'GROUP'

          AND
          target_id =
            $1::text

          AND
          resource_type =
            $2::text

          AND
          resource_id =
            $3::text
        `,
        [
          groupId,
          resourceType,
          resourceId,
        ]
      );

    return NextResponse.json(
      {
        ok: true,
        removedCount:
          result.rowCount ?? 0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "DELETE /api/user-groups/[id]/permissions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo eliminar el permiso",
      },
      {
        status: 500,
      }
    );
  }
}