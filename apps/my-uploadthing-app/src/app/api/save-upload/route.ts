import { NextRequest, NextResponse } from "next/server";
import pool from "@/db"; // o "../../../db" si no tienes configurado el alias
import { v4 as uuidv4 } from "uuid"; // opcional si decides generar id

export async function POST(req: NextRequest) {
  try {
    // Paso 1: Leer el cuerpo sin asumir que es válido JSON
    const rawBody = await req.text();

    console.log("Backend recibió (raw):", rawBody);

    // Paso 2: Parsear manualmente
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error("Error al parsear JSON:", err);
      return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
    }

    // Paso 3: Extraer los datos esperados
    const {
      id,
      customId = null,
      key,
      name,
      size,
      status = "Uploaded",
      uploadedAt,
    } = body;

    // Paso 4: Validar campos requeridos
    const missing = [];
    if (!id) missing.push("id");
    if (!key) missing.push("key");
    if (!name) missing.push("name");
    if (!size) missing.push("size");
    if (!uploadedAt) missing.push("uploadedAt");

    if (missing.length > 0) {
      console.error("Datos faltantes:", missing);
      return NextResponse.json(
        { success: false, error: "Datos incompletos", missing },
        { status: 400 }
      );
    }

    // Paso 5: Insertar en la base de datos
    const query = `
      INSERT INTO uploads (
        id, custom_id, file_key, file_name,
        size_in_bytes, status, uploaded_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0)
      );
    `;

    const values = [id, customId, key, name, size, status, uploadedAt];

    await pool.query(query, values);

    console.log("Datos guardados correctamente en DB:", name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando en la base de datos:", error);
    return NextResponse.json({ success: false, error: "Error en el servidor" }, { status: 500 });
  }
}
