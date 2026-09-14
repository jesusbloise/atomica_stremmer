import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(null, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const id =
    session.id ??
    session.sub ??
    null;

  const role = String(session.role ?? "")
    .trim()
    .toUpperCase();

  return NextResponse.json(
    {
      id,
      name: session.name ?? null,
      email: session.email ?? null,
      role,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}