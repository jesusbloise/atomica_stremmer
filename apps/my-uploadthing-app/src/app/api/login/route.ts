
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// Usa el import que aplique en tu proyecto:
import pool from "@/db";           // si "@/db" exporta default
// import { pool } from "@/db";    // si exporta nombrado

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Completa todos los campos" }, { status: 400 });
    }

    const r = await pool.query("SELECT * FROM users WHERE email=$1 AND is_active=TRUE", [email]);
    const user = r.rows[0];
    if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const token = jwt.sign(
      { sub: user.id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
    res.cookies.set("auth", token, {
      httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

