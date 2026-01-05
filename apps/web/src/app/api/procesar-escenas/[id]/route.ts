// /api/procesar-escenas/[id]/route.ts
import { exec } from "child_process";
import path from "path";
import pool from "@/db";

// import { Pool } from "pg";

// const pool = new Pool({
//   user: "postgres",
//   host: "prueba-db-1",
//   database: "Prueba-atomica-gratis",
//   password: "atomica",
//   port: 5432,
// });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;

  // Verificar si ya hay escenas
const check = await pool.query(
  "SELECT COUNT(*) FROM scene_segments WHERE video_id = $1",
  [videoId]
);


  if (Number(check.rows[0].count) > 0) {
    return new Response(JSON.stringify({ success: false, message: "Ya existen escenas" }), { status: 200 });
  }

  const basePath = process.cwd();
  const scriptPath = path.join(basePath, "processor", "procesar_escenas.py");

  return new Promise((resolve) => {
    const proceso = exec(`python "${scriptPath}" ${videoId}`, { cwd: basePath });

    let output = "";
    let error = "";

    proceso.stdout?.on("data", (data) => output += data);
    proceso.stderr?.on("data", (data) => error += data);

    proceso.on("close", (code) => {
      if (code === 0) {
        resolve(new Response(JSON.stringify({ success: true, output }), { status: 200 }));
      } else {
        console.error("❌ Error escena:", error);
        resolve(new Response(JSON.stringify({ success: false, error }), { status: 500 }));
      }
    });
  });
}
