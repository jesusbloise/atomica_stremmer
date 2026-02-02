// src/app/api/fichas/[uploadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Reusa tu /api/me para saber el rol (ADMIN / PROFESOR / ESTUDIANTE)
async function getSessionUser(req: NextRequest) {
  try {
    const me = await fetch(new URL("/api/me", req.url), {
      cache: "no-store",
      headers: { cookie: req.headers.get("cookie") || "" },
    }).then((r) => (r.ok ? r.json() : null));
    return me as {
      id: string;
      name: string;
      role: "ADMIN" | "PROFESOR" | "ESTUDIANTE";
      email?: string | null;
    } | null;
  } catch {
    return null;
  }
}

/** GET: devuelve la ficha por upload_id (sin cambios de tabla) */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await ctx.params;

  try {
    const q = await pool.query(
      `SELECT
         ft.id, ft.upload_id,

         -- ✅ nombre real del archivo desde uploads
         u.file_name AS archivo_nombre,

         -- ficha antigua
         ft.titulo, ft.director, ft.productor, ft.jefe_produccion,
         ft.director_fotografia, ft.sonido, ft.direccion_arte,
         ft.asistente_direccion, ft.montaje, ft.otro_cargo,
         ft.contacto_principal, ft.correo, ft.curso, ft.profesor,
         ft.anio, ft.duracion, ft.sinopsis, ft.proceso_anterior,
         ft.pendientes, ft.visto, ft.reunion, ft.formato, ft.estado,
         ft.delivery_estimado, ft.seleccion, ft.link, ft.foto,

         -- ficha nueva
         ft.marca, ft.agencia, ft.productora_ficha, ft.contacto,
         ft.oficina, ft.tipo, ft.estudio, ft.produccion, ft.corporativo, ft.nuevos_negocios,

         ft.created_at, ft.updated_at
       FROM ficha_tecnica ft
       LEFT JOIN uploads u ON u.id = ft.upload_id
       WHERE ft.upload_id = $1
       LIMIT 1`,
      [uploadId]
    );

    const row = q.rows[0] || null;
    if (row && !Array.isArray(row.tipo)) row.tipo = [];

    return NextResponse.json({ ficha: row }, { status: 200 });
  } catch (e) {
    console.error("GET /api/fichas/[uploadId] error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/** PUT/PATCH: upsert por upload_id (con validación ADMIN y nulls) */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await ctx.params; // 👈 await

  // Solo ADMIN puede editar (cámbialo si quieres permitir PROFESOR)
  const me = await getSessionUser(req);
  if (!me?.id || me.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // helper: undefined | "" => null
    const n = (v: any) =>
      v === undefined ||
      v === null ||
      (typeof v === "string" && v.trim() === "")
        ? null
        : v;

    // normaliza boolean (soporta "si", "sí", "true", "1" / "no", "false", "0")
    const parseBool = (v: any): boolean | null => {
      if (typeof v === "boolean") return v;
      const s = String(v ?? "").toLowerCase();
      if (["si", "sí", "true", "1"].includes(s)) return true;
      if (["no", "false", "0"].includes(s)) return false;
      return null;
    };

    // Mapeo defensivo (camelCase y snake_case) -> snake_case de DB
    const f = {
      titulo: n(body.titulo),
      director: n(body.director),
      productor: n(body.productor),
      jefe_produccion: n(body.jefeProduccion ?? body.jefe_produccion),
      director_fotografia: n(
        body.directorFotografia ?? body.director_fotografia
      ),
      sonido: n(body.sonido),
      direccion_arte: n(body.direccionArte ?? body.direccion_arte),
      asistente_direccion: n(
        body.asistenteDireccion ?? body.asistente_direccion
      ),
      montaje: n(body.montaje),
      otro_cargo: n(body.otroCargo ?? body.otro_cargo),
      contacto_principal: n(body.contactoPrincipal ?? body.contacto_principal),
      correo: n(body.correo),
      curso: n(body.curso),
      profesor: n(body.profesor),
      anio:
        body.anio === "" || body.anio === undefined || body.anio === null
          ? null
          : Number(body.anio) || null,
      duracion: n(body.duracion),
      sinopsis: n(body.sinopsis),
      proceso_anterior: n(body.procesoAnterior ?? body.proceso_anterior),
      pendientes: n(body.pendientes),
      visto: parseBool(body.visto),
      reunion: n(body.reunion), // ISO o null (tu columna es TIMESTAMPTZ)
      formato: n(body.formato),
      estado: n(body.estado),
      delivery_estimado: n(body.deliveryEstimado ?? body.delivery_estimado),
      seleccion: n(body.seleccion),
      link: n(body.link),
      foto: n(body.foto),
    };

    const q = await pool.query(
      `INSERT INTO ficha_tecnica (
         upload_id, titulo, director, productor, jefe_produccion,
         director_fotografia, sonido, direccion_arte, asistente_direccion,
         montaje, otro_cargo, contacto_principal, correo, curso, profesor,
         anio, duracion, sinopsis, proceso_anterior, pendientes, visto, reunion,
         formato, estado, delivery_estimado, seleccion, link, foto
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
       )
       ON CONFLICT (upload_id) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         director = EXCLUDED.director,
         productor = EXCLUDED.productor,
         jefe_produccion = EXCLUDED.jefe_produccion,
         director_fotografia = EXCLUDED.director_fotografia,
         sonido = EXCLUDED.sonido,
         direccion_arte = EXCLUDED.direccion_arte,
         asistente_direccion = EXCLUDED.asistente_direccion,
         montaje = EXCLUDED.montaje,
         otro_cargo = EXCLUDED.otro_cargo,
         contacto_principal = EXCLUDED.contacto_principal,
         correo = EXCLUDED.correo,
         curso = EXCLUDED.curso,
         profesor = EXCLUDED.profesor,
         anio = EXCLUDED.anio,
         duracion = EXCLUDED.duracion,
         sinopsis = EXCLUDED.sinopsis,
         proceso_anterior = EXCLUDED.proceso_anterior,
         pendientes = EXCLUDED.pendientes,
         visto = EXCLUDED.visto,
         reunion = EXCLUDED.reunion,
         formato = EXCLUDED.formato,
         estado = EXCLUDED.estado,
         delivery_estimado = EXCLUDED.delivery_estimado,
         seleccion = EXCLUDED.seleccion,
         link = EXCLUDED.link,
         foto = EXCLUDED.foto,
         updated_at = NOW()
       RETURNING *`,
      [
        uploadId,
        f.titulo,
        f.director,
        f.productor,
        f.jefe_produccion,
        f.director_fotografia,
        f.sonido,
        f.direccion_arte,
        f.asistente_direccion,
        f.montaje,
        f.otro_cargo,
        f.contacto_principal,
        f.correo,
        f.curso,
        f.profesor,
        f.anio,
        f.duracion,
        f.sinopsis,
        f.proceso_anterior,
        f.pendientes,
        f.visto,
        f.reunion,
        f.formato,
        f.estado,
        f.delivery_estimado,
        f.seleccion,
        f.link,
        f.foto,
      ]
    );

    return NextResponse.json({ ficha: q.rows[0] }, { status: 200 });
  } catch (e) {
    console.error("PUT /api/fichas/[uploadId] error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Alias PATCH -> PUT
export const PATCH = PUT;
