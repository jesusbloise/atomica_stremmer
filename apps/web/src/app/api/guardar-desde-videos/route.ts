import { generarSignedUrl } from "@/lib/generarSignedUrl";
import pool from "@/db";

export async function POST(req: Request) {
  const body = await req.json();
  const { id, fileKey, name, url } = body;

  try {
    const signedUrl = await generarSignedUrl(fileKey);

    await pool.query(
      `INSERT INTO uploads (id, name, url, file_key, signed_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name, url, fileKey, signedUrl]
    );

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("❌ Error al guardar video con URL firmada:", error);
    return new Response("Error interno", { status: 500 });
  }
}

