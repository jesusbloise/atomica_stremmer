export const runtime = "nodejs";

import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import pool from "@/db";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();
const BUCKET = process.env.GCS_BUCKET;

function parseGsUri(gsUri: string) {
  const m = gsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], key: m[2] };
}

function getPythonCmd() {
  // En Cloud Run: python3
  return process.platform === "win32" ? "python" : "python3";
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const videoId = params.id;

  try {
    if (!BUCKET) {
      return NextResponse.json({ success: false, message: "Falta GCS_BUCKET" }, { status: 500 });
    }

    // 1) Si ya existen subtítulos, no reprocesar
    const pre = await pool.query("SELECT 1 FROM video_subtitulos WHERE video_id = $1 LIMIT 1", [videoId]);
    if (pre.rowCount && pre.rowCount > 0) {
      return NextResponse.json({ success: true, message: "Ya procesado" });
    }

    // 2) Buscar el upload
    const q = await pool.query("SELECT file_path, file_key FROM uploads WHERE id = $1 LIMIT 1", [videoId]);
    const row = q.rows[0];
    if (!row) return NextResponse.json({ success: false, message: "Upload no existe" }, { status: 404 });

    const filePath: string | null = row.file_path ?? null;
    const fileKey: string | null = row.file_key ?? null;

    // 3) Resolver un URL HTTP descargable
    let videoUrl: string | null = null;

    if (filePath && /^https?:\/\//i.test(filePath)) {
      videoUrl = filePath;
    } else {
      const gsUri = filePath && filePath.startsWith("gs://")
        ? filePath
        : (fileKey ? `gs://${BUCKET}/${fileKey}` : null);

      if (!gsUri) {
        return NextResponse.json({ success: false, message: "No hay file_path ni file_key" }, { status: 500 });
      }

      const parsed = parseGsUri(gsUri);
      if (!parsed) {
        return NextResponse.json({ success: false, message: "file_path inválido (no es gs://)" }, { status: 500 });
      }

      const gcsFile = storage.bucket(parsed.bucket).file(parsed.key);

      // signed URL 1 hora
      const [signedUrl] = await gcsFile.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 1000 * 60 * 60,
      });

      videoUrl = signedUrl;
    }

    // 4) Ejecutar script (SIN shell para no romper la signed URL)
    const scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
    const pythonCmd = getPythonCmd();

    let stdoutBuf = "";
    let stderrBuf = "";

    const child = spawn(pythonCmd, [scriptPath, videoId, videoUrl], {
      cwd: process.cwd(),
      shell: false,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

child.stdout.on("data", (d) => (stdoutBuf += Buffer.from(d).toString("utf8")));
child.stderr.on("data", (d) => (stderrBuf += Buffer.from(d).toString("utf8")));

    const exitCode: number = await new Promise((resolve) => {
      child.on("error", () => resolve(999));
      child.on("close", (code) => resolve(code ?? 999));
    });

    if (exitCode !== 0) {
      return NextResponse.json(
        { success: false, message: "El script falló", exitCode, stdout: stdoutBuf, stderr: stderrBuf },
        { status: 500 }
      );
    }

    // 5) Confirmar inserts
    const post = await pool.query(
      "SELECT time_start, time_end, text FROM video_subtitulos WHERE video_id = $1 ORDER BY time_start ASC",
      [videoId]
    );

    return NextResponse.json({
      success: true,
      inserted_rows: post.rowCount,
      rows: post.rows,
      stdout: stdoutBuf,
      stderr: stderrBuf,
    });
  } catch (err: any) {
    console.error("❌ /api/procesar-subtitulos error:", err);
    return NextResponse.json({ success: false, message: "Error inesperado", error: String(err) }, { status: 500 });
  }
}
// export const runtime = "nodejs";

// import { spawn } from "child_process";
// import path from "path";
// import { NextResponse } from "next/server";
// import pool from "@/db";
// import { Storage } from "@google-cloud/storage";

// const storage = new Storage();
// const BUCKET = process.env.GCS_BUCKET;

// function getPythonCmd() {
//   if (process.platform === "win32") return "python";
//   return "python3";
// }

// function parseGsUri(gsUri: string) {
//   // gs://bucket/key
//   const m = gsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
//   if (!m) return null;
//   return { bucket: m[1], key: m[2] };
// }

// export async function POST(_req: Request, { params }: { params: { id: string } }) {
//   const videoId = params.id;

//   try {
//     if (!BUCKET) {
//       return NextResponse.json({ success: false, message: "Falta GCS_BUCKET" }, { status: 500 });
//     }

//     // 1) Si ya existen subtítulos, no reprocesar
//     const pre = await pool.query(
//       "SELECT 1 FROM video_subtitulos WHERE video_id = $1 LIMIT 1",
//       [videoId]
//     );
//     if (pre.rowCount && pre.rowCount > 0) {
//       return NextResponse.json({ success: true, message: "Ya procesado" });
//     }

//     // 2) Buscar el file_path / file_key del upload
//     const q = await pool.query(
//       "SELECT file_path, file_key FROM uploads WHERE id = $1 LIMIT 1",
//       [videoId]
//     );
//     const row = q.rows[0];
//     if (!row) {
//       return NextResponse.json({ success: false, message: "Upload no existe" }, { status: 404 });
//     }

//     const filePath: string | null = row.file_path ?? null;
//     const fileKey: string | null = row.file_key ?? null;

