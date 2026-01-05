import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

function ensureAdmin(req: Request) {
  try {
    const cookie = (req.headers.get("cookie") || "")
      .split(";").map(v => v.trim()).find(v => v.startsWith("auth="));
    const token = cookie?.split("=")?.[1];
    const p = token ? (jwt.verify(token, JWT_SECRET) as any) : null;
    if (!p || p.role !== "ADMIN") throw new Error("forbidden");
    return p;
  } catch { throw new Error("forbidden"); }
}

// GET /api/admin/users?status=pending|active|all&search=foo
export async function GET(req: Request) {
  try {
    ensureAdmin(req);
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "pending").toLowerCase(); // default: pendientes
    const q = (searchParams.get("search") || "").trim();

    const conds: string[] = [];
    const params: any[] = [];
    if (status === "pending") conds.push("is_active = FALSE");
    else if (status === "active") conds.push("is_active = TRUE");

    if (q) {
      params.push(`%${q}%`);
      params.push(`%${q}%`);
      conds.push("(LOWER(name) LIKE LOWER($"+(params.length-1)+") OR LOWER(email) LIKE LOWER($"+params.length+"))");
    }

    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const sql = `
      SELECT id, name, email, role, is_active, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
    `;
    const r = await pool.query(sql, params);
    return NextResponse.json(r.rows);
  } catch {
    return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
  }
}
