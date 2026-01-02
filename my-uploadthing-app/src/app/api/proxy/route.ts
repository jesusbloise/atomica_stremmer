// my-uploadthing-app/src/app/api/proxy/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rewriteUrl(raw: string): string | null {
  try {
    const u = new URL(raw);

    // Si el link viene como http://localhost:9100 (o 9000) desde MinIO,
    // lo reescribimos a la dirección interna del contenedor MinIO.
    // Ajusta MINIO_INTERNAL_BASE si usas otro nombre/puerto.
    if (
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      (u.port === "9100" || u.port === "9000")
    ) {
      const base = process.env.MINIO_INTERNAL_BASE || "http://minio-old:9000";
      const b = new URL(base);
      u.protocol = b.protocol;
      u.hostname = b.hostname;
      u.port = b.port;
    }

    return u.toString();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new Response("missing url", { status: 400 });

  const target = rewriteUrl(rawUrl);
  if (!target) return new Response("bad url", { status: 400 });

  // Soporte de streaming de video (Range)
  const range = req.headers.get("range") || undefined;
  const ifRange = req.headers.get("if-range") || undefined;

  // Importante: no-cache mientras probamos
  const upstream = await fetch(target, {
    method: "GET",
    headers: {
      ...(range ? { range } : {}),
      ...(ifRange ? { "if-range": ifRange } : {}),
    },
    cache: "no-store",
  });

  const headers = new Headers();
  // Copiamos sólo los headers relevantes para video/archivos
  for (const k of [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified",
    "cache-control",
    "content-disposition",
  ]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }

  // Si quieres abrir el proxy a otros orígenes, descomenta:
  // headers.set("Access-Control-Allow-Origin", "*");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
