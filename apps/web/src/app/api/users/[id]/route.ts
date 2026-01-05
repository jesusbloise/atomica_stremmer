import { NextResponse } from "next/server";
import pool  from "@/db";

const ROLES = new Set(["ADMIN", "PROFESOR", "ESTUDIANTE"]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
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
    if (res.rowCount === 0) return NextResponse.json({ error: "No existe" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } finally {
    client.release();
  }
}
