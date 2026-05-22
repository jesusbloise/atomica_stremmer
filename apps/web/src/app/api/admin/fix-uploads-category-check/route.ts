import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await pool.query(`
      ALTER TABLE uploads
      DROP CONSTRAINT IF EXISTS uploads_category_check
    `);

    return NextResponse.json({
      ok: true,
      message: "Constraint uploads_category_check eliminado",
    });
  } catch (err) {
    console.error("fix uploads category check error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo eliminar el constraint",
      },
      { status: 500 }
    );
  }
}