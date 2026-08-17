import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

type JwtPayload = {
  id?: string;
  sub?: string;
  userId?: string;
  role?: string;
};

type AuthUser = {
  id: string;
  role: string;
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

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function GET(req: Request) {
  const currentUser = getAuthenticatedUser(req);

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        invite.id,
        invite.email,
        invite.expires_at,
        invite.used_at,
        invite.revoked_at,
        invite.created_at,

        creator.id AS created_by_id,
        creator.name AS created_by_name,
        creator.email AS created_by_email,

        used_user.id AS used_by_id,
        used_user.name AS used_by_name,
        used_user.email AS used_by_email

      FROM registration_invites invite

      LEFT JOIN users creator
        ON creator.id::text =
           invite.created_by_id::text

      LEFT JOIN users used_user
        ON used_user.id::text =
           invite.used_by_id::text

      ORDER BY invite.created_at DESC
      LIMIT 100
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
      "GET /api/registration-invites error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar las invitaciones",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const currentUser = getAuthenticatedUser(req);

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const email =
      String(body?.email || "")
        .trim()
        .toLowerCase() || null;

    const expiresInHoursRaw =
      Number(body?.expiresInHours ?? 72);

    const expiresInHours =
      Number.isFinite(expiresInHoursRaw)
        ? Math.min(
            24 * 30,
            Math.max(1, expiresInHoursRaw)
          )
        : 72;

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Correo inválido" },
        { status: 400 }
      );
    }

    const rawToken =
      crypto.randomBytes(32).toString("hex");

    const tokenHash =
      hashToken(rawToken);

    const result = await pool.query(
      `
      INSERT INTO registration_invites
        (
          token_hash,
          email,
          created_by_id,
          expires_at,
          created_at
        )
      VALUES
        (
          $1,
          $2,
          $3,
          NOW() + ($4 * INTERVAL '1 hour'),
          NOW()
        )
      RETURNING
        id,
        email,
        expires_at,
        created_at
      `,
      [
        tokenHash,
        email,
        currentUser.id,
        expiresInHours,
      ]
    );

    const forwardedHost = req.headers.get("x-forwarded-host");
const forwardedProto =
  req.headers.get("x-forwarded-proto") || "https";

const origin =
  process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ||
  (forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(req.url).origin);

const inviteUrl =
  `${origin}/register?invite=${rawToken}`;

    return NextResponse.json(
      {
        ok: true,
        invite: result.rows[0],
        inviteUrl,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "POST /api/registration-invites error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo crear la invitación",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(req: Request) {
  const currentUser = getAuthenticatedUser(req);

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  if (currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const inviteId = String(body?.inviteId || "").trim();

    if (!inviteId) {
      return NextResponse.json(
        { error: "Falta el identificador de la invitación" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      UPDATE registration_invites
      SET revoked_at = NOW()
      WHERE
        id::text = $1::text
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > NOW()
      RETURNING
        id,
        email,
        expires_at,
        used_at,
        revoked_at,
        created_at
      `,
      [inviteId]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        {
          error:
            "La invitación no existe, ya fue utilizada, venció o fue cancelada.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        invite: result.rows[0],
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
      "PATCH /api/registration-invites error:",
      error
    );

    return NextResponse.json(
      {
        error: "No se pudo cancelar la invitación",
      },
      { status: 500 }
    );
  }
}