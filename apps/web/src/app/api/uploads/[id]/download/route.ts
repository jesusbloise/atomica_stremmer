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
    .map((v) => v.trim())
    .find((v) => v.startsWith("auth="));

  const raw = cookie?.split("=")?.[1];
  if (!raw) return null;

  const token = decodeURIComponent(raw);
  const payload = jwt.verify(token, JWT_SECRET) as any;

  return String(payload.role || "").trim().toUpperCase();
}

function parseR2Url(raw?: string | null) {
  if (!raw || !raw.startsWith("r2://")) return null;

  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const role = getRoleFromReq(req);

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
  } catch (err) {
    console.error("GET /api/uploads/[id]/download error:", err);

    return NextResponse.json(
      { error: "No se pudo generar la descarga" },
      { status: 500 }
    );
  }
}


// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";
// import pool from "@/db";
// import { Storage } from "@google-cloud/storage";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";
// export const revalidate = 0;

// const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";
// const storage = new Storage();
// const GCS_BUCKET = process.env.GCS_BUCKET;

// function getRoleFromReq(req: Request) {
//   const cookie = (req.headers.get("cookie") || "")
//     .split(";")
//     .map((v) => v.trim())
//     .find((v) => v.startsWith("auth="));

//   const raw = cookie?.split("=")?.[1];
//   if (!raw) return null;

//   const token = decodeURIComponent(raw);
//   const payload = jwt.verify(token, JWT_SECRET) as any;

//   return String(payload.role || "").trim().toUpperCase();
// }

// function parseGsUrl(raw?: string | null) {
//   if (!raw || !raw.startsWith("gs://")) return null;

//   const withoutScheme = raw.slice(5);
//   const firstSlash = withoutScheme.indexOf("/");
//   if (firstSlash === -1) return null;

//   return {
//     bucket: withoutScheme.slice(0, firstSlash),
//     objectPath: withoutScheme.slice(firstSlash + 1),
//   };
// }

// export async function GET(
//   req: Request,
//   context: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const role = getRoleFromReq(req);

//     if (role !== "SUPER_ADMIN") {
//       return NextResponse.json({ error: "No autorizado" }, { status: 403 });
//     }

//     const { id } = await context.params;

//     const { rows } = await pool.query(
//       `
//       SELECT id, file_name, file_key, file_path
//       FROM uploads
//       WHERE id = $1
//       LIMIT 1
//       `,
//       [id]
//     );

//     const row = rows[0];

//     if (!row) {
//       return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
//     }

//     const parsed = parseGsUrl(row.file_path);
//     const bucket = parsed?.bucket || GCS_BUCKET;
//     const objectPath = parsed?.objectPath || row.file_key;

//     if (!bucket || !objectPath) {
//       return NextResponse.json({ error: "Archivo sin ruta válida" }, { status: 400 });
//     }

//     const fileName = String(row.file_name || "archivo").replace(/"/g, "");

//     const [url] = await storage.bucket(bucket).file(objectPath).getSignedUrl({
//       version: "v4",
//       action: "read",
//       expires: Date.now() + 1000 * 60 * 30,
//       responseDisposition: `attachment; filename="${fileName}"`,
//     });

//     return NextResponse.redirect(url);
//   } catch (err) {
//     console.error("GET /api/uploads/[id]/download error:", err);

//     return NextResponse.json(
//       { error: "No se pudo generar la descarga" },
//       { status: 500 }
//     );
//   }
// }