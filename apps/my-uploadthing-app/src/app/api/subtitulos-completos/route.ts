// /api/subtitulos-completos/route.ts
import  pool  from "@/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await pool.query(`
    SELECT video_id, text
    FROM video_subtitulos
  `);
  return NextResponse.json(result.rows);
}
