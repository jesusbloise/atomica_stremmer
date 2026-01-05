export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/db";

// import { Pool } from "pg";

// // ✅ CAMBIO IMPORTANTE: usar "db" como host para Docker
// const pool = new Pool({
//   user: "postgres",
//   host: process.env.PGHOST || "prueba-db-1",  // prueba-db-1
//   database: "Prueba-atomica-gratis",
//   password: "atomica",
//   port: 5432,
// });

type Ctx<T extends Record<string, string>> = { params: Promise<T> };

export async function GET(
  _req: Request,
  context: Ctx<{ id: string }>
) {
  const { id } = await context.params;   // 👈 importante: await
  const videoId = id;

  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT time_start, time_end, text FROM video_subtitulos WHERE video_id = $1 ORDER BY time_start ASC`,
      [videoId]
    );
    client.release();

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("❌ Error al obtener subtítulos:", error);
    return new NextResponse("Error interno del servidor", { status: 500 });
  }
}
