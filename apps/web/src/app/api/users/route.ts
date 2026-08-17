import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

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

export async function GET(req: Request) {
  try {
    const role = getRoleFromReq(req);

    if (role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? "10")));
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (q) {
     clauses.push(
  `(LOWER(u.name) LIKE $${i} OR LOWER(u.email) LIKE $${i})`
);
      params.push(`%${q}%`);
      i++;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

   const countSQL = `
  SELECT COUNT(*)::int AS count
  FROM users u
  ${where};
`;

const dataSQL = `
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.is_active,
    u.created_at,

    COALESCE(upload_stats.total_uploads, 0)::int
      AS total_uploads,

    COALESCE(upload_stats.public_uploads, 0)::int
      AS public_uploads,

    COALESCE(upload_stats.restricted_uploads, 0)::int
      AS restricted_uploads,

    COALESCE(private_access.private_access_count, 0)::int
      AS private_access_count,

    COALESCE(shared_people.shared_people_count, 0)::int
      AS shared_people_count

  FROM users u

  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_uploads,

      COUNT(*) FILTER (
        WHERE COALESCE(upload.visibility, 'PUBLIC') = 'PUBLIC'
      ) AS public_uploads,

      COUNT(*) FILTER (
        WHERE COALESCE(upload.visibility, 'PUBLIC') = 'RESTRICTED'
      ) AS restricted_uploads

    FROM uploads upload

    WHERE
      upload.created_by_id::text = u.id::text
      AND upload.is_deleted IS NOT TRUE
  ) upload_stats ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS private_access_count

    FROM upload_access_users access_user

    INNER JOIN uploads access_upload
      ON access_upload.id::text =
         access_user.upload_id::text

    WHERE
      access_user.user_id::text = u.id::text
      AND access_upload.is_deleted IS NOT TRUE
      AND COALESCE(
        access_upload.visibility,
        'PUBLIC'
      ) = 'RESTRICTED'
  ) private_access ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      COUNT(
        DISTINCT access_user.user_id
      ) AS shared_people_count

    FROM uploads owner_upload

    INNER JOIN upload_access_users access_user
      ON access_user.upload_id::text =
         owner_upload.id::text

    WHERE
      owner_upload.created_by_id::text =
        u.id::text
      AND owner_upload.is_deleted IS NOT TRUE
  ) shared_people ON TRUE

  ${where}

  ORDER BY u.created_at DESC

  LIMIT ${limit}
  OFFSET ${offset};
`;
    const client = await pool.connect();

    try {
      const totalRes = await client.query(countSQL, params);
      const rowsRes = await client.query(dataSQL, params);

      return NextResponse.json({
        rows: rowsRes.rows,
        total: totalRes.rows[0].count,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/users error:", err);

    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }
}