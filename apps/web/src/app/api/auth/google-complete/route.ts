export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";

import pool from "@/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  "dev-secret-cambia-esto";

type ChallengePurpose =
  | "2fa-login"
  | "2fa-setup";

export async function POST() {
  try {
    const session =
      await getServerSession(authOptions);

    const email =
      session?.user?.email
        ?.trim()
        .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una sesión válida de Google",
        },
        { status: 401 }
      );
    }

    const result = await pool.query<{
      id: string;
      name: string;
      email: string;
      role: string;
      is_active: boolean;
      two_factor_enabled: boolean;
      two_factor_secret: string | null;
    }>(
      `
      SELECT
        id,
        name,
        email,
        role,
        is_active,
        COALESCE(
          two_factor_enabled,
          FALSE
        ) AS two_factor_enabled,
        two_factor_secret
      FROM users
      WHERE LOWER(email) = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tu cuenta de Google no está habilitada en Atomica",
        },
        { status: 403 }
      );
    }

    const hasTwoFactor =
      user.two_factor_enabled === true &&
      Boolean(user.two_factor_secret);

    const purpose: ChallengePurpose =
      hasTwoFactor
        ? "2fa-login"
        : "2fa-setup";

    const challengeToken =
      jwt.sign(
        {
          purpose,
          sub: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
        },
        JWT_SECRET,
        {
          expiresIn:
            purpose === "2fa-setup"
              ? "15m"
              : "5m",
        }
      );

    if (purpose === "2fa-setup") {
      return NextResponse.json(
        {
          success: true,
          requiresTwoFactor: false,
          requiresTwoFactorSetup: true,
          challengeToken,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        requiresTwoFactor: true,
        requiresTwoFactorSetup: false,
        challengeToken,
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
      "POST /api/auth/google-complete error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo completar el inicio de sesión con Google",
      },
      { status: 500 }
    );
  }
}