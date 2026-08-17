export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
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

    if (!userId) {
      return NextResponse.json(
        { error: "No se pudo identificar al usuario" },
        { status: 401 }
      );
    }

    const userResult = await pool.query<{
      two_factor_enabled: boolean;
    }>(
      `
      SELECT
        COALESCE(two_factor_enabled, FALSE)
          AS two_factor_enabled
      FROM users
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    /*
     * Si NO tiene 2FA:
     * aseguramos que exista una notificación pendiente.
     */
    if (!user.two_factor_enabled) {
      const existing = await pool.query(
        `
        SELECT id
        FROM notifications
        WHERE user_id = $1
          AND type = 'TWO_FACTOR_PENDING'
          AND resolved_at IS NULL
        LIMIT 1
        `,
        [userId]
      );

      if (!existing.rowCount) {
        await pool.query(
          `
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            action_url
          )
          VALUES (
            $1,
            'TWO_FACTOR_PENDING',
            'Seguridad de tu cuenta',
            'Aún no has activado la verificación en dos pasos con Google Authenticator.',
            '/perfil'
          )
          `,
          [userId]
        );
      }
    } else {
      /*
       * Si YA tiene 2FA:
       * cerramos cualquier aviso pendiente anterior.
       */
      await pool.query(
        `
        UPDATE notifications
        SET resolved_at = NOW()
        WHERE user_id = $1
          AND type = 'TWO_FACTOR_PENDING'
          AND resolved_at IS NULL
        `,
        [userId]
      );
    }

    const notificationsResult = await pool.query(
      `
      SELECT
        id,
        type,
        title,
        message,
        upload_id,
        action_url,
        metadata,
        created_at,
        read_at,
        banner_dismissed_at,
        resolved_at
      FROM notifications
      WHERE user_id = $1
        AND resolved_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId]
    );

    const unread = notificationsResult.rows.filter(
      (item) => !item.read_at
    ).length;

    return NextResponse.json(
      {
        unread,
        total: notificationsResult.rows.length,
        notifications: notificationsResult.rows,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/notifications error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar las notificaciones",
      },
      { status: 500 }
    );
  }
}