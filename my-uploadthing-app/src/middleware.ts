import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * ⚠️ Middleware corre en Edge. No uses 'jsonwebtoken' aquí.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Rutas públicas (sin protección)
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/register") ||
    pathname.startsWith("/api/auth") || // ✅ NextAuth (session, signin, callback, etc.)
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  if (isPublic) return NextResponse.next();

  // Cookies que cuentan como "logueado":
  // - Tu cookie propia 'auth'
  // - NextAuth (dev) -> next-auth.session-token
  // - NextAuth (prod/https) -> __Secure-next-auth.session-token
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

// ✅ Excluye assets estáticos y deja pasar todo lo de /api/auth
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};

