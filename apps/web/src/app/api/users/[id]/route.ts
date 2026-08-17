import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

const ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "USUARIO",
]);

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

function getAuthenticatedUser(
  req: Request
): AuthUser | null {
  try {
    const cookie = (
      req.headers.get("cookie") || ""
    )
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

function requireSuperAdmin(req: Request) {
  const currentUser =
    getAuthenticatedUser(req);

  if (!currentUser) {
    return {
      currentUser: null,
      error: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      ),
    };
  }

  if (
    currentUser.role !== "SUPER_ADMIN"
  ) {
    return {
      currentUser: null,
      error: NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      ),
    };
  }

  return {
    currentUser,
    error: null,
  };
}

/* =========================================================
   DETALLE ADMINISTRATIVO DEL USUARIO
========================================================= */

export async function GET(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  const { id: userId } =
    await context.params;

  try {
    const userQuery = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        is_active,
        created_at
      FROM users
      WHERE id::text = $1::text
      LIMIT 1
      `,
      [userId]
    );

    const user = userQuery.rows[0];

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Usuario no encontrado",
        },
        { status: 404 }
      );
    }

    const groupsQuery =
      await pool.query(
        `
        SELECT
          g.id,
          g.name,
          g.slug,
          g.description,
          g.color,
          g.is_active,
          gm.created_at AS membership_created_at
        FROM user_group_members gm
        INNER JOIN user_groups g
          ON g.id = gm.group_id
        WHERE gm.user_id::text = $1::text
        ORDER BY
          g.is_active DESC,
          g.name ASC
        `,
        [userId]
      );

    const uploadsQuery =
      await pool.query(
        `
        SELECT
          u.id,
          u.file_name,
          COALESCE(
            NULLIF(ft.titulo, ''),
            u.file_name
          ) AS display_name,
          u.tipo,
          u.category,
          u.subcategory,
          COALESCE(
            u.visibility,
            'PUBLIC'
          ) AS visibility,
          COALESCE(u.views, 0)::int
            AS views,
          u.thumbnail_url,
          u.uploaded_at,
          u.cf_stream_ready,
          COUNT(
            DISTINCT access_user.user_id
          )::int AS shared_people_count,

          COALESCE(
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'id',
                recipient.id,
                'name',
                recipient.name,
                'email',
                recipient.email,
                'accessLevel',
                access_user.access_level,
                'approvalDecision',
                access_user.approval_decision,
                'assignedById',
                access_user.assigned_by_id
              )
            ) FILTER (
              WHERE recipient.id IS NOT NULL
            ),
            '[]'::json
          ) AS shared_with

        FROM uploads u

        LEFT JOIN ficha_tecnica ft
          ON ft.upload_id::text =
             u.id::text

        LEFT JOIN upload_access_users
          access_user
          ON access_user.upload_id::text =
             u.id::text

        LEFT JOIN users recipient
          ON recipient.id::text =
             access_user.user_id::text

        WHERE
          u.created_by_id::text =
            $1::text
          AND u.is_deleted IS NOT TRUE

        GROUP BY
          u.id,
          u.file_name,
          ft.titulo,
          u.tipo,
          u.category,
          u.subcategory,
          u.visibility,
          u.views,
          u.thumbnail_url,
          u.uploaded_at,
          u.cf_stream_ready

        ORDER BY
          u.uploaded_at DESC NULLS LAST
        `,
        [userId]
      );

    const receivedAccessQuery =
      await pool.query(
        `
        SELECT
          u.id,
          u.file_name,
          COALESCE(
            NULLIF(ft.titulo, ''),
            u.file_name
          ) AS display_name,
          u.tipo,
          u.category,
          u.subcategory,
          COALESCE(
            u.visibility,
            'PUBLIC'
          ) AS visibility,
          u.thumbnail_url,
          u.uploaded_at,

          access_user.access_level,
          access_user.approval_decision,
          access_user.created_at
            AS access_created_at,

          owner.id AS owner_id,
          owner.name AS owner_name,
          owner.email AS owner_email,

          assigned_by.id
            AS assigned_by_id,
          assigned_by.name
            AS assigned_by_name,
          assigned_by.email
            AS assigned_by_email

        FROM upload_access_users
          access_user

        INNER JOIN uploads u
          ON u.id::text =
             access_user.upload_id::text

        LEFT JOIN ficha_tecnica ft
          ON ft.upload_id::text =
             u.id::text

        LEFT JOIN users owner
          ON owner.id::text =
             u.created_by_id::text

        LEFT JOIN users assigned_by
          ON assigned_by.id::text =
             access_user.assigned_by_id::text

        WHERE
          access_user.user_id::text =
            $1::text
          AND u.is_deleted IS NOT TRUE

        ORDER BY
          access_user.created_at DESC
        `,
        [userId]
      );

    const uploads =
      uploadsQuery.rows;

    const totalUploads =
      uploads.length;

    const publicUploads =
      uploads.filter(
        (upload) =>
          upload.visibility === "PUBLIC"
      ).length;

    const restrictedUploads =
      uploads.filter(
        (upload) =>
          upload.visibility ===
          "RESTRICTED"
      ).length;

    const totalPeopleShared =
      uploads.reduce(
        (sum, upload) =>
          sum +
          Number(
            upload.shared_people_count ||
              0
          ),
        0
      );

    return NextResponse.json(
      {
        user,

        stats: {
          totalUploads,
          publicUploads,
          restrictedUploads,
          receivedAccessCount:
            receivedAccessQuery.rows
              .length,
          totalPeopleShared,
          groupCount:
            groupsQuery.rows.length,
        },

        groups: groupsQuery.rows,
        uploads,
        receivedAccess:
          receivedAccessQuery.rows,
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
      "GET /api/users/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo cargar el detalle del usuario",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   ACTUALIZAR ROL O ESTADO
========================================================= */

export async function PATCH(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const { id } =
      await context.params;

    const body = await req.json();

    const updates: string[] = [];
    const values: Array<
      string | boolean
    > = [];

    let parameterIndex = 1;

    if (
      typeof body.is_active ===
      "boolean"
    ) {
      updates.push(
        `is_active = $${parameterIndex++}`
      );

      values.push(body.is_active);
    }

    if (
      typeof body.role === "string"
    ) {
      const role = body.role
        .trim()
        .toUpperCase();

      if (!ROLES.has(role)) {
        return NextResponse.json(
          { error: "Rol inválido" },
          { status: 400 }
        );
      }

      updates.push(
        `role = $${parameterIndex++}`
      );

      values.push(role);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nada para actualizar",
        },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await pool.query(
      `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id::text =
        $${parameterIndex}::text
      RETURNING
        id,
        name,
        email,
        role,
        is_active,
        created_at
      `,
      values
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { error: "No existe" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      result.rows[0],
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "PATCH /api/users/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo actualizar el usuario",
      },
      { status: 500 }
    );
  }
}