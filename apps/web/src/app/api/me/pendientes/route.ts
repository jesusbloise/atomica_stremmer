import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

type PendingUploadRow = {
  id: string;
  file_name: string;
  uploaded_at: string;
  tipo: string | null;
  category: string | null;
  subcategory: string | null;
  created_by_id: string | null;

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
    return value.some(
      (item) => String(item).trim().length > 0
    );
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

function calculateFicha(row: PendingUploadRow) {
  if (!row.ficha_exists) {
    return {
      status: "WITHOUT_FICHA" as const,
      completion: 0,
      completedFields: 0,
      totalFields: REQUIRED_FIELDS.length,
      missingFields: REQUIRED_FIELDS.map(
        (field) => field.label
      ),
    };
  }

  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !hasValue(row[field.key])
  ).map((field) => field.label);

  const completedFields =
    REQUIRED_FIELDS.length - missingFields.length;

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

    const userId = String(
      session.sub || session.id || ""
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { error: "No se pudo identificar al usuario" },
        { status: 401 }
      );
    }

    const query = `
      SELECT
        u.id,
        u.file_name,
        u.uploaded_at,
        u.tipo,
        u.category,
        u.subcategory,
        u.created_by_id,

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

      LEFT JOIN ficha_tecnica ft
        ON ft.upload_id = u.id

      WHERE
        COALESCE(u.is_deleted, FALSE) = FALSE
        AND u.created_by_id = $1

      ORDER BY u.uploaded_at DESC
    `;

    const result = await pool.query<PendingUploadRow>(
      query,
      [userId]
    );

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
        ficha: {
          exists: row.ficha_exists,
          ...ficha,
        },
      };
    });

    const pendingUploads = evaluatedUploads.filter(
      (upload) => upload.ficha.status !== "COMPLETE"
    );

    const incomplete = pendingUploads.filter(
      (upload) => upload.ficha.status === "INCOMPLETE"
    ).length;

    const empty = pendingUploads.filter(
      (upload) => upload.ficha.status === "EMPTY"
    ).length;

    const withoutFicha = pendingUploads.filter(
      (upload) =>
        upload.ficha.status === "WITHOUT_FICHA"
    ).length;

    return NextResponse.json(
      {
        total: pendingUploads.length,

        summary: {
          incomplete,
          empty,
          withoutFicha,
        },

        uploads: pendingUploads,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("ME_PENDING_UPLOADS_GET_ERROR", error);

    return NextResponse.json(
      {
        error:
          "No se pudieron consultar las fichas pendientes",
      },
      { status: 500 }
    );
  }
}