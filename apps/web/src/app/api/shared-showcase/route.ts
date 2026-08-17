import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHOWCASE_VIDEO_IDS = [
  "5909f5b1-20b8-4a6e-aca3-bd70870f6513", // Spot Stock Library
  "0f639512-5ec9-4266-ab0a-abcbce96fb38", // Spot Atomica Valora
  "eeb2c14c-2f68-4f7b-b477-d32b2a7a6139", // Reel Genérico 2026
  "ce49f9e7-3c7f-49bc-89f2-31e48760a5e0", // Demo reel IA Productos
];

const SHOWCASE_TITLES: Record<string, string> = {
  "5909f5b1-20b8-4a6e-aca3-bd70870f6513":
    "Spot Stock Library",

  "0f639512-5ec9-4266-ab0a-abcbce96fb38":
    "Spot Atomica Valora",

  "eeb2c14c-2f68-4f7b-b477-d32b2a7a6139":
    "Reel Genérico 2026",

  "ce49f9e7-3c7f-49bc-89f2-31e48760a5e0":
    "Demo Reel IA Productos",
};

function hashShareToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

type ShowcaseRow = {
  id: string;
  file_name: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  uploaded_at: string | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const sourceId = String(
      searchParams.get("sourceId") || ""
    ).trim();

    const rawShareToken = String(
      searchParams.get("share") || ""
    ).trim();

    if (!sourceId || !rawShareToken) {
      return NextResponse.json(
        {
          error:
            "Falta el archivo de origen o el token compartido.",
        },
        { status: 400 }
      );
    }

    const tokenHash =
      hashShareToken(rawShareToken);

    /*
     * El token debe pertenecer al archivo
     * originalmente compartido.
     */
    const shareResult = await pool.query(
      `
      SELECT id
      FROM upload_share_links
      WHERE
        upload_id::text = $1::text
        AND token_hash = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `,
      [sourceId, tokenHash]
    );

    if (!shareResult.rowCount) {
      return NextResponse.json(
        {
          error:
            "El enlace compartido no es válido, venció o fue revocado.",
        },
        { status: 403 }
      );
    }

    const result =
      await pool.query<ShowcaseRow>(
        `
        SELECT
          id,
          file_name,
          thumbnail_url,
          duration_sec,
          uploaded_at
        FROM uploads
        WHERE
          id::text = ANY($1::text[])
          AND is_deleted IS NOT TRUE
        `,
        [SHOWCASE_VIDEO_IDS]
      );

    /*
     * Conservamos exactamente el orden comercial
     * definido en SHOWCASE_VIDEO_IDS.
     */
    const rowMap = new Map(
      result.rows.map((row) => [
        String(row.id),
        row,
      ])
    );

    const rows = SHOWCASE_VIDEO_IDS
      .map((videoId) => {
        const row = rowMap.get(videoId);

        if (!row) {
          return null;
        }

        return {
          ...row,
          title:
            SHOWCASE_TITLES[videoId] ||
            row.file_name ||
            "Proyecto Atomica",

          shareUrl:
            `/videos/${videoId}` +
            `?share=${encodeURIComponent(
              rawShareToken
            )}` +
            `&source=${encodeURIComponent(
              sourceId
            )}`,
        };
      })
      .filter(Boolean);

    return NextResponse.json(
      {
        rows,
        total: rows.length,
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
      "GET /api/shared-showcase error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar los proyectos de Atomica.",
      },
      { status: 500 }
    );
  }
}