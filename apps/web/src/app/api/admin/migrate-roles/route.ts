import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const viewRes = await pool.query(`
      SELECT pg_get_viewdef('v_profiles'::regclass, true) AS view_sql
    `);

    const viewSql = viewRes.rows[0]?.view_sql;

    await pool.query(`DROP VIEW IF EXISTS v_profiles`);

    await pool.query(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_role_check
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role DROP DEFAULT
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role TYPE text
      USING role::text
    `);

    await pool.query(`
  UPDATE users
  SET role = 'SUPER_ADMIN'
  WHERE email = 'test+300@gmail.com'
`);

    await pool.query(`
      UPDATE users
      SET role = 'USUARIO'
      WHERE role IN ('ESTUDIANTE', 'PROFESOR')
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role SET DEFAULT 'USUARIO'
    `);

    await pool.query(`
      ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USUARIO'))
    `);

    if (viewSql) {
      await pool.query(`CREATE VIEW v_profiles AS ${viewSql}`);
    }

    return NextResponse.json({
      ok: true,
      message: "Roles migrados correctamente",
    });
  } catch (err: any) {
    console.error("MIGRATE ROLE ERROR:", err);

    return NextResponse.json(
      {
        ok: false,
        message: err.message,
        code: err.code,
        detail: err.detail,
        constraint: err.constraint,
      },
      { status: 500 }
    );
  }
}