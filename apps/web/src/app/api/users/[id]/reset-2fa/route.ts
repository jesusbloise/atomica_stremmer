import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuthUser = {
  id: string;
  role: string;
};

function getAuthenticatedUser(req: Request): AuthUser | null {
  const session = getSessionFromRequest(req);

  if (!session?.sub) {
    return null;
  }

  return {
    id: String(session.sub),
    role: String(session.role ?? "")
      .trim()
      .toUpperCase(),
  };
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

export async function POST(
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
    const { id: userId } =
      await context.params;

    const result = await pool.query(
      `
      UPDATE users
      SET
        two_factor_enabled = FALSE,
        two_factor_secret = NULL,
        two_factor_enabled_at = NULL
      WHERE id::text = $1::text
      RETURNING
        id,
        name,
        email,
        role,
        two_factor_enabled
      `,
      [userId]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        {
          error:
            "Usuario no encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "2FA reseteado correctamente",
        user: result.rows[0],
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
      "POST /api/users/[id]/reset-2fa error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo resetear el 2FA",
      },
      { status: 500 }
    );
  }
}
