

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * ✅ Host canónico (EL MISMO que tienes en Google OAuth)
 * JavaScript origins:
 *   https://atomica-stremmer-web-23864640850.us-central1.run.app
 * Redirect URI:
 *   https://atomica-stremmer-web-23864640850.us-central1.run.app/api/auth/callback/google
 */
const CANONICAL_HOST = "atomica-stremmer-web-23864640850.us-central1.run.app";

/**
 * ⚠️ Middleware corre en Edge. No uses 'jsonwebtoken' aquí.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // =========================
  // 1) ✅ Forzar host canónico
  // =========================
  const host = (req.headers.get("host") || "").toLowerCase();

  // Si entra por a.run.app u otro host, lo mandamos al canónico
const isLocalHost =
  host.startsWith("localhost:") ||
  host.startsWith("127.0.0.1:") ||
  host.startsWith("192.168.");

if (host && host !== CANONICAL_HOST && !isLocalHost) {
  const url = req.nextUrl.clone();
  url.host = CANONICAL_HOST;
  url.protocol = "https:";
  return NextResponse.redirect(url, 307);
}
  

  // =========================
  // 2) Tu lógica actual
  // =========================

  // Rutas públicas (sin protección)
  const isPublic =
  pathname.startsWith("/login") ||
  pathname.startsWith("/register") ||
  pathname.startsWith("/api/login") ||
  pathname.startsWith("/api/register") ||
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/api/auth/") ||

  // página pública de detalle
  pathname.startsWith("/videos/") ||

  // APIs mínimas para que el detalle funcione sin login
  pathname.startsWith("/api/uploads/") ||
  pathname.startsWith("/api/subtitulos/") ||
  pathname.startsWith("/api/views/") ||

  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon") ||
  pathname === "/robots.txt" ||
  pathname === "/sitemap.xml";
  // const isPublic =
  //   pathname.startsWith("/login") ||
  //   pathname.startsWith("/register") ||
  //   pathname.startsWith("/api/login") ||
  //   pathname.startsWith("/api/register") ||
  //   pathname.startsWith("/api/auth") ||
  //   pathname.startsWith("/api/auth/") || // ✅ NextAuth (session, signin, callback, etc.)
  //   pathname.startsWith("/videos/") ||   // ✅ PUBLICO: detalle de video
  //   pathname.startsWith("/_next") ||
  //   pathname.startsWith("/favicon") ||
  //   pathname === "/robots.txt" ||
  //   pathname === "/sitemap.xml";

  if (isPublic) return NextResponse.next();

  // Cookies que cuentan como "logueado":
  const hasCustomAuth = !!req.cookies.get("auth")?.value;
  const hasNextAuth =
    !!req.cookies.get("next-auth.session-token")?.value ||
    !!req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (hasCustomAuth || hasNextAuth) {
    return NextResponse.next();
  }

  // Si no está autenticado, redirige a /login
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", pathname + search);
  return NextResponse.redirect(url);
}

// ✅ Excluye assets estáticos
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$).*)",
  ],
};

