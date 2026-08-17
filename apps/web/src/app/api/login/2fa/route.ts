export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verify } from "otplib";
import pool from "@/db";
import { decryptTwoFactorSecret } from "@/lib/twoFactorCrypto";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  "dev-secret-cambia-esto";

type TwoFactorChallenge = {
  purpose: "2fa-login";
  sub: string;
  role: string;
  name: string;
  email: string;
};

export async function POST(req: Request) {
  try {
    const body = await req
      .json()
      .catch(() => ({}));

    const challengeToken =
      typeof body?.challengeToken === "string"
        ? body.challengeToken.trim()
        : "";

    const code =
      typeof body?.code === "string"
        ? body.code.replace(/\D/g, "").trim()
        : "";

    if (!challengeToken || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Debes ingresar un código válido de 6 dígitos",
        },
        { status: 400 }
      );
    }

    let challenge: TwoFactorChallenge;

    try {
      challenge = jwt.verify(
        challengeToken,
        JWT_SECRET
      ) as TwoFactorChallenge;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "La verificación expiró. Inicia sesión nuevamente.",
        },
        { status: 401 }
      );
    }

    if (
      challenge.purpose !== "2fa-login" ||
      !challenge.sub
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Desafío de autenticación inválido",
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
        COALESCE(two_factor_enabled, FALSE)
          AS two_factor_enabled,
        two_factor_secret
      FROM users
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [challenge.sub]
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

    if (
      !user.two_factor_enabled ||
      !user.two_factor_secret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La verificación en dos pasos no está activa",
        },
        { status: 400 }
      );
    }

    const secret =
      decryptTwoFactorSecret(
        user.two_factor_secret
      );

    const verification = await verify({
      secret,
      token: code,
    });

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Código de Google Authenticator incorrecto",
        },
        { status: 401 }
      );
    }

    const authToken = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const response = NextResponse.json({
      success: true,
      id: user.id,
      name: user.name,
      role: user.role,
    });

    response.cookies.set(
      "auth",
      authToken,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "POST /api/login/2fa error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo completar la verificación",
      },
      { status: 500 }
    );
  }
}