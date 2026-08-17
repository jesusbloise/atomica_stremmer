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

type UploadAccessRow = {
  visibility: "PUBLIC" | "RESTRICTED";
  created_by_id: string | null;
  is_assigned: boolean;
};

type PermissionRow = {
  id: string;
  target_type: "USER" | "GROUP";
  target_id: string;
  access_level:
    | "VIEWER"
    | "APPROVER"
    | "EDITOR";

  user_name: string | null;
  user_email: string | null;

  group_name: string | null;
  group_color: string | null;
  group_member_count: number | null;
};

export async function GET(
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const currentUser =
    getAuthenticatedUser(req);

  if (!currentUser) {
    return NextResponse.json(
      {
        error: "No autorizado",
      },
      {
        status: 401,
      }
    );
  }

  const { id: uploadId } =
    await context.params;

  try {
    /*
     * Primero validamos que el usuario
     * realmente pueda ver este archivo.
     */
    const accessQuery =
      await pool.query<UploadAccessRow>(
        `
        SELECT
          COALESCE(
            u.visibility,
            'PUBLIC'
          ) AS visibility,

          u.created_by_id,

          (
            EXISTS (
              SELECT 1
              FROM upload_permissions permission
              WHERE
                permission.upload_id =
                  u.id::text

                AND
                  permission.target_type =
                    'USER'

                AND
                  permission.target_id =
                    $2::text
            )

            OR

            EXISTS (
              SELECT 1
              FROM upload_permissions permission

              INNER JOIN user_group_members gm
                ON gm.group_id::text =
                  permission.target_id

              WHERE
                permission.upload_id =
                  u.id::text

                AND
                  permission.target_type =
                    'GROUP'

                AND
                  gm.user_id::text =
                    $2::text
            )
          ) AS is_assigned

        FROM uploads u

        WHERE
          u.id::text = $1::text

          AND
            u.is_deleted IS NOT TRUE

        LIMIT 1
        `,
        [
          uploadId,
          currentUser.id,
        ]
      );

    const access =
      accessQuery.rows[0];

    if (!access) {
      return NextResponse.json(
        {
          error:
            "Archivo no encontrado",
        },
        {
          status: 404,
        }
      );
    }

    const isOwner =
      access.created_by_id
        ?.toString() ===
      currentUser.id.toString();

    const isSuperAdmin =
      currentUser.role ===
      "SUPER_ADMIN";

    const canView =
      access.visibility === "PUBLIC" ||
      isOwner ||
      isSuperAdmin ||
      access.is_assigned;

    if (!canView) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para ver este archivo",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Los permisos solo tienen sentido
     * para archivos restringidos.
     *
     * En públicos devolvemos arrays
     * vacíos.
     */
    if (
      access.visibility === "PUBLIC"
    ) {
      return NextResponse.json(
        {
          visibility:
            access.visibility,

          canManage:
            isOwner ||
            isSuperAdmin,

          users: [],
          groups: [],
          total: 0,
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    /*
     * Cargamos USER y GROUP desde
     * upload_permissions.
     */
    const permissionsQuery =
      await pool.query<PermissionRow>(
        `
        SELECT
          permission.id::text,
          permission.target_type,
          permission.target_id,
          permission.access_level,

          user_target.name
            AS user_name,

          user_target.email
            AS user_email,

          group_target.name
            AS group_name,

          group_target.color
            AS group_color,

          CASE
            WHEN
              permission.target_type =
                'GROUP'
            THEN
              (
                SELECT COUNT(*)::int

                FROM user_group_members gm_count

                WHERE
                  gm_count.group_id::text =
                    permission.target_id
              )

            ELSE NULL
          END AS group_member_count

        FROM upload_permissions permission

        LEFT JOIN users user_target
          ON
            permission.target_type =
              'USER'

            AND
              user_target.id::text =
                permission.target_id

        LEFT JOIN user_groups group_target
          ON
            permission.target_type =
              'GROUP'

            AND
              group_target.id::text =
                permission.target_id

        WHERE
          permission.upload_id =
            $1::text

          AND
            permission.target_type
              IN (
                'USER',
                'GROUP'
              )

        ORDER BY
          CASE
            WHEN
              permission.target_type =
                'USER'
            THEN 1
            ELSE 2
          END,

          COALESCE(
            user_target.name,
            user_target.email,
            group_target.name,
            permission.target_id
          ) ASC
        `,
        [uploadId]
      );

    const users =
      permissionsQuery.rows
        .filter(
          (row) =>
            row.target_type === "USER"
        )
        .map((row) => ({
          permissionId: row.id,
          userId: row.target_id,
          name:
            row.user_name ?? null,
          email:
            row.user_email ?? null,
          accessLevel:
            row.access_level,
        }));

    const groups =
      permissionsQuery.rows
        .filter(
          (row) =>
            row.target_type === "GROUP"
        )
        .map((row) => ({
          permissionId: row.id,
          groupId: row.target_id,
          name:
            row.group_name ??
            "Grupo eliminado",
          color:
            row.group_color ?? null,
          memberCount:
            row.group_member_count ??
            0,
          accessLevel:
            row.access_level,
        }));

    return NextResponse.json(
      {
        visibility:
          access.visibility,

        canManage:
          isOwner ||
          isSuperAdmin,

        users,
        groups,

        total:
          users.length +
          groups.length,
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
      "GET /api/uploads/[id]/permissions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los permisos del archivo",
      },
      {
        status: 500,
      }
    );
  }
}