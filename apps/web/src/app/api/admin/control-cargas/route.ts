import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

type UploadControlRow = {
  id: string;
  file_name: string;
  uploaded_at: string;
  tipo: string | null;
  category: string | null;
  subcategory: string | null;
  created_by_id: string | null;

  user_name: string | null;
  user_email: string | null;

  ficha_exists: boolean;
  titulo: string | null;
  marca: string | null;
  agencia: string | null;
  productora: string | null;
  contacto: string | null;
  oficina: string | null;
  ficha_tipo: string[] | string | null;
  duracion: string | null;
  formato: string | null;
  fecha: string | null;
};

type FieldDefinition = {
  key:
    | "titulo"
    | "marca"
    | "agencia"
    | "productora"
    | "contacto"
    | "oficina"
    | "ficha_tipo"
    | "duracion"
    | "formato"
    | "fecha";
  label: string;
};

const REQUIRED_FIELDS: FieldDefinition[] = [
  { key: "titulo", label: "Título" },
  { key: "marca", label: "Marca" },
  { key: "agencia", label: "Agencia" },
  { key: "productora", label: "Productora" },
  { key: "contacto", label: "Contacto" },
  { key: "oficina", label: "Oficina" },
  { key: "ficha_tipo", label: "Tipo" },
  { key: "duracion", label: "Duración" },
  { key: "formato", label: "Formato" },
  { key: "fecha", label: "Fecha" },
];

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).trim().length > 0);
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    return (
      normalized.length > 0 &&
      normalized !== "{}" &&
      normalized !== "[]" &&
      normalized.toLowerCase() !== "null"
    );
  }

  return true;
}

