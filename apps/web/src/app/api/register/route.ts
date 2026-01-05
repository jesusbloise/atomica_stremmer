import { NextResponse } from "next/server";
import  pool  from "@/db";
import bcrypt from "bcryptjs";

type Body = {
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    // Validaciones
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // ¿Existe email? (case-insensitive)
      const exists = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
        [email]
      );
      if (exists.rows.length > 0) {
        return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
      }

      // Hash y alta (DB pone defaults: role=ESTUDIANTE, is_active=true, created_at=now)
      const hash = await bcrypt.hash(password, 10);
      const insertSql = `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, role, is_active, created_at
      `;
      const { rows } = await client.query(insertSql, [name, email, hash]);

      return NextResponse.json({ user: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}



// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import pool from "@/db"; // o { pool } según tu proyecto

// export async function POST(req: Request) {
//   try {
//     const { name, email, password } = await req.json();
//     if (!name || !email || !password) {
//       return NextResponse.json({ error: "Completa todos los campos" }, { status: 400 });
//     }
//     const hash = await bcrypt.hash(password, 10);

//     const r = await pool.query(
//       `INSERT INTO users (name, email, password_hash, role, is_active)
//        VALUES ($1,$2,$3,'ESTUDIANTE',FALSE)
//        RETURNING id, name, email, role, is_active`,
//       [name, email, hash]
//     );

//     return NextResponse.json(r.rows[0], { status: 201 });
//   } catch (e: any) {
//     const msg = e?.code === "23505" ? "Ese correo ya está registrado" : (e?.message || "Error");
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import pool from "@/db"; // o { pool } según tu proyecto

// export async function POST(req: Request) {
//   try {
//     const { name, email, password } = await req.json();
//     if (!name || !email || !password) {
//       return NextResponse.json({ error: "Completa todos los campos" }, { status: 400 });
//     }

//     const hash = await bcrypt.hash(password, 10);
//     const r = await pool.query(
//       `INSERT INTO users (name, email, password_hash, role)
//        VALUES ($1,$2,$3,'ESTUDIANTE')
//        RETURNING id, name, email, role`,
//       [name, email, hash]
//     );

//     return NextResponse.json(r.rows[0], { status: 201 });
//   } catch (e: any) {
//     const msg = e?.code === "23505" ? "Ese correo ya está registrado" : (e?.message || "Error");
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }
