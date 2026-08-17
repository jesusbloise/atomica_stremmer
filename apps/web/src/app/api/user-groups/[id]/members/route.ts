import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

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

type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  membership_created_at: string;
};

function getAuthenticatedUser(req: Request): AuthUser | null {
  try {
    const cookie = (req.headers.get("cookie") || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith("auth="));

    const rawToken = cookie?.slice("auth=".length);

    if (!rawToken) {
      return null;
    }

    const token = decodeURIComponent(rawToken);

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
      role: String(payload.role ?? "")
        .trim()
        .toUpperCase(),
    };
  } catch {
    return null;
  }
}

function requireSuperAdmin(req: Request) {
  const currentUser = getAuthenticatedUser(req);

  if (!currentUser) {
    return {
      error: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      ),
      currentUser: null,
    };
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      ),
      currentUser: null,
    };
  }

  return {
    error: null,
    currentUser,
  };
}

async function groupExists(groupId: string) {
  const result = await pool.query(
    `
    SELECT id
    FROM user_groups
    WHERE id::text = $1::text
    LIMIT 1
    `,
    [groupId]
  );

  return result.rows.length > 0;
}

/**
 * GET /api/user-groups/[id]/members
 *
 * Devuelve:
 * - datos básicos del grupo;
 * - miembros asignados;
 * - usuarios disponibles para agregar.
 */
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

  const { id } = await context.params;

  try {
    const groupQuery = await pool.query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      color: string | null;
      is_active: boolean;
    }>(
      `
      SELECT
        id,
        name,
        slug,
        description,
        color,
        is_active
      FROM user_groups
      WHERE id::text = $1::text
      LIMIT 1
      `,
      [id]
    );

    const group = groupQuery.rows[0];

    if (!group) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    const membersQuery = await pool.query<MemberRow>(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        gm.created_at AS membership_created_at
      FROM user_group_members gm
      INNER JOIN users u
        ON u.id = gm.user_id
      WHERE gm.group_id::text = $1::text
      ORDER BY
        u.is_active DESC,
        COALESCE(NULLIF(u.name, ''), u.email) ASC
      `,
      [id]
    );

    const availableUsersQuery =
      await pool.query<{
        id: string;
        name: string | null;
        email: string;
        role: string;
        is_active: boolean;
      }>(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.is_active
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1
          FROM user_group_members gm
          WHERE
            gm.group_id::text = $1::text
            AND gm.user_id = u.id
        )
        ORDER BY
          u.is_active DESC,
          COALESCE(NULLIF(u.name, ''), u.email) ASC
        `,
        [id]
      );

    return NextResponse.json(
      {
        group,
        members: membersQuery.rows,
        availableUsers: availableUsersQuery.rows,
        memberCount: membersQuery.rows.length,
        availableCount:
          availableUsersQuery.rows.length,
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
      "GET /api/user-groups/[id]/members error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los miembros del grupo",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-groups/[id]/members
 *
 * Body aceptado:
 *
 * {
 *   "userIds": ["uuid-1", "uuid-2"]
 * }
 *
 * También acepta:
 *
 * {
 *   "userId": "uuid"
 * }
 */
export async function POST(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireSuperAdmin(req);

  if (auth.error || !auth.currentUser) {
    return auth.error;
  }

  const { id } = await context.params;

  try {
    if (!(await groupExists(id))) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();

    const rawUserIds = Array.isArray(body?.userIds)
      ? body.userIds
      : body?.userId
        ? [body.userId]
        : [];

    const userIds = Array.from(
      new Set(
        rawUserIds
          .map((value: unknown) =>
            String(value || "").trim()
          )
          .filter(Boolean)
      )
    );

    if (userIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Debes seleccionar al menos un usuario",
        },
        { status: 400 }
      );
    }

    const validUsersQuery = await pool.query<{
      id: string;
    }>(
      `
      SELECT id
      FROM users
      WHERE id::text = ANY($1::text[])
      `,
      [userIds]
    );

    const validUserIds =
      validUsersQuery.rows.map((row) => row.id);

    if (validUserIds.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron usuarios válidos" },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let addedCount = 0;

      for (const userId of validUserIds) {
        const insertResult = await client.query(
          `
          INSERT INTO user_group_members
            (
              group_id,
              user_id,
              added_by_id,
              created_at
            )
          VALUES
            (
              $1,
              $2,
              $3,
              NOW()
            )
          ON CONFLICT (group_id, user_id)
          DO NOTHING
          `,
          [
            id,
            userId,
            auth.currentUser.id,
          ]
        );

        addedCount += insertResult.rowCount ?? 0;
      }

      await client.query("COMMIT");

      return NextResponse.json(
        {
          ok: true,
          addedCount,
          requestedCount: userIds.length,
          validCount: validUserIds.length,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "POST /api/user-groups/[id]/members error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron agregar los usuarios al grupo",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user-groups/[id]/members
 *
 * Body:
 *
 * {
 *   "userId": "uuid"
 * }
 *
 * También acepta:
 *
 * {
 *   "userIds": ["uuid-1", "uuid-2"]
 * }
 */
export async function DELETE(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  const { id } = await context.params;

  try {
    if (!(await groupExists(id))) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();

    const rawUserIds = Array.isArray(body?.userIds)
      ? body.userIds
      : body?.userId
        ? [body.userId]
        : [];

    const userIds = Array.from(
      new Set(
        rawUserIds
          .map((value: unknown) =>
            String(value || "").trim()
          )
          .filter(Boolean)
      )
    );

    if (userIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Debes indicar al menos un usuario",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      DELETE FROM user_group_members
      WHERE
        group_id::text = $1::text
        AND user_id::text = ANY($2::text[])
      `,
      [id, userIds]
    );

    return NextResponse.json(
      {
        ok: true,
        removedCount: result.rowCount ?? 0,
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
      "DELETE /api/user-groups/[id]/members error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron quitar los usuarios del grupo",
      },
      { status: 500 }
    );
  }
}