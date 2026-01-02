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
  { params }: { params: { video_id: string; frame_number: string } }
) {
  const { video_id, frame_number } = params;

  const result = await pool.query(
    `SELECT image_data, mime_type FROM video_frames 
     WHERE video_id = $1 AND frame_number = $2 
     LIMIT 1`,
    [video_id, Number(frame_number)]
  );

  if (result.rowCount === 0) {
    return new Response("No encontrada", { status: 404 });
  }

  const { image_data, mime_type } = result.rows[0];

  return new Response(image_data, {
    headers: {
      "Content-Type": mime_type || "image/jpeg",
      "Content-Length": image_data.length.toString(),
    },
  });
}

