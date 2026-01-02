import pool from "@/db";

// import { Pool } from "pg";

// const pool = new Pool({
//     user: "postgres",
//     host: "prueba-db-1",
//     database: "Prueba-atomica-gratis",
//     password: "atomica",
//     port: 5432,
// });

export async function GET(
    req: Request,
    context: { params: { id: string } }
) {
    const videoId = context.params.id;

    try {
        const result = await pool.query(
            `SELECT 
            video_id,
         frame,
         rostro_detectado,
         mano_izq_arriba,
         time_sec,
         l_shoulder_x,
         l_shoulder_y,
         l_shoulder_z,
         l_wrist_x,
         l_wrist_y,
         l_wrist_z,
         frame_path
       FROM video_poses
       WHERE video_id = $1
       ORDER BY frame`,
            [videoId]
        );

        return new Response(JSON.stringify(result.rows), { status: 200 });

    } catch (err) {
        console.error("❌ Error al leer posturas:", err);
        return new Response("Error al leer posturas", { status: 500 });
    }
}
