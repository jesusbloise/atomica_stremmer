export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req);

    if (!session?.sub) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const result = await pool.query<{
      two_factor_enabled: boolean;
      two_factor_enabled_at: string | null;
    }>(
      `
      SELECT
        COALESCE(two_factor_enabled, FALSE) AS two_factor_enabled,
        two_factor_enabled_at
      FROM users
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [session.sub]
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuario no encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      enabled: Boolean(user.two_factor_enabled),
      enabledAt: user.two_factor_enabled_at ?? null,
    });
  } catch (error) {
    console.error("GET /api/2fa/status error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error consultando el estado de 2FA",
      },
      { status: 500 }
    );
  }
}