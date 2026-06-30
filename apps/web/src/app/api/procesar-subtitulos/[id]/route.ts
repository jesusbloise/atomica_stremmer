export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import pool from "@/db";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getR2SignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/r2";

function parseR2Url(raw?: string | null) {
  if (!raw || !raw.startsWith("r2://")) return null;

  const clean = raw.slice(5);
  const slash = clean.indexOf("/");
  if (slash === -1) return null;

  const bucket = clean.slice(0, slash);
  const objectPath = clean.slice(slash + 1);

  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

function getPythonCmd() {
  return process.platform === "win32" ? "python" : "python3";
}

async function buildR2SignedUrl(r2Path: string) {
  const parsed = parseR2Url(r2Path);

  if (!parsed) {
    throw new Error("r2_path inválido");
  }

  const r2Client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.objectPath,
  });

  return getR2SignedUrl(r2Client, command, {
    expiresIn: 60 * 60,
  });
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await context.params;

  try {
    const pre = await pool.query(
      "SELECT 1 FROM video_subtitulos WHERE video_id = $1 LIMIT 1",
      [videoId]
    );

    if (pre.rowCount && pre.rowCount > 0) {
      return NextResponse.json({ success: true, message: "Ya procesado" });
    }

    const q = await pool.query(
      `
      SELECT id, r2_path, file_path, file_key
      FROM uploads
      WHERE id = $1
      LIMIT 1
      `,
      [videoId]
    );

    const row = q.rows[0];

    if (!row) {
      return NextResponse.json(
        { success: false, message: "Upload no existe" },
        { status: 404 }
      );
    }

    const r2Path: string | null = row.r2_path ?? null;

    if (!r2Path || !r2Path.startsWith("r2://")) {
      return NextResponse.json(
        {
          success: false,
          message: "El video no está disponible en R2 para procesar subtítulos",
          details: {
            id: row.id,
            r2_path: row.r2_path,
            file_path: row.file_path,
            file_key: row.file_key,
          },
        },
        { status: 400 }
      );
    }

    const videoUrl = await buildR2SignedUrl(r2Path);

    const scriptPath = path.join(
      process.cwd(),
      "processor",
      "procesar_subtitulos.py"
    );

    const pythonCmd = getPythonCmd();

    let stdoutBuf = "";
    let stderrBuf = "";

    const child = spawn(pythonCmd, [scriptPath, videoId, videoUrl], {
      cwd: process.cwd(),
      shell: false,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    child.stdout.on("data", (d) => {
      stdoutBuf += Buffer.from(d).toString("utf8");
    });

    child.stderr.on("data", (d) => {
      stderrBuf += Buffer.from(d).toString("utf8");
    });

    const exitCode: number = await new Promise((resolve) => {
      child.on("error", () => resolve(999));
      child.on("close", (code) => resolve(code ?? 999));
    });

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

    const post = await pool.query(
      `
      SELECT time_start, time_end, text
      FROM video_subtitulos
      WHERE video_id = $1
      ORDER BY time_start ASC
      `,
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
    console.error("POST /api/procesar-subtitulos/[id] error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Error procesando subtítulos",
      },
      { status: 500 }
    );
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

// function parseGsUri(gsUri: string) {
//   const m = gsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
//   if (!m) return null;
//   return { bucket: m[1], key: m[2] };
// }

// function getPythonCmd() {
//   // En Cloud Run: python3
//   return process.platform === "win32" ? "python" : "python3";
// }

// export async function POST(_req: Request, { params }: { params: { id: string } }) {
//   const videoId = params.id;

//   try {
//     if (!BUCKET) {
//       return NextResponse.json({ success: false, message: "Falta GCS_BUCKET" }, { status: 500 });
//     }

//     // 1) Si ya existen subtítulos, no reprocesar
//     const pre = await pool.query("SELECT 1 FROM video_subtitulos WHERE video_id = $1 LIMIT 1", [videoId]);
//     if (pre.rowCount && pre.rowCount > 0) {
//       return NextResponse.json({ success: true, message: "Ya procesado" });
//     }

//     // 2) Buscar el upload
//     const q = await pool.query("SELECT file_path, file_key FROM uploads WHERE id = $1 LIMIT 1", [videoId]);
//     const row = q.rows[0];
//     if (!row) return NextResponse.json({ success: false, message: "Upload no existe" }, { status: 404 });

//     const filePath: string | null = row.file_path ?? null;
//     const fileKey: string | null = row.file_key ?? null;

//     // 3) Resolver un URL HTTP descargable
//     let videoUrl: string | null = null;

//     if (filePath && /^https?:\/\//i.test(filePath)) {
//       videoUrl = filePath;
//     } else {
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

//       // signed URL 1 hora
//       const [signedUrl] = await gcsFile.getSignedUrl({
//         version: "v4",
//         action: "read",
//         expires: Date.now() + 1000 * 60 * 60,
//       });

//       videoUrl = signedUrl;
//     }

//     // 4) Ejecutar script (SIN shell para no romper la signed URL)
//     const scriptPath = path.join(process.cwd(), "processor", "procesar_subtitulos.py");
//     const pythonCmd = getPythonCmd();

//     let stdoutBuf = "";
//     let stderrBuf = "";

//     const child = spawn(pythonCmd, [scriptPath, videoId, videoUrl], {
//       cwd: process.cwd(),
//       shell: false,
//       env: { ...process.env, PYTHONUNBUFFERED: "1" },
//     });

// child.stdout.on("data", (d) => (stdoutBuf += Buffer.from(d).toString("utf8")));
// child.stderr.on("data", (d) => (stderrBuf += Buffer.from(d).toString("utf8")));

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
//     return NextResponse.json({ success: false, message: "Error inesperado", error: String(err) }, { status: 500 });
//   }
// }
