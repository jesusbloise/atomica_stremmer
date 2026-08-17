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

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function requireSuperAdmin(req: Request) {
  const currentUser = getAuthenticatedUser(req);

  if (!currentUser) {
    return {
      currentUser: null,
      error: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      ),
    };
  }

  if (currentUser.role !== "SUPER_ADMIN") {
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
   LISTAR GRUPOS
========================================================= */

export async function GET(req: Request) {
  const auth = requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const { rows } = await pool.query<GroupRow>(
      `
      SELECT
        g.id,
        g.name,
        g.slug,
        g.description,
        g.color,
        g.is_active,
        g.created_by_id,
        g.created_at,
        g.updated_at,
        COUNT(gm.user_id)::int AS member_count
      FROM user_groups g
      LEFT JOIN user_group_members gm
        ON gm.group_id = g.id
      GROUP BY
        g.id,
        g.name,
        g.slug,
        g.description,
        g.color,
        g.is_active,
        g.created_by_id,
        g.created_at,
        g.updated_at
      ORDER BY
        g.is_active DESC,
        g.name ASC
      `
    );

    return NextResponse.json(
      {
        rows,
        total: rows.length,
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
      "GET /api/user-groups error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los grupos",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   CREAR GRUPO
========================================================= */

export async function POST(req: Request) {
  const auth = requireSuperAdmin(req);

  if (auth.error || !auth.currentUser) {
    return auth.error;
  }

  try {
    const body = await req.json();

    const name = String(
      body?.name || ""
    ).trim();

    const description =
      String(
        body?.description || ""
      ).trim() || null;

    const color =
      String(
        body?.color || ""
      ).trim() || null;

    const slug = slugify(name);

    if (!name) {
      return NextResponse.json(
        {
          error:
            "El nombre del grupo es obligatorio",
        },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        {
          error:
            "No se pudo generar un slug válido",
        },
        { status: 400 }
      );
    }

    const { rows } =
      await pool.query<GroupRow>(
        `
        INSERT INTO user_groups
          (
            name,
            slug,
            description,
            color,
            created_by_id,
            created_at,
            updated_at
          )
        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW(),
            NOW()
          )
        RETURNING
          id,
          name,
          slug,
          description,
          color,
          is_active,
          created_by_id,
          created_at,
          updated_at,
          0::int AS member_count
        `,
        [
          name,
          slug,
          description,
          color,
          auth.currentUser.id,
        ]
      );

    return NextResponse.json(
      rows[0],
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "Ya existe un grupo con ese nombre",
        },
        { status: 409 }
      );
    }

    console.error(
      "POST /api/user-groups error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo crear el grupo",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   ELIMINAR GRUPO
========================================================= */

export async function DELETE(req: Request) {
  const auth = requireSuperAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await req.json();

    const groupId = String(
      body?.groupId || ""
    ).trim();

    if (!groupId) {
      return NextResponse.json(
        {
          error:
            "Debes indicar el grupo que deseas eliminar",
        },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const groupQuery =
        await client.query<{
          id: string;
          name: string;
        }>(
          `
          SELECT
            id,
            name
          FROM user_groups
          WHERE id::text = $1::text
          LIMIT 1
          `,
          [groupId]
        );

      const group = groupQuery.rows[0];

      if (!group) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "El grupo no existe o ya fue eliminado",
          },
          { status: 404 }
        );
      }

      const membersQuery =
        await client.query<{
          member_count: number;
        }>(
          `
          SELECT
            COUNT(*)::int AS member_count
          FROM user_group_members
          WHERE group_id::text = $1::text
          `,
          [groupId]
        );

      const memberCount =
        membersQuery.rows[0]?.member_count ??
        0;

      const deleteResult =
        await client.query(
          `
          DELETE FROM user_groups
          WHERE id::text = $1::text
          `,
          [groupId]
        );

      if (!deleteResult.rowCount) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "No se pudo eliminar el grupo",
          },
          { status: 404 }
        );
      }

      await client.query("COMMIT");

      return NextResponse.json(
        {
          ok: true,
          deletedGroup: {
            id: group.id,
            name: group.name,
          },
          removedMemberships:
            memberCount,
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
      "DELETE /api/user-groups error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo eliminar el grupo",
      },
      { status: 500 }
    );
  }
}