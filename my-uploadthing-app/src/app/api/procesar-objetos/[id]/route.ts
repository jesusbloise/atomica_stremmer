import { spawn } from "child_process";
import path from "path";
import fs from "fs";
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
  context: { params: { id: string } }
) {
  const videoId = context.params.id;
  const basePath = process.cwd();
  const scriptPath = path.join(basePath, "processor", "procesar_objetos.py");

  console.log("▶ Ejecutando script de objetos (asíncrono):", videoId);

  return new Promise((resolve) => {
    const process = spawn("python", [scriptPath, videoId], {
      cwd: basePath,
      shell: true,
    });

    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", async (code) => {
      if (code === 0) {
        console.log("✅ Procesamiento terminado.");
        const jsonPath = path.join(basePath, "processor", `objetos_${videoId}.json`);

        try {
          if (fs.existsSync(jsonPath)) {
            const raw = fs.readFileSync(jsonPath, "utf-8");
            const detections = JSON.parse(raw);

            for (const d of detections) {
              await pool.query(
                `INSERT INTO video_objects (video_id, frame, time_sec, objects)
                 VALUES ($1, $2, $3, $4)`,
                [videoId, d.frame, d.time_sec, d.objects]
              );
            }

            console.log("🗃️ Objetos guardados en la base de datos.");
          }
        } catch (dbError) {
          console.error("❌ Error al guardar en la base de datos:", dbError);
          return resolve(
            new Response(
              JSON.stringify({ status: "error", message: "Error al guardar en la base de datos" }),
              { status: 500 }
            )
          );
        }

        return resolve(
          new Response(JSON.stringify({ status: "ok", output }), {
            status: 200,
          })
        );
      } else {
        console.error("❌ Error en el script:", errorOutput);
        return resolve(
          new Response(
            JSON.stringify({ status: "error", message: errorOutput }),
            { status: 500 }
          )
        );
      }
    });
  });
}
