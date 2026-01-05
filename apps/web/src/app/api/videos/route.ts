// src/app/api/videos/route.ts
import { NextResponse } from "next/server";
import db from "@/db";
import pool from "@/db";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;

  // video | documento | image | audio | all (default: video)
  const only = (url.searchParams.get("only") || "video").toLowerCase();

  // para detectar por extensión si no tienes "tipo" en la tabla
  const isExt = (exts: string) =>
    `(file_key ~* '\\.(${exts})$' OR file_name ~* '\\.(${exts})$')`;

  let whereKind = "TRUE";
  if (only === "video") whereKind = `(tipo = 'video' OR ${isExt("mp4|mov|mkv|webm|avi")})`;
  else if (only === "documento") whereKind = `(tipo = 'documento' OR ${isExt("pdf|docx|txt|md|csv|log|srt|vtt")})`;
  else if (only === "image") whereKind = `(tipo = 'image' OR ${isExt("jpg|jpeg|png|gif|webp|avif")})`;
  else if (only === "audio") whereKind = `(tipo = 'audio' OR ${isExt("mp3|wav|ogg|m4a")})`;
  // only === "all" -> whereKind = TRUE

  const base = process.env.MINIO_PUBLIC_BASE ?? "http://192.168.229.25:9100/archivos";

  try {
    const { rows } = await db.query(
      `
      SELECT
        id,
        file_name,
        file_key,
        size_in_bytes,
        uploaded_at,
        tipo,
        ($1 || '/' || file_key) AS url
      FROM uploads
      WHERE
        ${whereKind}
        AND (is_deleted IS NOT TRUE)  -- 👈 oculta soft-deleted
      ORDER BY uploaded_at DESC NULLS LAST
      LIMIT $2
      `,
      [base, limit]
    );

    return new NextResponse(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    console.error("❌ list videos error:", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}




// // src/app/api/videos/route.ts
// import { NextResponse } from "next/server";
// import pool from "@/db";

// export async function GET() {
//   try {
//     const result = await pool.query(
//       "SELECT id, file_name, file_key FROM uploads ORDER BY uploaded_at DESC"
//     );

//     // ✅ Solo incluir videos que tienen una file_key válida (evita nulos/vacíos)
//     const videos = result.rows
//       .filter((row) => row.file_key && row.file_key.trim() !== "")
//       .map((row) => ({
//         id: row.id,
//         name: row.file_name,
//         key: row.file_key,
//         url: `http://192.168.229.25:9100/archivos/${row.file_key}`, // Ajusta IP si es necesario
//       }));

//     return NextResponse.json(videos);
//   } catch (error) {
//     console.error("❌ Error al obtener videos:", error);
//     return NextResponse.json({ error: "Error al obtener videos" }, { status: 500 });
//   }
// }


