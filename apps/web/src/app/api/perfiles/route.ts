import { NextResponse } from "next/server";
import pool from "@/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  const args: any[] = [];
  let sql = `
    SELECT u.id AS user_id, u.name, u.email, u.role,
           p.generacion, p.facultad, p.avatar_url
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
  `;
  if (q) {
    sql += ` WHERE LOWER(u.name) LIKE LOWER($1) OR u.email ILIKE $1 `;
    args.push(`%${q}%`);
  }
  sql += ` ORDER BY u.created_at DESC LIMIT $${args.length + 1}`;
  args.push(limit);

  const { rows } = await pool.query(sql, args);
  return NextResponse.json(rows);
}
