// /api/escenas/[id]/route.ts
import pool from "@/db";

// import { Pool } from "pg";

// const pool = new Pool({
//   user: "postgres",
//   host: "prueba-db-1",
//   database: "Prueba-atomica-gratis",
//   password: "atomica",
//   port: 5432,
// });

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;

  try {
    const result = await pool.query(
      `SELECT scene_index, start_time, end_time FROM scene_segments WHERE video_id = $1 ORDER BY scene_index`,
      [videoId]
    );
    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error al obtener escenas:", err);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


// import db from "@/db";
// import { NextResponse } from "next/server";

// export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
//     const { id } = await context.params
//     if (!id) {
//         return NextResponse.json({ error: "ID no definido" }, { status: 400 });
//     }

//     try {
//         const result = await db.query(
//             `SELECT * FROM scene_segments
//        WHERE video_id = $1
//        ORDER BY scene_index ASC`,
//             [id]
//         );

//         return NextResponse.json(result.rows);
//     } catch (error) {
//         console.error("❌ Error al obtener escenas:", error);
//         return NextResponse.json({ error: "Error al obtener escenas" }, { status: 500 });
//     }
// }