//     // 3) Resolver URL HTTP descargable (SIN MinIO)
//     // - Si file_path es gs:// -> firmamos un URL HTTP temporal
//     // - Si file_path ya es http(s) -> lo usamos
//     // - Si no hay file_path http/gs -> usamos file_key con el bucket
//     let videoUrl: string | null = null;

//     if (filePath && /^https?:\/\//i.test(filePath)) {
//       videoUrl = filePath;
//     } else {
//       // Si viene gs://... o si solo tenemos file_key
//       const gsUri = filePath && filePath.startsWith("gs://")
//         ? filePath
//         : (fileKey ? `gs://${BUCKET}/${fileKey}` : null);

//       if (!gsUri) {
//         return NextResponse.json({ success: false, message: "No hay file_path ni file_key" }, { status: 500 });
//       }

//       const parsed = parseGsUri(gsUri);
//       if (!parsed) {
//         return NextResponse.json({ success: false, message: "file_path inválido (no es gs://)" }, { status: 500 });
//       }

//       const gcsFile = storage.bucket(parsed.bucket).file(parsed.key);

//       // URL temporal para que el script descargue por HTTP
//       const [signedUrl] = await gcsFile.getSignedUrl({
//         version: "v4",
//         action: "read",
//         expires: Date.now() + 1000 * 60 * 60, // 1 hora
//       });

//       videoUrl = signedUrl;
//     }

//     // 4) Ejecutar script y pasarle: videoId + videoUrl
//     const scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
//     const pythonCmd = getPythonCmd();

//     let stdoutBuf = "";
//     let stderrBuf = "";

//     const child = spawn(pythonCmd, [scriptPath, videoId, videoUrl], {
//       cwd: process.cwd(),
//       shell: true,
//     });

//     child.stdout.on("data", (d) => (stdoutBuf += d.toString()));
//     child.stderr.on("data", (d) => (stderrBuf += d.toString()));

//     const exitCode: number = await new Promise((resolve) => {
//       child.on("error", () => resolve(999));
//       child.on("close", (code) => resolve(code ?? 999));
//     });

//     if (exitCode !== 0) {
//       return NextResponse.json(
//         { success: false, message: "El script falló", exitCode, stdout: stdoutBuf, stderr: stderrBuf },
//         { status: 500 }
//       );
//     }

//     // 5) Confirmar inserts
//     const post = await pool.query(
//       "SELECT time_start, time_end, text FROM video_subtitulos WHERE video_id = $1 ORDER BY time_start ASC",
//       [videoId]
//     );

//     return NextResponse.json({
//       success: true,
//       inserted_rows: post.rowCount,
//       rows: post.rows,
//       stdout: stdoutBuf,
//       stderr: stderrBuf,
//     });
//   } catch (err: any) {
//     console.error("❌ /api/procesar-subtitulos error:", err);
//     return NextResponse.json(
//       { success: false, message: "Error inesperado", error: String(err) },
//       { status: 500 }
//     );
//   }
// }


// export const runtime = "nodejs";

// import { spawn } from "child_process";
// import path from "path";
// import { NextResponse } from "next/server";
// import pool from "@/db"; // asegúrate que apunta a localhost en local

// function getPythonCmd() {
//   // En Windows suele ser "python" o "py -3"
//   if (process.platform === "win32") return "python";
//   return "python3";
// }

// export async function POST(
//   _req: Request,
//   { params }: { params: { id: string } }
// ) {
//   const videoId = params.id;

//   try {
//     // 1) Si ya existen subtítulos, no reprocesar
//     const pre = await pool.query(
//       "SELECT 1 FROM video_subtitulos WHERE video_id = $1 LIMIT 1",
//       [videoId]
//     );
// if (pre && typeof pre.rowCount === "number" && pre.rowCount > 0) {

//       return NextResponse.json({ success: true, message: "Ya procesado" });
//     }

//     // 2) Ejecutar script
//     const scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
//     const pythonCmd = getPythonCmd();

//     let stdoutBuf = "";
//     let stderrBuf = "";

//     const child = spawn(pythonCmd, [scriptPath, videoId], {
//       cwd: process.cwd(),
//       shell: true,
//     });

//     child.stdout.on("data", (d) => (stdoutBuf += d.toString()));
//     child.stderr.on("data", (d) => (stderrBuf += d.toString()));

//     const exitCode: number = await new Promise((resolve) => {
//       child.on("error", () => resolve(999)); // error de spawn
//       child.on("close", (code) => resolve(code ?? 999));
//     });

//     // 3) Si falló, devuélveme logs para ver el motivo
//     if (exitCode !== 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "El script falló",
//           exitCode,
//           stdout: stdoutBuf,
//           stderr: stderrBuf,
//         },
//         { status: 500 }
//       );
//     }

//     // 4) Re-verificar en DB (para confirmar que insertó)
//     const post = await pool.query(
//       "SELECT time_start, time_end, text FROM video_subtitulos WHERE video_id = $1 ORDER BY time_start ASC",
//       [videoId]
//     );

//     return NextResponse.json({
//       success: true,
//       inserted_rows: post.rowCount,
//       rows: post.rows,
//       stdout: stdoutBuf, // quítalos luego; útiles ahora
//       stderr: stderrBuf, // quítalos luego; útiles ahora
//     });
//   } catch (err: any) {
//     return NextResponse.json(
//       { success: false, message: "Error inesperado", error: String(err) },
//       { status: 500 }
//     );
//   }
// }

