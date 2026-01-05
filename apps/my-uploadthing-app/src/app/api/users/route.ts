import { NextResponse } from "next/server";
import  pool  from "@/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? "10")));
  const offset = (page - 1) * limit;

  const clauses: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (q) {
    clauses.push(`(LOWER(name) LIKE $${i} OR LOWER(email) LIKE $${i})`);
    params.push(`%${q}%`);
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const countSQL = `SELECT COUNT(*)::int AS count FROM users ${where};`;
  const dataSQL = `
    SELECT id, name, email, role, is_active, created_at
    FROM users
    ${where}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  const client = await pool.connect();
  try {
    const totalRes = await client.query(countSQL, params);
    const rowsRes = await client.query(dataSQL, params);
    return NextResponse.json({ rows: rowsRes.rows, total: totalRes.rows[0].count });
  } finally {
    client.release();
  }
}
