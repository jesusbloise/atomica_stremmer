import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
  invite?: string;
};

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/* =========================================================
   VALIDAR INVITACIÓN

   GET /api/register?invite=TOKEN
========================================================= */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const rawToken = String(
      searchParams.get("invite") || ""
    ).trim();

    if (!rawToken) {
      return NextResponse.json(
        {
          valid: false,
          error:
            "Necesitas una invitación privada para registrarte.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const tokenHash = hashToken(rawToken);

    const result = await pool.query<{
      id: string;
      email: string | null;
      expires_at: string;
    }>(
      `
      SELECT
        id,
        email,
        expires_at
      FROM registration_invites
      WHERE
        token_hash = $1
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    const invite = result.rows[0];

    if (!invite) {
      return NextResponse.json(
        {
          valid: false,
          error:
            "La invitación no existe, venció o ya fue utilizada.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        email: invite.email,
        expiresAt: invite.expires_at,
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
      "GET /api/register error:",
      error
    );

    return NextResponse.json(
      {
        valid: false,
        error:
          "No se pudo validar la invitación.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   REGISTRO PRIVADO

   POST /api/register
========================================================= */

export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    const body =
      (await req.json()) as RegisterBody;

    const name = String(
      body?.name || ""
    ).trim();

    const email = String(
      body?.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body?.password || ""
    );

    const rawToken = String(
      body?.invite || ""
    ).trim();

    if (!rawToken) {
      return NextResponse.json(
        {
          error:
            "El registro es privado. Necesitas una invitación válida.",
        },
        { status: 403 }
      );
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      return NextResponse.json(
        { error: "Correo inválido." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe tener al menos 6 caracteres.",
        },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(rawToken);

    await client.query("BEGIN");

    /*
     * FOR UPDATE impide que dos solicitudes utilicen
     * la misma invitación al mismo tiempo.
     */
    const inviteQuery =
      await client.query<{
        id: string;
        email: string | null;
      }>(
        `
        SELECT
          id,
          email
        FROM registration_invites
        WHERE
          token_hash = $1
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        FOR UPDATE
        `,
        [tokenHash]
      );

    const invite = inviteQuery.rows[0];

    if (!invite) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "La invitación no existe, venció o ya fue utilizada.",
        },
        { status: 403 }
      );
    }

    /*
     * Si la invitación fue creada para un correo,
     * solamente ese correo puede utilizarla.
     */
    if (
      invite.email &&
      invite.email
        .trim()
        .toLowerCase() !== email
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Esta invitación fue creada para otro correo electrónico.",
        },
        { status: 403 }
      );
    }

    const existingUser =
      await client.query<{
        id: string;
      }>(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
        `,
        [email]
      );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "El correo ya está registrado.",
        },
        { status: 409 }
      );
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const userResult =
      await client.query(
        `
        INSERT INTO users
          (
            name,
            email,
            password_hash
          )
        VALUES
          (
            $1,
            $2,
            $3
          )
        RETURNING
          id,
          name,
          email,
          role,
          is_active,
          created_at
        `,
        [
          name,
          email,
          passwordHash,
        ]
      );

    const user = userResult.rows[0];

    await client.query(
      `
      UPDATE registration_invites
      SET
        used_at = NOW(),
        used_by_id = $1
      WHERE id = $2
      `,
      [
        user.id,
        invite.id,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        ok: true,
        user,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // No hacemos nada si la transacción
      // ya estaba cerrada.
    }

    console.error(
      "POST /api/register error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo completar el registro.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}