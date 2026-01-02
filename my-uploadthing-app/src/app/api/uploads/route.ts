import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RowUpload = {
  id: string;
  file_name: string | null;
  file_key: string | null;
  file_path: string | null;
  size_in_bytes: number | null;
  uploaded_at: string | null;
  tipo: string | null;
  category?: string | null;
  subcategory?: string | null;
  // alias de ficha (cuando withFicha=1)
  ft_titulo?: string | null;
  ft_director?: string | null;
  ft_productor?: string | null;
  ft_jefe_produccion?: string | null;
  ft_director_fotografia?: string | null;
  ft_sonido?: string | null;
  ft_direccion_arte?: string | null;
  ft_asistente_direccion?: string | null;
  ft_montaje?: string | null;
  ft_otro_cargo?: string | null;
  ft_contacto_principal?: string | null;
  ft_correo?: string | null;
  ft_curso?: string | null;
  ft_profesor?: string | null;
  ft_anio?: number | null;
  ft_duracion?: string | null;
  ft_sinopsis?: string | null;
  ft_proceso_anterior?: string | null;
  ft_pendientes?: string | null;
  ft_visto?: boolean | null;
  ft_reunion?: string | null;
  ft_formato?: string | null;
  ft_estado?: string | null;
  ft_delivery_estimado?: string | null;
  ft_seleccion?: string | null;
  ft_link?: string | null;
  ft_foto?: string | null;
};

function mapFichaCamel(row: RowUpload) {
  if (
    row.ft_titulo === undefined &&
    row.ft_director === undefined
  ) return undefined;

  // si no hay ninguna columna de ficha poblada, devolvemos undefined
  const hasAny =
    row.ft_titulo != null ||
    row.ft_director != null ||
    row.ft_productor != null ||
    row.ft_anio != null ||
    row.ft_link != null;
  if (!hasAny) return undefined;

  return {
    titulo: row.ft_titulo ?? undefined,
    director: row.ft_director ?? undefined,
    productor: row.ft_productor ?? undefined,
    jefeProduccion: row.ft_jefe_produccion ?? undefined,
    directorFotografia: row.ft_director_fotografia ?? undefined,
    sonido: row.ft_sonido ?? undefined,
    direccionArte: row.ft_direccion_arte ?? undefined,
    asistenteDireccion: row.ft_asistente_direccion ?? undefined,
    montaje: row.ft_montaje ?? undefined,
    otroCargo: row.ft_otro_cargo ?? undefined,
    contactoPrincipal: row.ft_contacto_principal ?? undefined,
    correo: row.ft_correo ?? undefined,
    curso: row.ft_curso ?? undefined,
    profesor: row.ft_profesor ?? undefined,
    anio: row.ft_anio ?? undefined,
    duracion: row.ft_duracion ?? undefined,
    sinopsis: row.ft_sinopsis ?? undefined,
    procesoAnterior: row.ft_proceso_anterior ?? undefined,
    pendientes: row.ft_pendientes ?? undefined,
    visto: row.ft_visto ?? undefined,
    reunion: row.ft_reunion ?? undefined,
    formato: row.ft_formato ?? undefined,
    estado: row.ft_estado ?? undefined,
    deliveryEstimado: row.ft_delivery_estimado ?? undefined,
    seleccion: row.ft_seleccion ?? undefined,
    link: row.ft_link ?? undefined,
    foto: row.ft_foto ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category")?.toLowerCase() || null;
  const subcategory = searchParams.get("subcategory") || null;
  const withFicha = searchParams.get("withFicha") === "1"; // opcional
  const limit = Math.min(Number(searchParams.get("limit") || 500), 1000);

  try {
    // ====== Intento "completo": con is_deleted, category, subcategory ======
    try {
      const where: string[] = ["is_deleted = FALSE"];
      const params: any[] = [];
      let i = 1;

      if (category) {
        where.push(`LOWER(u.category) = $${i++}`);
        params.push(category);
      }
      if (subcategory) {
        where.push(`u.subcategory = $${i++}`);
        params.push(subcategory);
      }

      // SELECT base
      let select =
        `SELECT u.id, u.file_name, u.file_key, u.file_path, u.size_in_bytes,
                u.uploaded_at, u.tipo, u.category, u.subcategory`;

      // LEFT JOIN ficha_tecnica si se pide
      let join = "";
      if (withFicha) {
        select += `,
                ft.titulo              AS ft_titulo,
                ft.director            AS ft_director,
                ft.productor           AS ft_productor,
                ft.jefe_produccion     AS ft_jefe_produccion,
                ft.director_fotografia AS ft_director_fotografia,
                ft.sonido              AS ft_sonido,
                ft.direccion_arte      AS ft_direccion_arte,
                ft.asistente_direccion AS ft_asistente_direccion,
                ft.montaje             AS ft_montaje,
                ft.otro_cargo          AS ft_otro_cargo,
                ft.contacto_principal  AS ft_contacto_principal,
                ft.correo              AS ft_correo,
                ft.curso               AS ft_curso,
                ft.profesor            AS ft_profesor,
                ft.anio                AS ft_anio,
                ft.duracion            AS ft_duracion,
                ft.sinopsis            AS ft_sinopsis,
                ft.proceso_anterior    AS ft_proceso_anterior,
                ft.pendientes          AS ft_pendientes,
                ft.visto               AS ft_visto,
                ft.reunion             AS ft_reunion,
                ft.formato             AS ft_formato,
                ft.estado              AS ft_estado,
                ft.delivery_estimado   AS ft_delivery_estimado,
                ft.seleccion           AS ft_seleccion,
                ft.link                AS ft_link,
                ft.foto                AS ft_foto`;
        join = ` LEFT JOIN ficha_tecnica ft ON ft.upload_id = u.id`;
      }

      const sql = `
        ${select}
        FROM uploads u
        ${join}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY u.uploaded_at DESC
        LIMIT $${i}
      `;
      params.push(limit);

      const { rows } = await pool.query<RowUpload>(sql, params);

      if (!withFicha) {
        return NextResponse.json(rows);
      }

      // Mapear ficha a camelCase y limpiar alias
      const mapped = rows.map((r) => {
        const ficha = mapFichaCamel(r);
        // quitamos los alias ft_* del objeto
        const {
          ft_titulo, ft_director, ft_productor, ft_jefe_produccion,
          ft_director_fotografia, ft_sonido, ft_direccion_arte,
          ft_asistente_direccion, ft_montaje, ft_otro_cargo,
          ft_contacto_principal, ft_correo, ft_curso, ft_profesor,
          ft_anio, ft_duracion, ft_sinopsis, ft_proceso_anterior,
          ft_pendientes, ft_visto, ft_reunion, ft_formato, ft_estado,
          ft_delivery_estimado, ft_seleccion, ft_link, ft_foto,
          ...rest
        } = r as any;

        return { ...rest, ficha };
      });

      return NextResponse.json(mapped);
    } catch (e: any) {
      // Si falta alguna columna en tu esquema actual (42703) o falta la tabla ficha_tecnica (42P01), usamos fallback
      if (e?.code !== "42703" && e?.code !== "42P01") throw e;
    }

    // ====== Fallback: esquema mínimo (sin category/subcategory/is_deleted ni join ficha) ======
    const { rows } = await pool.query(
      `SELECT id, file_name, file_key, file_path, size_in_bytes,
              uploaded_at, tipo
       FROM uploads
       ORDER BY uploaded_at DESC
       LIMIT $1`,
      [limit]
    );

    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/uploads error:", e);
    return NextResponse.json(
      { error: "No se pudieron cargar los archivos" },
      { status: 500 }
    );
  }
}


