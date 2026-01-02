import { NextRequest } from "next/server";
import pool from "@/db";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: videoId } = context.params;

  if (!videoId || videoId === "undefined") {
    return new Response("ID inválido", { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT frame, time_sec, objects FROM video_objects WHERE video_id = $1 ORDER BY frame ASC`,
      [videoId]
    );

    return Response.json(result.rows);
  } catch (error) {
    console.error("❌ Error al consultar objetos:", error);
    return new Response("Error al consultar objetos", { status: 500 });
  }
}
