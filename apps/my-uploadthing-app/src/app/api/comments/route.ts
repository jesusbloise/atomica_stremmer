import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";

// GET /api/comments?uploadId=...
export async function GET(req: NextRequest) {
  const uploadId = req.nextUrl.searchParams.get("uploadId");
  if (!uploadId) return NextResponse.json([], { status: 200 });

  const r = await pool.query(
    `SELECT id, upload_id, user_id, author_name, content, created_at
       FROM comments
      WHERE upload_id = $1
      ORDER BY created_at DESC`,
    [uploadId]
  );
  return NextResponse.json(r.rows, { status: 200 });
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const { uploadId, content, userId } = await req.json().catch(() => ({}));
  if (!uploadId || !content || !userId) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  // (opcional) Obtener nombre del usuario para guardarlo como author_name
  const u = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
  const author_name = u.rows[0]?.name ?? null;

  const ins = await pool.query(
    `INSERT INTO comments (upload_id, user_id, author_name, content, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, upload_id, user_id, author_name, content, created_at`,
    [uploadId, userId, author_name, content]
  );
  return NextResponse.json(ins.rows[0], { status: 200 });
}
