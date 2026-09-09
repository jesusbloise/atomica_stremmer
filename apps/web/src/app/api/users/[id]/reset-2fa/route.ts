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