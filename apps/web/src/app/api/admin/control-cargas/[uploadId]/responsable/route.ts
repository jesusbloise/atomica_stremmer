import { NextRequest, NextResponse } from "next/server";
import pool from "@/db";
import { getSessionFromRequest } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    uploadId: string;
  }>;
};

type RequestBody = {
  userId?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const client = await pool.connect();

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
        {
          error:
            "No tienes permisos para asignar responsables",
        },
        { status: 403 }
      );
    }

    const { uploadId } = await context.params;

    if (!UUID_REGEX.test(uploadId)) {
      return NextResponse.json(
        { error: "El ID del archivo no es válido" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | RequestBody
      | null;

    if (!body || !Object.prototype.hasOwnProperty.call(body, "userId")) {
      return NextResponse.json(
        { error: "Debes enviar userId" },
        { status: 400 }
      );
    }

    const normalizedUserId =
      typeof body.userId === "string"
        ? body.userId.trim()
        : null;

    if (
      normalizedUserId &&
      !UUID_REGEX.test(normalizedUserId)
    ) {
      return NextResponse.json(
        { error: "El ID del usuario no es válido" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const uploadResult = await client.query<{
      id: string;
      file_name: string;
      created_by_id: string | null;
    }>(
      `
        SELECT
          id,
          file_name,
          created_by_id
        FROM uploads
        WHERE id = $1
          AND COALESCE(is_deleted, FALSE) = FALSE
        LIMIT 1
        FOR UPDATE
      `,
      [uploadId]
    );

    if (uploadResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "El archivo no existe" },
        { status: 404 }
      );
    }

    let assignedUser: {
      id: string;
      name: string | null;
      email: string;
    } | null = null;

    if (normalizedUserId) {
      const userResult = await client.query<{
        id: string;
        name: string | null;
        email: string;
        is_active: boolean;
      }>(
        `
          SELECT
            id,
            name,
            email,
            is_active
          FROM users
          WHERE id = $1::uuid
          LIMIT 1
        `,
        [normalizedUserId]
      );

      if (userResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          { error: "El usuario seleccionado no existe" },
          { status: 404 }
        );
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "No puedes asignar el archivo a un usuario inactivo",
          },
          { status: 400 }
        );
      }

      assignedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    }

    const updatedResult = await client.query<{
      id: string;
      file_name: string;
      created_by_id: string | null;
    }>(
      `
        UPDATE uploads
        SET
          created_by_id = $2
        WHERE id = $1
        RETURNING
          id,
          file_name,
          created_by_id
      `,
      [uploadId, normalizedUserId]
    );

    await client.query("COMMIT");

    const updatedUpload = updatedResult.rows[0];

    return NextResponse.json({
      ok: true,
      upload: {
        id: updatedUpload.id,
        fileName: updatedUpload.file_name,
        createdById: updatedUpload.created_by_id,
        uploadedBy: assignedUser,
      },
      message: assignedUser
        ? `Archivo asignado a ${
            assignedUser.name || assignedUser.email
          }`
        : "Responsable eliminado correctamente",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    console.error(
      "CONTROL_CARGAS_ASSIGN_RESPONSIBLE_ERROR",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo actualizar el responsable del archivo",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}