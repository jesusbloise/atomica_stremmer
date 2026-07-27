import { NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

type ResponsibleUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const role = String(session.role || "")
    .trim()
    .toUpperCase();

  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
    return NextResponse.json(
      {
        error:
          "No tienes permisos para consultar responsables",
      },
      { status: 403 }
    );
  }

  const client = await pool.connect();

  try {
    const result = await client.query<ResponsibleUser>(`
      SELECT
        id,
        name,
        email,
        role
      FROM users
      WHERE is_active = TRUE
      ORDER BY
        CASE
          WHEN NULLIF(TRIM(name), '') IS NULL THEN 1
          ELSE 0
        END,
        LOWER(COALESCE(NULLIF(TRIM(name), ''), email)),
        LOWER(email)
    `);

    return NextResponse.json({
      rows: result.rows,
      total: result.rowCount ?? 0,
    });
  } catch (error) {
    console.error(
      "GET_CONTROL_CARGAS_RESPONSABLES_ERROR",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los responsables",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}