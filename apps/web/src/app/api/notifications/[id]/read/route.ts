export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = String(
      session.sub || session.id || ""
    ).trim();

    const { id } = await context.params;

    const result = await pool.query(
      `
      UPDATE notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
        AND resolved_at IS NULL
      RETURNING id
      `,
      [id, userId]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Notificación no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "POST /api/notifications/[id]/read error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo marcar la notificación como leída",
      },
      { status: 500 }
    );
  }
}