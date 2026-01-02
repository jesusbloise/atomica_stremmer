import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

export async function GET(req: Request) {
  try {
    // Lee cookie "auth"
    const cookie = (req.headers.get("cookie") || "")
      .split(";")
      .map(v => v.trim())
      .find(v => v.startsWith("auth="));

    const raw = cookie?.split("=")?.[1];
    if (!raw) {
      return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
    }

    // A veces viene url-encoded
    const token = decodeURIComponent(raw);

    const payload = jwt.verify(token, JWT_SECRET) as any;

    // Normalizamos campos esperados por el cliente
    const id =
      payload.id ??
      payload.sub ??
      payload.userId ??
      null;

    const role = String(payload.role ?? "")
      .trim()
      .toUpperCase(); // "ESTUDIANTE", "ADMIN", etc.

    return NextResponse.json(
      {
        id,                    // 👈 clave: el cliente espera "id"
        name: payload.name ?? null,
        email: payload.email ?? null,
        role,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Token inválido o expirado
    return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });
  }
}