function calculateFicha(row: UploadControlRow) {
  if (!row.ficha_exists) {
    return {
      status: "WITHOUT_FICHA" as const,
      completion: 0,
      completedFields: 0,
      totalFields: REQUIRED_FIELDS.length,
      missingFields: REQUIRED_FIELDS.map((field) => field.label),
    };
  }

  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !hasValue(row[field.key])
  ).map((field) => field.label);

  const completedFields = REQUIRED_FIELDS.length - missingFields.length;

  const completion = Math.round(
    (completedFields / REQUIRED_FIELDS.length) * 100
  );

  const status =
    completion === 100
      ? ("COMPLETE" as const)
      : completedFields === 0
        ? ("EMPTY" as const)
        : ("INCOMPLETE" as const);

  return {
    status,
    completion,
    completedFields,
    totalFields: REQUIRED_FIELDS.length,
    missingFields,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const role = String(session.role || "")
      .trim()
      .toUpperCase();

    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json(
        { error: "No tienes permisos para ver el control de cargas" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search = String(searchParams.get("search") || "").trim();
    const userId = String(searchParams.get("userId") || "").trim();
    const requestedStatus = String(
      searchParams.get("status") || "all"
    )
      .trim()
      .toUpperCase();

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") || "20", 10) || 20
      )
    );

    const query = `
      SELECT
        u.id,
        u.file_name,
        u.uploaded_at,
        u.tipo,
        u.category,
        u.subcategory,
        u.created_by_id,

        usr.name AS user_name,
        usr.email AS user_email,

        (ft.upload_id IS NOT NULL) AS ficha_exists,
        ft.titulo,
        ft.marca,
        ft.agencia,
        ft.productora,
        ft.contacto,
        ft.oficina,
        ft.tipo AS ficha_tipo,
        ft.duracion,
        ft.formato,
        ft.fecha

      FROM uploads u

      LEFT JOIN users usr
        ON (
          CASE
            WHEN u.created_by_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN u.created_by_id::uuid
            ELSE NULL
          END
        ) = usr.id

      LEFT JOIN ficha_tecnica ft
        ON ft.upload_id = u.id

      WHERE COALESCE(u.is_deleted, FALSE) = FALSE

      ORDER BY u.uploaded_at DESC
    `;

    const result = await pool.query<UploadControlRow>(query);

    const evaluatedUploads = result.rows.map((row) => {
      const ficha = calculateFicha(row);

      return {
        id: row.id,
        fileName: row.file_name,
        uploadedAt: row.uploaded_at,
        tipo: row.tipo,
        category: row.category,
        subcategory: row.subcategory,

        createdById: row.created_by_id,
        uploadedBy: {
          id: row.created_by_id,
          name: row.user_name,
          email: row.user_email,
        },

        ficha: {
          exists: row.ficha_exists,
          ...ficha,
        },
      };
    });

    const filteredUploads = evaluatedUploads.filter((upload) => {
      if (userId && upload.createdById !== userId) {
        return false;
      }

      if (
        requestedStatus !== "ALL" &&
        upload.ficha.status !== requestedStatus
      ) {
        return false;
      }

      if (search) {
        const normalizedSearch = search.toLowerCase();

        const searchableText = [
          upload.fileName,
          upload.uploadedBy.name,
          upload.uploadedBy.email,
          upload.category,
          upload.subcategory,
          upload.tipo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });

    const complete = evaluatedUploads.filter(
      (upload) => upload.ficha.status === "COMPLETE"
    ).length;

    const incomplete = evaluatedUploads.filter(
      (upload) => upload.ficha.status === "INCOMPLETE"
    ).length;

    const empty = evaluatedUploads.filter(
      (upload) => upload.ficha.status === "EMPTY"
    ).length;

    const withoutFicha = evaluatedUploads.filter(
      (upload) => upload.ficha.status === "WITHOUT_FICHA"
    ).length;

    const totalCompletion = evaluatedUploads.reduce(
      (sum, upload) => sum + upload.ficha.completion,
      0
    );

    const averageCompletion =
      evaluatedUploads.length > 0
        ? Math.round(totalCompletion / evaluatedUploads.length)
        : 0;

    const rankingMap = new Map<
      string,
      {
        userId: string | null;
        name: string;
        email: string | null;
        uploads: number;
        complete: number;
        pending: number;
        totalCompletion: number;
      }
    >();

    for (const upload of evaluatedUploads) {
      const rankingKey =
        upload.createdById ||
        upload.uploadedBy.email ||
        "unknown-user";

      const current = rankingMap.get(rankingKey) || {
        userId: upload.createdById,
        name:
          upload.uploadedBy.name ||
          upload.uploadedBy.email ||
          "Usuario desconocido",
        email: upload.uploadedBy.email,
        uploads: 0,
        complete: 0,
        pending: 0,
        totalCompletion: 0,
      };

      current.uploads += 1;
      current.totalCompletion += upload.ficha.completion;

      if (upload.ficha.status === "COMPLETE") {
        current.complete += 1;
      } else {
        current.pending += 1;
      }

      rankingMap.set(rankingKey, current);
    }

    const ranking = Array.from(rankingMap.values())
      .map((user) => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        uploads: user.uploads,
        complete: user.complete,
        pending: user.pending,
        compliance:
          user.uploads > 0
            ? Math.round(user.totalCompletion / user.uploads)
            : 0,
      }))
      .sort((a, b) => {
        if (b.uploads !== a.uploads) {
          return b.uploads - a.uploads;
        }

        return b.compliance - a.compliance;
      });

    const totalFiltered = filteredUploads.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    const paginatedUploads = filteredUploads.slice(
      offset,
      offset + limit
    );

    return NextResponse.json(
      {
        summary: {
          total: evaluatedUploads.length,
          complete,
          incomplete,
          empty,
          withoutFicha,
          pending: incomplete + empty + withoutFicha,
          averageCompletion,
          usersWithUploads: ranking.filter(
            (user) => user.userId !== null
          ).length,
        },

        filters: {
          search,
          userId,
          status: requestedStatus,
        },

        pagination: {
          page: safePage,
          limit,
          total: totalFiltered,
          totalPages,
        },

        ranking,
        uploads: paginatedUploads,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("CONTROL_CARGAS_GET_ERROR", error);

    return NextResponse.json(
      {
        error: "No se pudo cargar el control de archivos",
      },
      { status: 500 }
    );
  }
}