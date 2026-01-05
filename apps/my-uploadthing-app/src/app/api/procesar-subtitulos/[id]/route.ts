export const runtime = "nodejs";

import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import pool from "@/db"; // asegúrate que apunta a localhost en local

function getPythonCmd() {
  // En Windows suele ser "python" o "py -3"
  if (process.platform === "win32") return "python";
  return "python3";
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;

  try {
    // 1) Si ya existen subtítulos, no reprocesar
    const pre = await pool.query(
      "SELECT 1 FROM video_subtitulos WHERE video_id = $1 LIMIT 1",
      [videoId]
    );
if (pre && typeof pre.rowCount === "number" && pre.rowCount > 0) {

      return NextResponse.json({ success: true, message: "Ya procesado" });
    }

    // 2) Ejecutar script
    const scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
    const pythonCmd = getPythonCmd();

    let stdoutBuf = "";
    let stderrBuf = "";

    const child = spawn(pythonCmd, [scriptPath, videoId], {
      cwd: process.cwd(),
      shell: true,
    });

    child.stdout.on("data", (d) => (stdoutBuf += d.toString()));
    child.stderr.on("data", (d) => (stderrBuf += d.toString()));

    const exitCode: number = await new Promise((resolve) => {
      child.on("error", () => resolve(999)); // error de spawn
      child.on("close", (code) => resolve(code ?? 999));
    });

    // 3) Si falló, devuélveme logs para ver el motivo
    if (exitCode !== 0) {
      return NextResponse.json(
        {
          success: false,
          message: "El script falló",
          exitCode,
          stdout: stdoutBuf,
          stderr: stderrBuf,
        },
        { status: 500 }
      );
    }

    // 4) Re-verificar en DB (para confirmar que insertó)
    const post = await pool.query(
      "SELECT time_start, time_end, text FROM video_subtitulos WHERE video_id = $1 ORDER BY time_start ASC",
      [videoId]
    );

    return NextResponse.json({
      success: true,
      inserted_rows: post.rowCount,
      rows: post.rows,
      stdout: stdoutBuf, // quítalos luego; útiles ahora
      stderr: stderrBuf, // quítalos luego; útiles ahora
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: "Error inesperado", error: String(err) },
      { status: 500 }
    );
  }
}

