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

// PATCH /api/admin/users/:id
// body: { role?: "ADMIN"|"PROFESOR"|"ESTUDIANTE", is_active?: boolean }
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 params es una promesa en Next 15
) {
  try {
    ensureAdmin(req);

    const { id } = await ctx.params;     // 👈 await aquí
    const body = await req.json();

    const allowedRoles = ["ADMIN","PROFESOR","ESTUDIANTE"];
    const updates: string[] = [];
    const vals: any[] = [];

    if (typeof body.is_active === "boolean") {
      vals.push(body.is_active);
      updates.push(`is_active = $${vals.length}`);
    }
    if (body.role && allowedRoles.includes(body.role)) {
      vals.push(body.role);
      updates.push(`role = $${vals.length}`);
    }

    if (!updates.length) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    vals.push(id);
    const sql = `
      UPDATE users SET ${updates.join(", ")}
      WHERE id = $${vals.length}
      RETURNING id, name, email, role, is_active
    `;
    const r = await pool.query(sql, vals);
    if (r.rowCount === 0) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }

    return NextResponse.json(r.rows[0], { status: 200 });
  } catch (e: any) {
    if (e?.message === "forbidden") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }
    console.error("PATCH /api/admin/users/[id] error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}


// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";
// import pool from "@/db";

// const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

// function ensureAdmin(req: Request) {
//   try {
//     const cookie = (req.headers.get("cookie") || "")
//       .split(";").map(v => v.trim()).find(v => v.startsWith("auth="));
//     const token = cookie?.split("=")?.[1];
//     const p = token ? (jwt.verify(token, JWT_SECRET) as any) : null;
//     if (!p || p.role !== "ADMIN") throw new Error("forbidden");
//     return p;
//   } catch { throw new Error("forbidden"); }
// }

// // PATCH /api/admin/users/:id  body: { role?: "ADMIN"|"PROFESOR"|"ESTUDIANTE", is_active?: boolean }
// export async function PATCH(req: Request, ctx: { params: { id: string } }) {
//   try {
//     ensureAdmin(req);
//     const { id } = ctx.params;
//     const body = await req.json();

//     const allowedRoles = ["ADMIN","PROFESOR","ESTUDIANTE"];
//     const updates: string[] = [];
//     const vals: any[] = [];

//     if (typeof body.is_active === "boolean") {
//       vals.push(body.is_active);
//       updates.push(`is_active = $${vals.length}`);
//     }
//     if (body.role && allowedRoles.includes(body.role)) {
//       vals.push(body.role);
//       updates.push(`role = $${vals.length}`);
//     }

//     if (!updates.length) {
//       return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
//     }

//     vals.push(id);
//     const sql = `
//       UPDATE users SET ${updates.join(", ")}
//       WHERE id = $${vals.length}
//       RETURNING id, name, email, role, is_active
//     `;
//     const r = await pool.query(sql, vals);
//     if (r.rowCount === 0) return NextResponse.json({ error: "No existe" }, { status: 404 });

//     return NextResponse.json(r.rows[0]);
//   } catch {
//     return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
//   }
// }
