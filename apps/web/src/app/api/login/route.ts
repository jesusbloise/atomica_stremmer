export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "@/db";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  "dev-secret-cambia-esto";

type ChallengePurpose =
  | "2fa-login"
  | "2fa-setup";

export async function POST(req: Request) {
  try {
    const body = await req
      .json()
      .catch(() => ({}));

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Completa todos los campos",
        },
        { status: 400 }
      );
    }

    const result = await pool.query<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
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
        password_hash,
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
          error: "Credenciales inválidas",
        },
        { status: 401 }
      );
    }

    const passwordOk =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordOk) {
      return NextResponse.json(
        {
          success: false,
          error: "Credenciales inválidas",
        },
        { status: 401 }
      );
    }

    /*
     * IMPORTANTE:
     *
     * A partir de aquí NO se crea una sesión
     * definitiva.
     *
     * Todo usuario debe completar 2FA antes
     * de recibir la cookie "auth".
     */

    const hasTwoFactor =
      user.two_factor_enabled === true &&
      Boolean(user.two_factor_secret);

    const purpose: ChallengePurpose =
      hasTwoFactor
        ? "2fa-login"
        : "2fa-setup";

    const challengeToken = jwt.sign(
      {
        purpose,
        sub: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      JWT_SECRET,
      {
        /*
         * Login normal:
         * 5 minutos para ingresar el código.
         *
         * Configuración inicial:
         * damos 15 minutos para escanear QR
         * y confirmar Google Authenticator.
         */
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

          message:
            "Debes configurar la verificación en dos pasos para continuar.",
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
      "POST /api/login error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo completar el inicio de sesión",
      },
      { status: 500 }
    );
  }
}