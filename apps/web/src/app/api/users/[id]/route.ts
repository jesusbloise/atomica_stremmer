import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";
const ROLES = new Set(["SUPER_ADMIN", "ADMIN", "USUARIO"]);

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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const roleFromToken = getRoleFromReq(req);

    if (roleFromToken !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (typeof body.is_active === "boolean") {
      updates.push(`is_active = $${i++}`);
      values.push(body.is_active);
    }

    if (typeof body.role === "string") {
      const role = body.role.toUpperCase();

      if (!ROLES.has(role)) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }

      updates.push(`role = $${i++}`);
      values.push(role);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    values.push(id);

    const sql = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${i}
      RETURNING id, name, email, role, is_active, created_at;
    `;

    const client = await pool.connect();

    try {
      const res = await client.query(sql, values);

      if (res.rowCount === 0) {
        return NextResponse.json({ error: "No existe" }, { status: 404 });
      }

      return NextResponse.json(res.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("PATCH /api/users/[id] error:", err);

    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
}