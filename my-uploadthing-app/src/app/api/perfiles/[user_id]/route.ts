import { NextResponse } from "next/server";
import pool from "@/db";

type Params = { user_id: string };

// ✅ En Next actual: params puede ser Promise -> ¡haz await!
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { user_id } = await ctx.params;

  try {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.name, u.email, u.role,
              p.generacion, p.facultad, p.descripcion,
              p.avatar_url, p.instagram, p.facebook, p.whatsapp, p.participaciones
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [user_id]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const row = rows[0];
    if (!Array.isArray(row.participaciones)) row.participaciones = [];

    return NextResponse.json(row);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}



// import { NextResponse } from "next/server";
// import pool from "@/db";

// export async function GET(_req: Request, { params }: { params: { user_id: string } }) {
//   const { rows } = await pool.query(
//     `SELECT u.id AS user_id, u.name, u.email, u.role,
//             p.generacion, p.facultad, p.descripcion,
//             p.avatar_url, p.instagram, p.facebook, p.whatsapp, p.participaciones
//      FROM users u
//      LEFT JOIN profiles p ON p.user_id = u.id
//      WHERE u.id = $1
//      LIMIT 1`,
//     [params.user_id]
//   );
//   if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
//   return NextResponse.json(rows[0]);
// }
