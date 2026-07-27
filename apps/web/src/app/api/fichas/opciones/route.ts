import { NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";

type OptionField =
  | "marca"
  | "agencia"
  | "productora"
  | "duracion"
  | "formato"
  | "version"
  | "produccion"
  | "corporativo"
  | "nuevosNegocios";

type OptionsResponse = Record<OptionField, string[]>;

type DatabaseField = {
  responseKey: OptionField;
  columnName: string;
};

const DATABASE_FIELDS: DatabaseField[] = [
  {
    responseKey: "marca",
    columnName: "marca",
  },
  {
    responseKey: "agencia",
    columnName: "agencia",
  },
  {
    responseKey: "productora",
    columnName: "productora",
  },
  {
    responseKey: "duracion",
    columnName: "duracion",
  },
  {
    responseKey: "formato",
    columnName: "formato",
  },
  {
    responseKey: "version",
    columnName: "version",
  },
  {
    responseKey: "produccion",
    columnName: "produccion",
  },
  {
    responseKey: "corporativo",
    columnName: "corporativo",
  },
  {
    responseKey: "nuevosNegocios",
    columnName: "nuevos_negocios",
  },
];

const DEFAULT_OPTIONS: Partial<Record<OptionField, string[]>> = {
  duracion: [
    "00:05",
    "00:10",
    "00:15",
    "00:20",
    "00:30",
    "00:45",
    "01:00",
  ],
  formato: ["16:9", "9:16", "1:1", "4:5", "4:3"],
  version: ["V1", "V2", "V3", "Final", "Master"],
};

function normalizeOption(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function buildOptions(
  values: unknown[],
  defaultValues: string[] = []
): string[] {
  const uniqueValues = new Map<string, string>();

  const allValues = ["N/A", ...defaultValues, ...values];

  for (const value of allValues) {
    const normalized = normalizeOption(value);

    if (!normalized) {
      continue;
    }

    const comparisonKey = normalized.toLocaleLowerCase("es");

    if (!uniqueValues.has(comparisonKey)) {
      uniqueValues.set(comparisonKey, normalized);
    }
  }

  return Array.from(uniqueValues.values()).sort((a, b) => {
    if (a === "N/A") return -1;
    if (b === "N/A") return 1;

    return a.localeCompare(b, "es", {
      sensitivity: "base",
      numeric: true,
    });
  });
}

export async function GET() {
  try {
    /*
     * Primero verificamos qué columnas existen realmente.
     * Esto permite que la ruta funcione aunque la base local
     * todavía no tenga columnas nuevas como "version".
     */
    const columnsResult = await pool.query<{
      column_name: string;
    }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ficha_tecnica'
    `);

    const existingColumns = new Set(
      columnsResult.rows.map((row) => row.column_name)
    );

    const availableFields = DATABASE_FIELDS.filter((field) =>
      existingColumns.has(field.columnName)
    );

    /*
     * Solo seleccionamos columnas que existen.
     * Los nombres vienen de una lista interna fija, no del usuario.
     */
    const selectedColumns = availableFields.map(
      (field) => `"${field.columnName}"`
    );

    let rows: Record<string, unknown>[] = [];

    if (selectedColumns.length > 0) {
      const result = await pool.query<Record<string, unknown>>(`
        SELECT ${selectedColumns.join(", ")}
        FROM ficha_tecnica
      `);

      rows = result.rows;
    }

    const options: OptionsResponse = {
      marca: buildOptions([]),
      agencia: buildOptions([]),
      productora: buildOptions([]),

      duracion: buildOptions([], DEFAULT_OPTIONS.duracion),
      formato: buildOptions([], DEFAULT_OPTIONS.formato),
      version: buildOptions([], DEFAULT_OPTIONS.version),

      produccion: buildOptions([]),
      corporativo: buildOptions([]),
      nuevosNegocios: buildOptions([]),
    };

    for (const field of availableFields) {
      options[field.responseKey] = buildOptions(
        rows.map((row) => row[field.columnName]),
        DEFAULT_OPTIONS[field.responseKey] ?? []
      );
    }

    return NextResponse.json(options, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error cargando opciones de ficha técnica:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido consultando PostgreSQL";

    return NextResponse.json(
      {
        error: "No se pudieron cargar las opciones de la ficha técnica",
        detail:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}