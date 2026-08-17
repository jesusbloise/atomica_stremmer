import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getR2SignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

function getRoleFromReq(req: Request) {
  const cookie = (req.headers.get("cookie") || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("auth="));

  const raw = cookie?.split("=")?.[1];

  if (!raw) {
    return null;
  }

  try {
    const token = decodeURIComponent(raw);
    const payload = jwt.verify(token, JWT_SECRET) as {
      role?: string;
    };

    return String(payload.role || "").trim().toUpperCase();
  } catch (error) {
    console.error("Token de descarga inválido:", error);
    return null;
  }
}

function parseR2Url(raw?: string | null) {
  if (!raw || !raw.startsWith("r2://")) {
    return null;
  }

  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");

  if (firstSlash === -1) {
    return null;
  }

  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !objectPath) {
    return null;
  }

  return {
    bucket,
    objectPath,
  };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = getRoleFromReq(req);
    const allowedRoles = ["SUPER_ADMIN", "ADMIN"];

    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const { rows } = await pool.query(
      `
      SELECT id, file_name, r2_path
      FROM uploads
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const parsed = parseR2Url(row.r2_path);

    if (!parsed) {
      return NextResponse.json(
        {
          error: "Archivo sin ruta R2 válida",
          details: {
            id: row.id,
            r2_path: row.r2_path,
          },
        },
        { status: 400 }
      );
    }

    const fileName = String(row.file_name || "archivo").replace(/"/g, "");
    const r2Client = getR2Client();

    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.objectPath,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });

    const url = await getR2SignedUrl(r2Client, command, {
      expiresIn: 60 * 30,
    });

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("GET /api/uploads/[id]/download error:", error);

    return NextResponse.json(
      { error: "No se pudo generar la descarga" },
      { status: 500 }
    );
  }
}