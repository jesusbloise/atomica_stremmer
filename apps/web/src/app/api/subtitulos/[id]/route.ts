export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/db";

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

type Ctx<T extends Record<string, string>> = {
  params: Promise<T>;
};

type JwtPayload = {
  id?: string;
  sub?: string;
  userId?: string;
  role?: string;
};

type AuthUser = {
  id: string;
  role: string;
};

type SubtitleRow = {
  id: number;
  video_id: string | null;
  time_start: number | null;
  time_end: number | null;
  text: string | null;
};

function getAuthenticatedUser(req: Request): AuthUser | null {
  try {
    const cookie = (req.headers.get("cookie") || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith("auth="));

    const rawToken = cookie?.slice("auth=".length);

    if (!rawToken) {
      return null;
    }

    const token = decodeURIComponent(rawToken);

    const payload = jwt.verify(
      token,
      JWT_SECRET
    ) as JwtPayload;

    const id =
      payload.id ??
      payload.sub ??
      payload.userId ??
      null;

    if (!id) {
      return null;
    }

    return {
      id: String(id),
      role: String(payload.role ?? "")
        .trim()
        .toUpperCase(),
    };
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  context: Ctx<{ id: string }>
) {
  const { id } = await context.params;

  try {
    const result = await pool.query<SubtitleRow>(
      `
      SELECT
        id,
        video_id,
        time_start,
        time_end,
        text
      FROM video_subtitulos
      WHERE video_id = $1
      ORDER BY time_start ASC, id ASC
      `,
      [id]
    );

    return NextResponse.json(
      result.rows,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/subtitulos/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los subtítulos",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: Ctx<{ id: string }>
) {
  const currentUser = getAuthenticatedUser(req);

  if (!currentUser) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  if (
    currentUser.role !== "SUPER_ADMIN" &&
    currentUser.role !== "ADMIN"
  ) {
    return NextResponse.json(
      {
        error:
          "No tienes permiso para editar la transcripción",
      },
      { status: 403 }
    );
  }

  const { id: videoId } = await context.params;

  try {
    const body = await req.json();

    const subtitleId = Number(body?.subtitleId);
    const text = String(body?.text ?? "").trim();

    if (
      !Number.isInteger(subtitleId) ||
      subtitleId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "El identificador del subtítulo es inválido",
        },
        { status: 400 }
      );
    }

    if (!text) {
      return NextResponse.json(
        {
          error:
            "El texto del subtítulo no puede quedar vacío",
        },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        {
          error:
            "El texto del subtítulo es demasiado largo",
        },
        { status: 400 }
      );
    }

    const result = await pool.query<SubtitleRow>(
      `
      UPDATE video_subtitulos
      SET text = $1
      WHERE
        id = $2
        AND video_id = $3
      RETURNING
        id,
        video_id,
        time_start,
        time_end,
        text
      `,
      [
        text,
        subtitleId,
        videoId,
      ]
    );

    const updatedSubtitle = result.rows[0];

    if (!updatedSubtitle) {
      return NextResponse.json(
        {
          error:
            "La línea no existe o no pertenece a este video",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        subtitle: updatedSubtitle,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "PATCH /api/subtitulos/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo actualizar la línea de transcripción",
      },
      { status: 500 }
    );
  }
}