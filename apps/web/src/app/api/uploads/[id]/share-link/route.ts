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

export async function POST(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const currentUser =
    getAuthenticatedUser(req);

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  if (
    currentUser.role !== "SUPER_ADMIN" &&
    currentUser.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  try {
    const { id: uploadId } =
      await context.params;

    const body = await req
      .json()
      .catch(() => ({}));

    const expiresInHoursRaw =
      Number(
        body?.expiresInHours ?? 72
      );

    const expiresInHours =
      Number.isFinite(
        expiresInHoursRaw
      )
        ? Math.min(
            24 * 30,
            Math.max(
              1,
              expiresInHoursRaw
            )
          )
        : 72;

    const uploadQuery =
     await pool.query<{
  id: string;
  created_by_id: string | null;
  visibility: string | null;
}>(
        `
        SELECT
  id,
  created_by_id,
  COALESCE(visibility, 'PUBLIC') AS visibility
FROM uploads
        WHERE
          id::text = $1::text
          AND is_deleted IS NOT TRUE
        LIMIT 1
        `,
        [uploadId]
      );

    const upload =
      uploadQuery.rows[0];

    if (!upload) {
      return NextResponse.json(
        {
          error:
            "Archivo no encontrado",
        },
        { status: 404 }
      );
    }

    if (
  String(upload.visibility || "PUBLIC")
    .trim()
    .toUpperCase() !== "PUBLIC"
) {
  return NextResponse.json(
    {
      error:
        "Los archivos restringidos no se pueden compartir mediante enlace externo",
    },
    { status: 403 }
  );
}
   

    const isOwner =
  upload.created_by_id?.toString() ===
  currentUser.id.toString();

const canShareAsAdmin =
  currentUser.role === "SUPER_ADMIN" ||
  currentUser.role === "ADMIN";

if (!isOwner && !canShareAsAdmin) {
  return NextResponse.json(
    {
      error:
        "No tienes permiso para compartir este archivo",
    },
    { status: 403 }
  );
}

    const rawToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    const tokenHash =
      hashToken(rawToken);

    const result =
      await pool.query(
        `
        INSERT INTO upload_share_links
          (
            upload_id,
            token_hash,
            created_by_id,
            expires_at,
            created_at
          )
        VALUES
          (
            $1,
            $2,
            $3,
            NOW() + (
              $4 *
              INTERVAL '1 hour'
            ),
            NOW()
          )
        RETURNING
          id,
          upload_id,
          expires_at,
          created_at
        `,
        [
          uploadId,
          tokenHash,
          currentUser.id,
          expiresInHours,
        ]
      );

    const origin =
      process.env.NEXTAUTH_URL
        ?.replace(/\/+$/, "") ||
      new URL(req.url).origin;

    const shareUrl =
      `${origin}/videos/${uploadId}` +
      `?share=${rawToken}`;

    return NextResponse.json(
      {
        ok: true,
        shareLink:
          result.rows[0],
        shareUrl,
      },
      {
        status: 201,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "POST /api/uploads/[id]/share-link error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo generar el enlace compartido",
      },
      { status: 500 }
    );
  }
}