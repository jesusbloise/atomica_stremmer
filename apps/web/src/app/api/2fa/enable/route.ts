export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verify } from "otplib";
import pool from "@/db";
import { encryptTwoFactorSecret } from "@/lib/twoFactorCrypto";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  "dev-secret-cambia-esto";

type TwoFactorSetupChallenge = {
  purpose: "2fa-setup";
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

    const secret =
      typeof body?.secret === "string"
        ? body.secret.trim()
        : "";

    const token =
      typeof body?.token === "string"
        ? body.token.replace(/\D/g, "").trim()
        : "";

    if (
      !challengeToken ||
      !secret ||
      !/^\d{6}$/.test(token)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan datos para completar la configuración.",
        },
        { status: 400 }
      );
    }

    let challenge: TwoFactorSetupChallenge;

    try {
      challenge = jwt.verify(
        challengeToken,
        JWT_SECRET
      ) as TwoFactorSetupChallenge;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "La configuración expiró. Inicia sesión nuevamente.",
        },
        { status: 401 }
      );
    }

    if (
      challenge.purpose !== "2fa-setup" ||
      !challenge.sub ||
      !challenge.email
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Desafío de configuración inválido.",
        },
        { status: 401 }
      );
    }

    const verification = await verify({
      secret,
      token,
    });

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El código de Google Authenticator no es válido.",
        },
        { status: 400 }
      );
    }

    const encryptedSecret =
      encryptTwoFactorSecret(secret);

    const result = await pool.query<{
      id: string;
      name: string;
      email: string;
      role: string;
    }>(
      `
      UPDATE users
      SET
        two_factor_enabled = TRUE,
        two_factor_secret = $1,
        two_factor_enabled_at = NOW()
      WHERE
        id = $2
        AND is_active = TRUE
      RETURNING
        id,
        name,
        email,
        role
      `,
      [
        encryptedSecret,
        challenge.sub,
      ]
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuario no encontrado.",
        },
        { status: 404 }
      );
    }

    /*
     * El 2FA ya quedó activado.
     * AHORA sí emitimos la sesión definitiva.
     */
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

    const response = NextResponse.json(
      {
        success: true,
        enabled: true,
        id: user.id,
        name: user.name,
        role: user.role,
        message:
          "Verificación en dos pasos activada correctamente.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

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
        maxAge:
          60 * 60 * 24 * 7,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "POST /api/2fa/enable error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo activar la verificación en dos pasos.",
      },
      { status: 500 }
    );
  }
}